<script lang="ts">
    import { createRafScheduler } from "$lib/utils/common"
    import { getExternalSong, getPlanAsList } from "$lib/integrations/integrationState.svelte"
    import type { ListSongItem } from "$lib/models/List"
    import { t } from "$lib/state/i18n.svelte"
    import { fullscreenState, goBack, menuState, popupState, savedFullscreenPosition, setActivePopup } from "$lib/state/menu.svelte"
    import { metronomeState } from "$lib/state/metronome.svelte"
    import { playbackState, togglePlayback } from "$lib/state/playback.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { enterFullscreen, exitFullscreen, isFullscreenActive, onFullscreenChange } from "$lib/utils/fullscreen"
    import { isIos, isIosSafariNonStandalone, openIosPrompt } from "$lib/utils/iosPwa"
    import { parsePlaybackUrl } from "$lib/utils/playback"
    import { isVirtualKeyboardOpen } from "$lib/utils/viewport"
    import { releaseWakeLock, requestWakeLock } from "$lib/utils/wakeLock"
    import { onMount } from "svelte"
    import { slide } from "svelte/transition"
    import Draw from "../draw/Draw.svelte"
    import QuickEditSongDialog from "../popups/QuickEditSongDialog.svelte"
    import ChordPro from "../song/ChordPro.svelte"
    import MetronomeButton from "../song/MetronomeButton.svelte"
    import Paper from "../song/Paper.svelte"
    import TransposeButton from "../song/TransposeButton.svelte"

    type FullscreenSlide = { type: "song"; songItem: ListSongItem; originalIndex: number } | { type: "section"; sections: Array<{ name: string; originalIndex: number }>; originalIndex: number }

    // --- State & Derived State ---
    const listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId)
    const list = $derived(listId ? storage.getListById(listId, storage.lists) || getPlanAsList(listId) : null)

    const slides = $derived.by<FullscreenSlide[]>(() => {
        if (!list) {
            return menuState.contentId ? [{ type: "song", songItem: { id: menuState.contentId }, originalIndex: 0 }] : []
        }

        const result: FullscreenSlide[] = []
        let currentSections: Array<{ name: string; originalIndex: number }> = []
        let firstSectionIdx = -1

        for (let i = 0; i < list.songs.length; i++) {
            const item = list.songs[i]
            if (item.type === "section") {
                if (currentSections.length === 0) {
                    firstSectionIdx = i
                }
                currentSections.push({ name: item.name || "Section", originalIndex: i })
            } else if (item.id) {
                if (currentSections.length > 0) {
                    result.push({
                        type: "section",
                        sections: currentSections,
                        originalIndex: firstSectionIdx
                    })
                    currentSections = []
                    firstSectionIdx = -1
                }
                result.push({
                    type: "song",
                    songItem: item,
                    originalIndex: i
                })
            }
        }

        if (currentSections.length > 0) {
            result.push({
                type: "section",
                sections: currentSections,
                originalIndex: firstSectionIdx
            })
        }

        return result
    })

    let actionsVisible = $state(false)
    let isDrawing = $state(false)
    let hideTimeout: ReturnType<typeof setTimeout> | undefined

    // Carousel state
    const initialSlideIndex = (() => {
        if (savedFullscreenPosition.pageIndex != null) {
            return savedFullscreenPosition.pageIndex
        }
        if (savedFullscreenPosition.index != null) {
            const targetIdx = savedFullscreenPosition.index
            const slideIdx = slides.findIndex((s) => {
                if (s.originalIndex === targetIdx) return true
                if (s.type === "section" && s.sections.some((sec) => sec.originalIndex === targetIdx)) return true
                return false
            })
            if (slideIdx !== -1) return slideIdx
            return Math.min(targetIdx, Math.max(0, slides.length - 1))
        }
        return 0
    })()

    let currentPageIndex = $state(initialSlideIndex)
    let currentSlideIndex = $derived.by(() => {
        const origIdx = pageSongIndexMap[currentPageIndex] ?? null
        if (origIdx !== null) {
            const slideIdx = slides.findIndex((s) => s.originalIndex === origIdx || (s.type === "section" && s.sections.some((sec) => sec.originalIndex === origIdx)))
            if (slideIdx !== -1) return slideIdx
        }
        return Math.max(0, Math.min(currentPageIndex, slides.length - 1))
    })
    let totalPages = $state(1)
    let sliderEl = $state<HTMLDivElement | null>(null)

    function initSlider(node: HTMLElement) {
        node.style.transform = `translate3d(-${initialSlideIndex * 100}vw, 0, 0)`
    }

    // Gesture tracking state
    let isDragging = false
    let startX = 0
    let currentTranslate = 0
    let prevTranslate = 0
    let didDrag = false
    let initialPinchDist = 0
    let moveRafId: number | null = null
    let transitionTimer: ReturnType<typeof setTimeout> | null = null

    // Dynamic pagination mappings
    let pageSongMap = $state<Array<string | null>>([])
    let pageIndexMap = $state<number[]>([])
    let pageSongIndexMap = $state<number[]>([])

    let lastActiveOriginalIndex: number | null = null
    let lastActivePageInSong = 0
    let lastActiveSongId: string | null = null

    let previousLyricsOnly = fullscreenState.lyricsOnly
    $effect(() => {
        const currentLyricsOnly = fullscreenState.lyricsOnly
        if (currentLyricsOnly !== previousLyricsOnly) {
            previousLyricsOnly = currentLyricsOnly
            const origIdx = pageSongIndexMap[currentPageIndex]
            if (origIdx !== undefined && origIdx !== null) {
                lastActiveOriginalIndex = origIdx
            }
            const songId = pageSongMap[currentPageIndex]
            if (songId) {
                lastActiveSongId = songId
            }
            const pageInSong = pageIndexMap[currentPageIndex]
            if (pageInSong !== undefined && pageInSong !== null) {
                lastActivePageInSong = pageInSong
            }
        }
    })

    function toggleActions() {
        actionsVisible = !actionsVisible
        clearTimeout(hideTimeout)

        if (actionsVisible) {
            hideTimeout = setTimeout(() => (actionsVisible = false), 3000)
        }
    }

    function goToPrevPage() {
        if (currentPageIndex > 0) {
            currentPageIndex--
            setPositionByIndex(true)
        } else {
            toggleActions()
        }
    }

    function goToNextPage() {
        if (currentPageIndex < totalPages - 1) {
            currentPageIndex++
            setPositionByIndex(true)
        } else {
            toggleActions()
        }
    }

    function exitSongFullscreen() {
        savedFullscreenPosition.pageIndex = currentPageIndex
        savedFullscreenPosition.index = pageSongIndexMap[currentPageIndex] ?? 0
        if (popupState.popupId !== null) setActivePopup(null)
        if (isFullscreenActive()) {
            exitFullscreen()
        }
        goBack()
    }

    let moreMenuOpen = $state(false)
    let songListMenuOpen = $state(false)
    let quickEditOpen = $state(false)

    function goToSong(targetOriginalIndex: number) {
        songListMenuOpen = false
        clearTimeout(hideTimeout)

        // Find page index matching the originalIndex
        let targetPage = pageSongIndexMap.indexOf(targetOriginalIndex)
        if (targetPage === -1) {
            const slideIdx = slides.findIndex((s) => {
                if (s.originalIndex === targetOriginalIndex) return true
                if (s.type === "section" && s.sections.some((sec) => sec.originalIndex === targetOriginalIndex)) return true
                return false
            })
            if (slideIdx !== -1) {
                targetPage = Math.min(slideIdx, totalPages - 1)
            }
        }

        if (targetPage !== -1 && targetPage !== currentPageIndex) {
            currentPageIndex = targetPage
            setPositionByIndex(true)
        }
    }

    const mountTime = typeof performance !== "undefined" ? performance.now() : Date.now()

    // --- Actions Header Toggle & Click Navigation ---
    function windowClick(e: MouseEvent) {
        if (didDrag) return
        if (isDrawing) return
        if (popupState.popupId !== null || quickEditOpen) return
        // Ignore the opening tap/click that triggered fullscreen entry
        const now = typeof performance !== "undefined" ? performance.now() : Date.now()
        if (now - mountTime < 350) return
        const target = e.target as HTMLElement | null
        if (
            target?.closest("header") ||
            target?.closest("footer") ||
            target?.closest("md-icon-button") ||
            target?.closest("md-menu") ||
            target?.closest("md-menu-item") ||
            target?.closest("md-dialog") ||
            target?.closest(".md-dialog") ||
            target?.closest("[role='dialog']") ||
            target?.closest(".playback-bar") ||
            target?.closest(".playback-bar-container")
        )
            return

        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        const ratioX = e.clientX / screenWidth
        const ratioY = e.clientY / screenHeight

        // Top 15% or Center (40% - 60%) toggles action buttons
        if (ratioY <= 0.15 || (ratioX >= 0.4 && ratioX <= 0.6)) {
            toggleActions()
        } else if (ratioX < 0.4) {
            goToPrevPage()
        } else {
            goToNextPage()
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (quickEditOpen) {
            if (e.key === "Escape") {
                quickEditOpen = false
            }
            return
        }
        if (isDrawing) {
            if (e.key === "Escape") {
                isDrawing = false
                setPositionByIndex(false)
                if (!isFullscreenActive()) enterFullscreen()
            }
            return
        }
        if (e.key === "Escape") {
            exitSongFullscreen()
            return
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
            goToPrevPage()
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
            goToNextPage()
        }
    }

    let initialPositionConsumed = false

    // --- Page Counting & Mapping ---
    function updatePageCount() {
        if (!sliderEl) return

        const slideEls = Array.from(sliderEl.querySelectorAll<HTMLElement>(":scope > .slide"))
        if (slideEls.length === 0) return

        const newPageSongMap: Array<string | null> = []
        const newPageIndexMap: number[] = []
        const newPageSongIndexMap: number[] = []

        let hasAnyPaperPage = false
        slideEls.forEach((slideEl, slideIndex) => {
            const slideItem = slides[slideIndex]
            const songId = slideItem?.type === "song" ? (slideItem.songItem.id ?? null) : null
            const originalIndex = slideItem?.originalIndex ?? slideIndex

            const paperPages = Array.from(slideEl.querySelectorAll<HTMLElement>(".paper-page"))
            if (paperPages.length > 0) {
                hasAnyPaperPage = true
                paperPages.forEach((_, pageInSong) => {
                    newPageSongMap.push(songId)
                    newPageIndexMap.push(pageInSong)
                    newPageSongIndexMap.push(originalIndex)
                })
            } else {
                // Placeholder or section slide: counts as 1 slot in the carousel
                newPageSongMap.push(songId)
                newPageIndexMap.push(0)
                newPageSongIndexMap.push(originalIndex)
            }
        })

        // Capture the active song and page before applying new pagination mappings
        const currentSongIndexInList = lastActiveOriginalIndex ?? pageSongIndexMap[currentPageIndex] ?? null
        const currentSongId = lastActiveSongId ?? pageSongMap[currentPageIndex] ?? null
        const currentPageInSong = lastActivePageInSong ?? pageIndexMap[currentPageIndex] ?? 0

        // Guard state reassignment to avoid unnecessary reactivity cascades if mappings are unchanged
        const hasMappingChanged =
            pageSongMap.length !== newPageSongMap.length ||
            pageIndexMap.length !== newPageIndexMap.length ||
            pageSongIndexMap.length !== newPageSongIndexMap.length ||
            newPageSongMap.some((v, idx) => v !== pageSongMap[idx]) ||
            newPageIndexMap.some((v, idx) => v !== pageIndexMap[idx]) ||
            newPageSongIndexMap.some((v, idx) => v !== pageSongIndexMap[idx])

        if (hasMappingChanged) {
            pageSongMap = newPageSongMap
            pageIndexMap = newPageIndexMap
            pageSongIndexMap = newPageSongIndexMap
            totalPages = pageSongMap.length || slides.length || 1
        }

        if (!initialPositionConsumed) {
            restoreInitialPosition(hasAnyPaperPage)
        } else if (hasMappingChanged) {
            let targetPage = -1

            if (currentSongIndexInList !== null) {
                const matchingPages: number[] = []
                for (let i = 0; i < pageSongIndexMap.length; i++) {
                    if (pageSongIndexMap[i] === currentSongIndexInList) {
                        matchingPages.push(i)
                    }
                }
                if (matchingPages.length > 0) {
                    const offset = Math.min(currentPageInSong, matchingPages.length - 1)
                    targetPage = matchingPages[Math.max(0, offset)]
                }
            }

            if (targetPage === -1 && currentSongId !== null) {
                const matchingPages: number[] = []
                for (let i = 0; i < pageSongMap.length; i++) {
                    if (pageSongMap[i] === currentSongId) {
                        matchingPages.push(i)
                    }
                }
                if (matchingPages.length > 0) {
                    const offset = Math.min(currentPageInSong, matchingPages.length - 1)
                    targetPage = matchingPages[Math.max(0, offset)]
                }
            }

            if (targetPage === -1) {
                targetPage = Math.max(0, Math.min(currentPageIndex, totalPages - 1))
            }

            currentPageIndex = targetPage
            setPositionByIndex(false)
        }
    }

    function restoreInitialPosition(isRealLayout: boolean) {
        let restored = false
        if (savedFullscreenPosition.pageIndex != null) {
            currentPageIndex = savedFullscreenPosition.pageIndex
            restored = true
        } else if (savedFullscreenPosition.index != null) {
            const targetIdx = savedFullscreenPosition.index
            let targetPageIdx = pageSongIndexMap.indexOf(targetIdx)
            if (targetPageIdx === -1) {
                const slideIdx = slides.findIndex((s) => {
                    if (s.originalIndex === targetIdx) return true
                    if (s.type === "section" && s.sections.some((sec) => sec.originalIndex === targetIdx)) return true
                    return false
                })
                if (slideIdx !== -1) {
                    targetPageIdx = pageSongIndexMap.indexOf(slides[slideIdx].originalIndex)
                }
            }
            currentPageIndex = targetPageIdx !== -1 ? targetPageIdx : Math.min(targetIdx, totalPages - 1)
            restored = true
        }

        if (restored) {
            if (isRealLayout) {
                savedFullscreenPosition.pageIndex = null
                savedFullscreenPosition.index = null
                initialPositionConsumed = true
            }
            setPositionByIndex(false)
        } else if (isRealLayout) {
            initialPositionConsumed = true
            detectSongAndPage(currentPageIndex)
        }
    }

    // --- Drag & Touch Handlers ---
    function pointerDown(e: PointerEvent) {
        if (isDrawing || initialPinchDist > 0) return
        isDragging = true
        didDrag = false
        startX = e.clientX
        sliderEl?.setPointerCapture?.(e.pointerId)
    }

    function pointerMove(e: PointerEvent) {
        if (initialPinchDist > 0 || !isDragging || !sliderEl) return
        const delta = e.clientX - startX
        if (Math.abs(delta) > 6) didDrag = true
        currentTranslate = prevTranslate + delta

        if (moveRafId === null) {
            moveRafId = requestAnimationFrame(() => {
                moveRafId = null
                if (sliderEl && isDragging) {
                    sliderEl.style.transform = `translate3d(${currentTranslate}px, 0, 0)`
                }
            })
        }
    }

    function pointerUp(e: PointerEvent) {
        if (moveRafId !== null) {
            cancelAnimationFrame(moveRafId)
            moveRafId = null
        }
        if (initialPinchDist > 0) {
            isDragging = false
            return
        }
        if (!isDragging || !sliderEl) return
        isDragging = false

        const movedBy = currentTranslate - prevTranslate
        const viewportWidth = window.innerWidth
        const threshold = viewportWidth * 0.2

        if (movedBy < -threshold && currentPageIndex < totalPages - 1) {
            currentPageIndex++
        } else if (movedBy > threshold && currentPageIndex > 0) {
            currentPageIndex--
        }

        setPositionByIndex()
        sliderEl.releasePointerCapture?.(e.pointerId)
        setTimeout(() => (didDrag = false), 100)
    }

    // --- Pinch-to-exit Handlers ---
    function handleTouchStart(e: TouchEvent) {
        if (isDrawing || popupState.popupId !== null) {
            initialPinchDist = 0
            return
        }
        if (e.touches.length >= 2) {
            initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
            didDrag = true
        }
    }

    function handleTouchMove(e: TouchEvent) {
        if (isDrawing || popupState.popupId !== null) {
            initialPinchDist = 0
            return
        }
        if (e.touches.length >= 2 && initialPinchDist > 0) {
            const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
            if (initialPinchDist - currentDist > 60) {
                initialPinchDist = 0
                exitSongFullscreen()
            }
        }
    }

    // --- Trackpad Two-Finger Swipe (Wheel) Handler ---
    let wheelDeltaXAccumulator = 0
    let lastWheelPageTurnTime = 0
    const WHEEL_SWIPE_THRESHOLD = 180 // Requires a clear, deliberate swipe distance
    const WHEEL_COOLDOWN = 450 // ms before the next swipe can turn a page

    function handleWheel(e: WheelEvent) {
        if (isDrawing || popupState.popupId !== null || quickEditOpen) return

        const isHorizontal = Math.abs(e.deltaX) >= Math.abs(e.deltaY)
        if (isHorizontal || e.shiftKey) {
            e.preventDefault()
        }

        const now = Date.now()
        if (now - lastWheelPageTurnTime < WHEEL_COOLDOWN) return

        const deltaX = isHorizontal ? e.deltaX : e.shiftKey ? e.deltaY : 0
        wheelDeltaXAccumulator += deltaX

        if (wheelDeltaXAccumulator > WHEEL_SWIPE_THRESHOLD) {
            lastWheelPageTurnTime = now
            wheelDeltaXAccumulator = 0
            goToNextPage()
        } else if (wheelDeltaXAccumulator < -WHEEL_SWIPE_THRESHOLD) {
            lastWheelPageTurnTime = now
            wheelDeltaXAccumulator = 0
            goToPrevPage()
        }
    }

    function getTransitionDuration(): number {
        const speed = storage.settings.paperOptions?.pageAnimation ?? "fast"
        if (speed === "none") return 0
        if (speed === "slow") return 400
        return 120
    }

    function setPositionByIndex(animate = true) {
        if (!sliderEl) return
        if (transitionTimer !== null) {
            clearTimeout(transitionTimer)
            transitionTimer = null
        }
        const viewportWidth = window.innerWidth
        currentTranslate = -currentPageIndex * viewportWidth
        prevTranslate = currentTranslate

        const duration = animate ? getTransitionDuration() : 0
        sliderEl.style.transition = duration > 0 ? `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)` : "none"
        sliderEl.style.transform = `translate3d(${currentTranslate}px, 0, 0)`

        if (duration > 0) {
            transitionTimer = setTimeout(() => {
                if (sliderEl) sliderEl.style.transition = ""
                transitionTimer = null
            }, duration)
        } else {
            sliderEl.style.transition = ""
        }

        detectSongAndPage()
    }

    let visibleSongId = $derived.by<string | null>(() => {
        const pageCount = pageSongMap.length
        const globalIndex = pageCount > 0 ? Math.max(0, Math.min(currentPageIndex, pageCount - 1)) : currentPageIndex
        return (pageCount > 0 ? pageSongMap[globalIndex] : slides[globalIndex]?.type === "song" ? slides[globalIndex].songItem.id : null) ?? null
    })
    let songPageIndex = $derived.by<number>(() => {
        const pageCount = pageSongMap.length
        const globalIndex = pageCount > 0 ? Math.max(0, Math.min(currentPageIndex, pageCount - 1)) : currentPageIndex
        return pageIndexMap[globalIndex] ?? 0
    })

    function detectSongAndPage(index = currentPageIndex) {
        const pageCount = pageSongMap.length
        const globalIndex = pageCount > 0 ? Math.max(0, Math.min(index, pageCount - 1)) : index
        const songIndexInList = pageSongIndexMap[globalIndex] ?? globalIndex

        lastActiveOriginalIndex = songIndexInList
        lastActivePageInSong = pageIndexMap[globalIndex] ?? 0
        lastActiveSongId = (pageCount > 0 ? pageSongMap[globalIndex] : slides[globalIndex]?.type === "song" ? slides[globalIndex].songItem.id : null) ?? null

        if (initialPositionConsumed && songIndexInList >= 0 && (list ? songIndexInList < list.songs.length : songIndexInList < slides.length)) {
            savedFullscreenPosition.index = songIndexInList
        }
    }

    const isExternalPlan = $derived((!!listId && !storage.getListById(listId, storage.lists) && !!getPlanAsList(listId)) || (!storage.getSongById(visibleSongId ?? null, storage.songs) && !!getExternalSong(visibleSongId ?? null)))

    let visibleSong = $derived(visibleSongId ? storage.getSongById(visibleSongId, storage.songs) || getExternalSong(visibleSongId) : null)

    // Metronome
    let visibleSongTempo = $derived(Number(visibleSong?.getMetadata?.("tempo")?.match(/\d+/)?.[0]) || null)
    let visibleSongTimeSig = $derived(Number(visibleSong?.getMetadata?.("timeSignature")?.match(/^(\d+)/)?.[1]) || null)
    let isMetronomeOutOfSync = $derived(!!visibleSong && ((visibleSongTempo !== null && visibleSongTempo !== metronomeState.bpm) || (visibleSongTimeSig !== null && visibleSongTimeSig !== metronomeState.beatsPerBar)))
    function syncMetronomeWithSong() {
        if (visibleSongTempo) metronomeState.bpm = visibleSongTempo
        if (visibleSongTimeSig) metronomeState.beatsPerBar = visibleSongTimeSig
    }

    let visiblePlaybackUrl = $derived(visibleSong?.playbackUrl || visibleSong?.spotify || visibleSong?.getMetadata("playback") || visibleSong?.getMetadata("spotify") || "")
    let visiblePlaybackInfo = $derived(parsePlaybackUrl(visiblePlaybackUrl))
    let isPlayingVisibleSong = $derived(playbackState.isOpen && !!visibleSong && (playbackState.songId === visibleSong.id || (!!visiblePlaybackUrl && playbackState.customPlaybackUrl === visiblePlaybackUrl)))

    const { schedule: scheduleUpdatePageCount, scheduleDebounced: scheduleDebouncedUpdatePageCount, cancel: cancelUpdatePageCount } = createRafScheduler((immediatePosition = false) => {
        updatePageCount()
        if (immediatePosition) setPositionByIndex(false)
    })

    // --- Lifecycle & DOM Observation ---
    let hasBeenFullscreen = false
    let hasShownPwaDrawHint = false

    onMount(() => {
        requestWakeLock()

        if (isFullscreenActive()) {
            hasBeenFullscreen = true
        }

        let isExitingSong = false

        function handleFullscreenExit() {
            if (isExitingSong) return
            isExitingSong = true
            exitSongFullscreen()
        }

        const removeFullscreenListener = onFullscreenChange((isActive) => {
            if (isActive) {
                hasBeenFullscreen = true
            } else if (hasBeenFullscreen) {
                if (isDrawing) {
                    hasBeenFullscreen = false
                    // in iOS Safari, dragging down with one finger exits fullscreen, nothing to do about it if not in PWA
                    if (!hasShownPwaDrawHint && isIosSafariNonStandalone()) {
                        hasShownPwaDrawHint = true
                        showToast(t("pwa", "draw_pwa_recommendation"), "info", 6000)
                        openIosPrompt()
                    }
                    return
                }
                if (isIos()) {
                    hasBeenFullscreen = false
                    return
                }

                // If user leaves fullscreen (e.g. via browser UI, Esc key, swipe), exit song fullscreen cleanly
                handleFullscreenExit()
            }
        })

        let lastSliderWidth = sliderEl?.clientWidth || 0
        let lastSliderHeight = sliderEl?.clientHeight || 0

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (entry) {
                const { width, height } = entry.contentRect

                // If on-screen virtual keyboard is currently open, skip recalculating pagination
                if (isVirtualKeyboardOpen()) return

                const widthUnchanged = Math.abs(width - lastSliderWidth) < 1
                const heightUnchanged = Math.abs(height - lastSliderHeight) < 1
                lastSliderWidth = width
                lastSliderHeight = height

                if (widthUnchanged && heightUnchanged) return
            }
            // Debounce pagination and position adjustments during continuous resize
            scheduleDebouncedUpdatePageCount(120, true)
        })

        if (sliderEl) {
            resizeObserver.observe(sliderEl)
        }

        updatePageCount()
        setPositionByIndex(false)

        window.addEventListener("wheel", handleWheel, { passive: false })

        return () => {
            clearTimeout(hideTimeout)
            cancelUpdatePageCount()
            if (transitionTimer !== null) clearTimeout(transitionTimer)
            if (moveRafId !== null) cancelAnimationFrame(moveRafId)
            window.removeEventListener("wheel", handleWheel)
            removeFullscreenListener()
            resizeObserver.disconnect()
            releaseWakeLock()
            exitFullscreen()
        }
    })
</script>

<svelte:window onclick={windowClick} onkeydown={handleKeydown} ontouchstart={handleTouchStart} ontouchmove={handleTouchMove} ontouchend={() => (initialPinchDist = 0)} ontouchcancel={() => (initialPinchDist = 0)} />

{#if actionsVisible}
    <header transition:slide={{ duration: 200, axis: "y" }}>
        <div class="actions">
            <md-icon-button onclick={exitSongFullscreen} aria-label="Back">
                <md-icon>arrow_back</md-icon>
            </md-icon-button>

            {#if slides.length > 0}
                <div class="more-menu-wrapper">
                    <md-icon-button
                        id="fullscreen-song-list-btn"
                        aria-label={t("pages", "list")}
                        title={t("pages", "list")}
                        onclick={() => {
                            songListMenuOpen = !songListMenuOpen
                            clearTimeout(hideTimeout)
                        }}
                    >
                        <md-icon>queue_music</md-icon>
                    </md-icon-button>

                    <md-menu id="fullscreen-song-list-menu" anchor="fullscreen-song-list-btn" open={songListMenuOpen} onclosed={() => (songListMenuOpen = false)} class="song-list-menu" quick>
                        {#each slides as item, idx}
                            {#if item.type === "song"}
                                {@const song = storage.getSongById(item.songItem.id ?? null, storage.songs) || getExternalSong(item.songItem.id ?? null)}
                                {@const isCurrent = currentSlideIndex === idx}
                                <md-menu-item selected={isCurrent} class:selected={isCurrent} onclick={() => goToSong(item.originalIndex)}>
                                    <span class="material-symbols-outlined" slot="start" style="font-size: 20px; opacity: 0.7;">music_note</span>
                                    <div slot="headline" class="song-menu-headline" class:selected-headline={isCurrent}>
                                        {song?.name || item.songItem.name || "Untitled"}
                                    </div>
                                    {#if isCurrent}
                                        <span class="material-symbols-outlined" slot="end" style="color: var(--md-sys-color-primary); font-size: 18px;">check</span>
                                    {/if}
                                </md-menu-item>
                            {:else if item.type === "section"}
                                {@const isCurrent = currentSlideIndex === idx}
                                <md-menu-item selected={isCurrent} class="menu-section-item" class:selected={isCurrent} onclick={() => goToSong(item.originalIndex)}>
                                    <span class="material-symbols-outlined menu-section-icon" slot="start" style="font-size: 20px; opacity: 0.7;">bookmark</span>
                                    <div slot="headline" class="menu-section-text" class:selected-headline={isCurrent}>
                                        {item.sections.map((s) => s.name).join(" / ")}
                                    </div>
                                    {#if isCurrent}
                                        <span class="material-symbols-outlined" slot="end" style="color: var(--md-sys-color-primary); font-size: 18px;">check</span>
                                    {/if}
                                </md-menu-item>
                            {/if}
                        {/each}
                    </md-menu>
                </div>
            {/if}

            <div style="flex:1"></div>

            <MetronomeButton />
            {#if visibleSongId}
                <TransposeButton />

                <md-icon-button
                    onclick={() => {
                        isDrawing = true
                        actionsVisible = false
                        clearTimeout(hideTimeout)
                        setPositionByIndex(false)
                    }}
                    aria-label="Draw"
                >
                    <md-icon>gesture</md-icon>
                </md-icon-button>
            {/if}

            <div class="more-menu-wrapper">
                <md-icon-button
                    id="fullscreen-more-btn"
                    aria-label={t("menu", "more_options")}
                    onclick={() => {
                        moreMenuOpen = !moreMenuOpen
                        clearTimeout(hideTimeout)
                    }}
                >
                    <md-icon>more_vert</md-icon>
                </md-icon-button>

                <md-menu id="fullscreen-more-menu" anchor="fullscreen-more-btn" open={moreMenuOpen} onclosed={() => (moreMenuOpen = false)} quick>
                    {#if visiblePlaybackInfo && visibleSong}
                        <md-menu-item
                            onclick={() => {
                                moreMenuOpen = false
                                if (visibleSong) togglePlayback(visibleSong.id, visiblePlaybackUrl, visibleSong.name, true)
                            }}
                        >
                            {#if visiblePlaybackInfo.provider === "spotify"}
                                <span slot="start" style="display: inline-flex; align-items: center;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={isPlayingVisibleSong ? "#1DB954" : "currentColor"}>
                                        <path
                                            d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.307c-.216.353-.674.466-1.027.25-2.822-1.724-6.374-2.115-10.559-1.159-.404.093-.807-.16-.9-.564-.092-.404.161-.807.564-.9 4.582-1.047 8.514-.606 11.672 1.346.353.216.466.674.25 1.027zm1.465-3.262c-.272.441-.849.582-1.29.31-3.23-1.986-8.155-2.56-11.977-1.4-4.99.151-.989-.138-1.14-.637-.152-.499.138-.989.637-1.14 4.381-1.33 9.807-.687 13.46 1.577.441.272.582.849.31 1.29zm.126-3.41c-3.874-2.3-10.264-2.512-13.97-1.386-.595.181-1.226-.157-1.407-.752-.181-.595.157-1.226.752-1.407 4.257-1.293 11.31-1.045 15.772 1.603.535.318.708 1.01.39 1.545-.318.535-1.01.708-1.545.39z"
                                        />
                                    </svg>
                                </span>
                            {:else if visiblePlaybackInfo.provider === "youtube"}
                                <span slot="start" style="display: inline-flex; align-items: center;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={isPlayingVisibleSong ? "#FF0000" : "currentColor"}>
                                        <path
                                            d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                                        />
                                    </svg>
                                </span>
                            {:else}
                                <span class="material-symbols-outlined" slot="start" style={isPlayingVisibleSong ? "color: var(--md-sys-color-primary, #6750a4);" : ""}>play_circle</span>
                            {/if}
                            <div slot="headline">
                                {isPlayingVisibleSong ? t("common", "close") + " " + t("song_edit", "play").toLowerCase() : t("song_edit", "play")}
                            </div>
                        </md-menu-item>
                    {/if}

                    {#if visibleSongId && !isExternalPlan}
                        <md-menu-item
                            onclick={() => {
                                moreMenuOpen = false
                                quickEditOpen = true
                            }}
                        >
                            <span class="material-symbols-outlined" slot="start">edit_note</span>
                            <div slot="headline">{t("common", "edit")}</div>
                        </md-menu-item>
                    {/if}

                    <md-menu-item
                        onclick={() => {
                            moreMenuOpen = false
                            setActivePopup("settings")
                        }}
                    >
                        <span class="material-symbols-outlined" slot="start">tune</span>
                        <div slot="headline">{t("song_fullscreen", "settings_title")}</div>
                    </md-menu-item>
                </md-menu>
            </div>
        </div>
    </header>

    <footer transition:slide={{ duration: 200, axis: "y" }}>
        {#if totalPages > 30}
            <div class="progress-number">
                {currentPageIndex + 1}/{totalPages}
            </div>
        {:else}
            {@const songGroups = (() => {
                const groups: Array<{ key: string | number; pages: number[]; isCurrentSong: boolean }> = []
                let currentGroup: { key: string | number; pages: number[]; isCurrentSong: boolean } | null = null

                for (let i = 0; i < totalPages; i++) {
                    const songId = pageSongMap[i]
                    const songOrigIdx = pageSongIndexMap[i]
                    const groupKey = songId ?? `idx_${songOrigIdx ?? i}`

                    if (!currentGroup || currentGroup.key !== groupKey) {
                        currentGroup = {
                            key: groupKey,
                            pages: [i],
                            isCurrentSong: false
                        }
                        groups.push(currentGroup)
                    } else {
                        currentGroup.pages.push(i)
                    }
                }

                for (const group of groups) {
                    group.isCurrentSong = group.pages.includes(currentPageIndex)
                }

                return groups
            })()}
            <div class="progress">
                {#each songGroups as group}
                    {#if group.pages.length > 1}
                        <div class="song-dot-group" class:active-song={group.isCurrentSong}>
                            {#each group.pages as pageIdx}
                                <button
                                    type="button"
                                    class="dot"
                                    class:active={pageIdx === currentPageIndex}
                                    class:same-song={group.isCurrentSong && pageIdx !== currentPageIndex}
                                    aria-label={`Page ${pageIdx + 1}`}
                                    onclick={(e) => {
                                        e.stopPropagation()
                                        if (pageIdx !== currentPageIndex) {
                                            currentPageIndex = pageIdx
                                            setPositionByIndex(true)
                                        }
                                    }}
                                ></button>
                            {/each}
                        </div>
                    {:else}
                        {@const pageIdx = group.pages[0]}
                        {@const origIdx = pageSongIndexMap[pageIdx]}
                        {@const isSection = origIdx != null && slides.some((s) => s.type === "section" && (s.originalIndex === origIdx || s.sections.some((sec) => sec.originalIndex === origIdx)))}
                        <button
                            type="button"
                            class="dot"
                            class:section-dot={isSection}
                            class:active={pageIdx === currentPageIndex}
                            aria-label={isSection ? `Section ${pageIdx + 1}` : `Page ${pageIdx + 1}`}
                            onclick={(e) => {
                                e.stopPropagation()
                                if (pageIdx !== currentPageIndex) {
                                    currentPageIndex = pageIdx
                                    setPositionByIndex(true)
                                }
                            }}
                        >
                            {#if isSection}
                                <span class="material-symbols-outlined section-dot-icon">bookmark</span>
                            {/if}
                        </button>
                    {/if}
                {/each}
            </div>
        {/if}
    </footer>
{/if}

<main>
    <div class="slider-viewport">
        <div
            class="slider"
            role="region"
            aria-label="Song carousel"
            bind:this={sliderEl}
            use:initSlider
            onpointerdown={pointerDown}
            onpointermove={pointerMove}
            onpointerup={pointerUp}
            onpointercancel={pointerUp}
            onlostpointercapture={pointerUp}
            style:touch-action="none"
        >
            {#each slides as slideItem, i}
                {#if slideItem.type === "song"}
                    {@const songId = slideItem.songItem?.id ?? null}
                    {@const song = storage.getSongById(songId, storage.songs) || getExternalSong(songId)}
                    {@const targetKey = slideItem.songItem?.transposed || song?.lastTransposed}
                    {@const hasMedia = !!song?.images.length}

                    {@const customBg = storage.settings.paperOptions?.background || "white"}
                    {@const paperBg = hasMedia ? "black" : customBg}
                    {@const fontScale = (storage.settings.paperOptions?.fontSize ?? 100) / 100}
                    {@const chordColor = storage.settings.paperOptions?.chordColor || "#5498be"}

                    <div class="slide" style="--font-scale: {fontScale}; --chord-color: {chordColor};">
                        <Paper padding={hasMedia ? 0 : 10} background={paperBg} headerText={song?.name ?? ""} {fontScale} {chordColor} onPaginate={() => scheduleUpdatePageCount(false)}>
                            <ChordPro {songId} {targetKey} numColumns={2} hideChords={fullscreenState.lyricsOnly} showMeta />
                        </Paper>
                    </div>
                {:else if slideItem.type === "section"}
                    {@const customBg = storage.settings.paperOptions?.background || "white"}
                    <div class="slide">
                        <Paper padding={16} background={customBg} headerText="" onPaginate={() => scheduleUpdatePageCount(false)}>
                            <div class="fullscreen-section-container">
                                <div class="fullscreen-section-badge">
                                    <span class="material-symbols-outlined fullscreen-section-icon">bookmark</span>
                                </div>
                                <div class="fullscreen-sections-list">
                                    {#each slideItem.sections as sec, sIdx}
                                        <div class="fullscreen-section-title">{sec.name}</div>
                                        {#if sIdx < slideItem.sections.length - 1}
                                            <div class="fullscreen-section-divider"></div>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        </Paper>
                    </div>
                {/if}
            {/each}
        </div>

        {#if visibleSong}
            {@const drawingData = visibleSong.drawings?.[songPageIndex]}
            {#if isDrawing || !!drawingData}
                {#key visibleSong.id + ":" + songPageIndex}
                    <Draw
                        editable={isDrawing}
                        initialData={drawingData || ""}
                        onChange={(dataUrl) => {
                            if (!visibleSong.drawings) visibleSong.drawings = []
                            visibleSong.drawings[songPageIndex] = dataUrl
                        }}
                        onFinish={(dataUrl) => {
                            if (!visibleSong.drawings) visibleSong.drawings = []
                            visibleSong.drawings[songPageIndex] = dataUrl
                            storage.updateSong(visibleSong)
                            isDrawing = false
                            setPositionByIndex(false)
                            if (!isFullscreenActive()) enterFullscreen()
                        }}
                    />
                {/key}
            {/if}
        {/if}

        <!-- Metronome -->
        {#if metronomeState.isPlaying}
            <div class="metronome-state">
                {#if metronomeState.soundType === "silent"}
                    <div class="silent-metronome-indicator">
                        <div class="silent-dots-container">
                            {#each Array(metronomeState.beatsPerBar) as _, i}
                                <div class="silent-beat-dot" class:accent={i === 0} class:active={metronomeState.currentBeat === i}></div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if isMetronomeOutOfSync}
                    <button
                        type="button"
                        class="sync-metronome-btn"
                        onclick={(e) => {
                            e.stopPropagation()
                            syncMetronomeWithSong()
                        }}
                    >
                        <span class="material-symbols-outlined sync-icon">sync</span>
                        {#if visibleSongTempo}
                            <span class="sync-tempo-label">{visibleSongTempo}</span>
                        {/if}
                    </button>
                {/if}
            </div>
        {/if}
    </div>
</main>

<QuickEditSongDialog open={quickEditOpen} songId={visibleSongId} onClose={() => (quickEditOpen = false)} />

<style>
    header {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 1000;

        display: flex;
        padding-top: calc(20px + env(safe-area-inset-top, 0px));
        padding-bottom: 50px;

        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
        --md-icon-button-icon-color: white;
        --md-icon-button-hover-icon-color: white;
        --md-icon-button-selected-icon-color: var(--md-sys-color-primary, #f5aa67);
    }

    footer {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        z-index: 1000;

        display: flex;
        padding: 20px;
        padding-top: 50px;

        background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0));
    }

    main {
        margin: 0;
        border-radius: 0;
        height: 100%;
        background-color: black;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .slider-viewport {
        position: relative;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        overscroll-behavior: none;
        overscroll-behavior-y: none;
    }

    /* Metronome */

    .metronome-state {
        position: absolute;
        top: calc(10px + env(safe-area-inset-top, 0px));
        left: 50%;
        transform: translateX(-50%);

        display: flex;
        align-items: center;
        gap: 8px;

        z-index: 50;
        pointer-events: none;
    }

    .silent-metronome-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 14px;
        background: rgba(18, 18, 18, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        z-index: 50;
        pointer-events: none;
        box-shadow:
            0 3px 12px rgba(0, 0, 0, 0.3),
            0 1px 4px rgba(0, 0, 0, 0.2);
    }

    .silent-dots-container {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .silent-beat-dot {
        width: 26px;
        height: 2px;
        border-radius: 1px;
        background: rgba(255, 255, 255, 0.25);
        transition:
            transform 0.08s ease,
            background 0.08s ease,
            box-shadow 0.08s ease,
            opacity 0.08s ease;
    }

    .silent-beat-dot.accent {
        width: 32px;
        height: 2px;
        background: rgba(255, 255, 255, 0.35);
    }

    .silent-beat-dot.active {
        background: var(--md-sys-color-primary, #f5aa67);
        transform: scaleY(2);
        box-shadow: 0 0 10px var(--md-sys-color-primary, #f5aa67);
    }

    .silent-beat-dot.accent.active {
        background: var(--md-sys-color-primary, #f5aa67);
        transform: scaleY(2.2) scaleX(1.04);
        box-shadow: 0 0 14px var(--md-sys-color-primary, #f5aa67);
    }

    .sync-metronome-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;

        color: black;
        background: rgba(18, 18, 18, 0.1);
        border: 2px solid rgba(0, 0, 0, 0.7);
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 7px;
        cursor: pointer;
        pointer-events: auto;
        user-select: none;
        outline: none;
        transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.15s ease;
    }

    .sync-metronome-btn:hover {
        background: rgba(255, 255, 255, 0.22);
        border-color: rgba(255, 255, 255, 0.35);
    }

    .sync-metronome-btn:active {
        transform: scale(0.95);
    }

    .sync-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .sync-tempo-label {
        font-family: inherit;
        line-height: 1;
        letter-spacing: 0.2px;
    }

    .slider {
        display: flex;
        height: 100%;
        will-change: transform;
    }

    .slide {
        display: flex;
        flex-direction: row;
        height: 100vh;
        height: 100dvh;
        box-sizing: border-box;
        flex-shrink: 0;
        contain: layout paint;
    }

    /* Horizontal pagination container */
    .slider-viewport :global(.pages-stack) {
        display: flex !important;
        flex-direction: row !important;
        gap: 0 !important;
        width: auto !important;
        height: 100vh !important;
        height: 100dvh !important;
        align-items: center !important;
    }

    /* Individual A-Paper Page */
    .slider-viewport :global(.paper-page) {
        --margin-x: 10px;
        --margin-y: 10px;

        @media (max-width: 600px) {
            --margin-x: 0px;
            --margin-y: 6px;
        }

        /* Height fills the screen (leaving room for top/bottom margins) */
        height: calc(100vh - var(--margin-y)) !important;
        height: calc(100dvh - var(--margin-y)) !important;
        max-height: calc(100vh - var(--margin-y)) !important;
        max-height: calc(100dvh - var(--margin-y)) !important;

        /* Width adheres to A4 aspect ratio (210/297), constrained by screen width */
        width: auto !important;
        max-width: calc(100vw - var(--margin-x)) !important;
        aspect-ratio: 210 / 297;

        /* Calculate exact rendered paper width */
        --paper-w: min(calc((100dvh - var(--margin-y)) * (210 / 297)), calc(100vw - var(--margin-x)));

        /* Auto-calculate side margins so total slot footprint = 100vw */
        margin-left: calc((100vw - var(--paper-w)) / 2) !important;
        margin-right: calc((100vw - var(--paper-w)) / 2) !important;

        flex-shrink: 0 !important;
        box-sizing: border-box !important;
        /* box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important; */
        border-radius: 2px !important;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 0 calc(20px + env(safe-area-inset-right, 0px)) 0 calc(20px + env(safe-area-inset-left, 0px));
    }

    .fullscreen-section-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        min-height: 250px;
        gap: 28px;
        padding: 40px 24px;
        box-sizing: border-box;
        text-align: center;
        color: var(--paper-text-color, inherit);
    }

    .fullscreen-sections-list {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        width: 100%;
    }

    .fullscreen-section-badge {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: rgba(128, 128, 128, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .fullscreen-section-icon {
        color: inherit;
        font-size: 28px;
    }

    .fullscreen-section-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: inherit;
        letter-spacing: 0.5px;
        line-height: 1.25;
        max-width: 90%;
        word-break: break-word;
    }

    .fullscreen-section-divider {
        width: 60px;
        height: 2px;
        background-color: currentColor;
        opacity: 0.25;
        border-radius: 1px;
    }

    .progress {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 14px;
        display: flex;
        align-items: center;
        gap: 5px;
        z-index: 1001;
        pointer-events: auto;
        padding: 4px;
    }

    .song-dot-group {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 3px;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        transition:
            background 160ms ease,
            border-color 160ms ease;
    }

    .song-dot-group.active-song {
        background: rgba(255, 255, 255, 0.18);
        border-color: rgba(255, 255, 255, 0.38);
    }

    .progress-number {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 16px;
        z-index: 1001;
        pointer-events: none;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.9);
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 4px 12px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        user-select: none;
    }

    .dot {
        position: relative;
        width: 8px;
        height: 8px;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.35);
        cursor: pointer;
        outline: none;
        transition:
            transform 160ms ease,
            background 160ms ease,
            opacity 160ms ease;
        opacity: 0.95;
    }

    .dot::before {
        content: "";
        position: absolute;
        top: -8px;
        bottom: -8px;
        left: -4px;
        right: -4px;
    }

    .dot:hover {
        background: rgba(255, 255, 255, 0.7);
        transform: scale(1.2);
    }

    .dot.same-song {
        background: rgba(255, 255, 255, 0.65);
    }

    .dot.active {
        background: white;
        transform: scale(1.4);
        opacity: 1;
    }

    .dot.section-dot {
        width: 14px;
        height: 14px;
        background: transparent;
        border-radius: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.55);
        transition:
            transform 160ms ease,
            color 160ms ease,
            opacity 160ms ease;
    }

    .dot.section-dot .section-dot-icon {
        font-size: 13px;
        line-height: 1;
        font-variation-settings: 'FILL' 1;
    }

    .dot.section-dot:hover {
        background: transparent;
        color: rgba(255, 255, 255, 0.85);
        transform: scale(1.2);
    }

    .dot.section-dot.active {
        background: transparent;
        color: white;
        transform: scale(1.3);
        opacity: 1;
    }

    .more-menu-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    md-menu {
        min-width: 180px;
    }

    md-menu.song-list-menu {
        min-width: 220px;
        max-width: 320px;
        max-height: 70vh;
        overflow-x: hidden !important;
        --md-menu-item-one-line-container-height: 38px;
        --md-menu-item-top-space: 4px;
        --md-menu-item-bottom-space: 4px;
    }

    md-menu-item {
        white-space: nowrap;
    }

    md-menu.song-list-menu md-menu-item {
        min-height: 38px;
        max-width: 100%;
        overflow: hidden;
        --md-menu-item-one-line-container-height: 38px;
        --md-menu-item-top-space: 4px;
        --md-menu-item-bottom-space: 4px;
    }

    .song-menu-headline {
        display: block;
        max-width: 100%;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
    }

    md-menu-item.selected {
        background-color: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.08));
    }

    .selected-headline {
        font-weight: 600;
        color: var(--md-sys-color-primary);
    }

    md-menu.song-list-menu md-menu-item.menu-section-item {
        min-height: 28px;
        --md-menu-item-one-line-container-height: 28px;
        --md-menu-item-top-space: 2px;
        --md-menu-item-bottom-space: 2px;
        opacity: 0.85;
    }

    .menu-section-icon {
        font-size: 20px;
        opacity: 0.7;
    }

    .menu-section-text {
        display: block;
        max-width: 100%;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
    }
</style>
