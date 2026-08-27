<script lang="ts">
    import type { ListSongItem } from "$lib/models/List"
    import { t } from "$lib/state/i18n.svelte"
    import { fullscreenState, goBack, menuState, popupState, savedFullscreenPosition, setActivePage, setActivePopup, setFullscreenLyricsOnly } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { exitFullscreen, isFullscreenActive, toggleFullscreen } from "$lib/utils/fullscreen"
    import { releaseWakeLock, requestWakeLock } from "$lib/utils/wakeLock"
    import { onMount } from "svelte"
    import { slide } from "svelte/transition"
    import Draw from "../draw/Draw.svelte"
    import ChordPro from "../song/ChordPro.svelte"
    import Paper from "../song/Paper.svelte"
    import TransposeButton from "../song/TransposeButton.svelte"

    type FullscreenSlide = { type: "song"; songItem: ListSongItem; originalIndex: number } | { type: "section"; sections: Array<{ name: string; originalIndex: number }>; originalIndex: number }

    // --- State & Derived State ---
    const listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId)
    const list = $derived(listId ? storage.getListById(listId, storage.lists) : null)

    const slides = $derived.by<FullscreenSlide[]>(() => {
        if (!list) {
            return menuState.contentId ? [{ type: "song", songItem: { songId: menuState.contentId }, originalIndex: 0 }] : []
        }

        const result: FullscreenSlide[] = []
        let currentSections: Array<{ name: string; originalIndex: number }> = []
        let firstSectionIdx = -1

        for (let i = 0; i < list.songs.length; i++) {
            const item = list.songs[i]
            if (item.isSection) {
                if (currentSections.length === 0) {
                    firstSectionIdx = i
                }
                currentSections.push({ name: item.name || "Section", originalIndex: i })
            } else if (item.songId) {
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
    let hideTimeout: ReturnType<typeof setTimeout> | undefined

    // Carousel state
    let currentPageIndex = $state(savedFullscreenPosition.pageIndex ?? savedFullscreenPosition.index ?? 0)
    let totalPages = $state(1)
    let sliderEl = $state<HTMLDivElement | null>(null)

    // Gesture tracking state
    let isDragging = false
    let startX = 0
    let currentTranslate = 0
    let prevTranslate = 0
    let didDrag = false

    // Dynamic pagination mappings
    let pageSongMap: Array<string | null> = []
    let pageIndexMap: number[] = []
    let pageSongIndexMap: number[] = []
    let songPageId = $state("")
    let previousPage = -1

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

    let moreMenuOpen = $state(false)

    // --- Actions Header Toggle & Click Navigation ---
    function windowClick(e: MouseEvent) {
        if (didDrag) return
        if (popupState.popupId !== null) return
        const target = e.target as HTMLElement | null
        if (
            target?.closest("header") ||
            target?.closest("footer") ||
            target?.closest("md-icon-button") ||
            target?.closest("md-menu") ||
            target?.closest("md-menu-item") ||
            target?.closest("md-dialog") ||
            target?.closest(".md-dialog") ||
            target?.closest("[role='dialog']")
        )
            return

        const screenWidth = window.innerWidth
        const clickX = e.clientX
        const ratio = clickX / screenWidth

        // Center 1/5 (40% - 60%) toggles action buttons
        if (ratio >= 0.4 && ratio <= 0.6) {
            toggleActions()
        } else if (ratio < 0.4) {
            goToPrevPage()
        } else {
            goToNextPage()
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowLeft") {
            goToPrevPage()
        } else if (e.key === "ArrowRight" || e.key === " ") {
            goToNextPage()
        }
    }

    let initialPositionConsumed = false

    // --- Page Counting & Mapping ---
    function updatePageCount() {
        if (!sliderEl) return

        const pages = Array.from(sliderEl.querySelectorAll<HTMLElement>(".paper-page"))
        const slideEls = Array.from(sliderEl.querySelectorAll<HTMLElement>(".slide"))

        totalPages = pages.length || slideEls.length || 1
        const isRealLayout = pages.length > 0

        if (isRealLayout) {
            pageSongMap = pages.map((page) => {
                const slideEl = page.closest(".slide") as HTMLElement | null
                const index = slideEl ? slideEls.indexOf(slideEl) : -1
                const slideItem = slides[index]
                if (!slideItem) return null
                return slideItem.type === "song" ? (slideItem.songItem.songId ?? null) : null
            })

            pageIndexMap = pages.map((page) => {
                const slideEl = page.closest(".slide")
                return slideEl ? Array.from(slideEl.querySelectorAll(".paper-page")).indexOf(page) : 0
            })

            pageSongIndexMap = pages.map((page) => {
                const slideEl = page.closest(".slide") as HTMLElement | null
                const index = slideEl ? slideEls.indexOf(slideEl) : 0
                const slideItem = slides[index]
                return slideItem?.originalIndex ?? index
            })
        } else {
            pageSongMap = slides.map((s) => (s.type === "song" ? (s.songItem.songId ?? null) : null))
            pageIndexMap = slides.map(() => 0)
            pageSongIndexMap = slides.map((s, i) => s.originalIndex ?? i)
        }

        if (!initialPositionConsumed) {
            restoreInitialPosition(isRealLayout)
        } else if (currentPageIndex >= totalPages) {
            currentPageIndex = Math.max(0, totalPages - 1)
            setPositionByIndex()
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
        }
    }

    // --- Drag & Touch Handlers ---
    function pointerDown(e: PointerEvent) {
        isDragging = true
        didDrag = false
        startX = e.clientX
        sliderEl?.setPointerCapture?.(e.pointerId)
    }

    function pointerMove(e: PointerEvent) {
        if (!isDragging || !sliderEl) return
        const delta = e.clientX - startX
        if (Math.abs(delta) > 6) didDrag = true
        currentTranslate = prevTranslate + delta
        sliderEl.style.transform = `translateX(${currentTranslate}px)`
    }

    function pointerUp(e: PointerEvent) {
        if (!isDragging || !sliderEl) return
        isDragging = false

        const movedBy = currentTranslate - prevTranslate
        const viewportWidth = sliderEl.parentElement?.clientWidth || window.innerWidth
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

    function setPositionByIndex(animate = true) {
        if (!sliderEl) return
        const viewportWidth = sliderEl.parentElement?.clientWidth || window.innerWidth
        currentTranslate = -currentPageIndex * viewportWidth
        prevTranslate = currentTranslate

        sliderEl.style.transition = animate ? "transform 300ms ease" : "none"
        sliderEl.style.transform = `translateX(${currentTranslate}px)`

        if (animate) {
            setTimeout(() => {
                if (sliderEl) sliderEl.style.transition = ""
            }, 300)
        }

        detectSongAndPage()
    }

    let visibleSongId: string | null = $state(null)
    let songPageIndex = $state(0)
    function detectSongAndPage(index = currentPageIndex) {
        const pageCount = pageSongMap.length
        const globalIndex = pageCount > 0 ? Math.max(0, Math.min(index, pageCount - 1)) : index
        const songId = (pageCount > 0 ? pageSongMap[globalIndex] : slides[globalIndex]?.type === "song" ? slides[globalIndex].songItem.songId : null) ?? null
        const pageInSong = pageIndexMap[globalIndex] ?? 0
        const songIndexInList = pageSongIndexMap[globalIndex] ?? globalIndex

        if (initialPositionConsumed && songIndexInList >= 0 && (list ? songIndexInList < list.songs.length : songIndexInList < slides.length)) {
            savedFullscreenPosition.index = songIndexInList
        }

        const newSongPageId = `${songId}:${pageInSong}`
        if (songPageId !== newSongPageId || visibleSongId !== songId || songPageIndex !== pageInSong || globalIndex !== previousPage) {
            previousPage = globalIndex
            songPageId = newSongPageId

            visibleSongId = songId
            songPageIndex = pageInSong
        }
    }

    let isNativeFullscreen = $state(false)

    async function handleToggleFullscreen() {
        await toggleFullscreen()
        isNativeFullscreen = isFullscreenActive()
    }

    // --- Lifecycle & DOM Observation ---
    onMount(() => {
        isNativeFullscreen = isFullscreenActive()
        requestWakeLock()

        const resizeObserver = new ResizeObserver(() => {
            updatePageCount()
            setPositionByIndex(false)
        })

        if (sliderEl) {
            resizeObserver.observe(sliderEl)
        }

        const mutationObserver = new MutationObserver(() => {
            updatePageCount()
        })

        if (sliderEl) {
            mutationObserver.observe(sliderEl, {
                childList: true,
                subtree: true,
                attributes: true
            })
        }

        updatePageCount()
        setPositionByIndex(false)

        return () => {
            resizeObserver.disconnect()
            mutationObserver.disconnect()
            releaseWakeLock()
            exitFullscreen()
        }
    })
</script>

<svelte:window onclick={windowClick} onkeydown={handleKeydown} />

{#if actionsVisible}
    <header transition:slide={{ duration: 200, axis: "y" }}>
        <div class="actions">
            <md-icon-button
                onclick={() => {
                    savedFullscreenPosition.pageIndex = currentPageIndex
                    savedFullscreenPosition.index = pageSongIndexMap[currentPageIndex] ?? 0
                    goBack()
                }}
                aria-label="Back"
            >
                <md-icon>arrow_back</md-icon>
            </md-icon-button>

            <div style="flex:1"></div>

            {#if visibleSongId}
                <TransposeButton />

                <md-icon-button
                    toggle
                    selected={fullscreenState.lyricsOnly}
                    onclick={() => setFullscreenLyricsOnly(!fullscreenState.lyricsOnly)}
                    aria-label={fullscreenState.lyricsOnly ? t("song_fullscreen", "show_chords") : t("song_fullscreen", "lyrics_only")}
                    title={fullscreenState.lyricsOnly ? t("song_fullscreen", "show_chords") : t("song_fullscreen", "lyrics_only")}
                >
                    <md-icon>lyrics</md-icon>
                    <md-icon slot="selected">lyrics</md-icon>
                </md-icon-button>

                <md-icon-button
                    onclick={() => {
                        savedFullscreenPosition.pageIndex = currentPageIndex
                        savedFullscreenPosition.index = pageSongIndexMap[currentPageIndex] ?? 0
                        setActivePage("song_draw", songPageId)
                    }}
                    aria-label="Draw"
                >
                    <md-icon>draw</md-icon>
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
                    <md-menu-item
                        onclick={() => {
                            moreMenuOpen = false
                            setActivePopup("settings")
                        }}
                    >
                        <span class="material-symbols-outlined" slot="start">tune</span>
                        <div slot="headline">{t("menu", "settings")}</div>
                    </md-menu-item>
                </md-menu>
            </div>
        </div>
    </header>

    <footer transition:slide={{ duration: 200, axis: "y" }}>
        <div class="progress">
            {#each Array(totalPages) as _, i}
                <span class="dot" class:active={i === currentPageIndex}></span>
            {/each}
        </div>
    </footer>
{/if}

<main>
    <div class="slider-viewport">
        <div
            class="slider"
            role="region"
            aria-label="Song carousel"
            bind:this={sliderEl}
            onpointerdown={pointerDown}
            onpointermove={pointerMove}
            onpointerup={pointerUp}
            onpointercancel={pointerUp}
            onlostpointercapture={pointerUp}
            style="touch-action: pan-y;"
        >
            {#each slides as slideItem, i}
                {#if slideItem.type === "song"}
                    {@const songId = slideItem.songItem?.songId ?? null}
                    {@const song = storage.getSongById(songId, storage.songs)}
                    {@const targetKey = slideItem.songItem?.transposed || song?.lastTransposed}
                    {@const hasMedia = !!song?.images.length}

                    {@const customBg = storage.settings.paperOptions?.background || "white"}
                    {@const paperBg = hasMedia ? "black" : customBg}
                    {@const fontScale = (storage.settings.paperOptions?.fontSize ?? 100) / 100}

                    <div class="slide" style="--font-scale: {fontScale};">
                        <Paper padding={hasMedia ? 0 : 10} background={paperBg} headerText={song?.name ?? ""}>
                            {#key targetKey + ":" + (song?.lastTransposed ?? "") + ":" + fullscreenState.lyricsOnly + ":" + customBg + ":" + fontScale}
                                <ChordPro {songId} {targetKey} numColumns={2} lightMode={Math.abs(i - currentPageIndex) > 1} hideChords={fullscreenState.lyricsOnly} showMeta />
                            {/key}
                        </Paper>
                    </div>
                {:else if slideItem.type === "section"}
                    {@const customBg = storage.settings.paperOptions?.background || "white"}
                    <div class="slide">
                        <Paper padding={16} background={customBg} headerText="">
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

        {#if visibleSongId}
            {#key visibleSongId + ":" + songPageIndex}
                <Draw initialData={visibleSongId ? storage.getSongById(visibleSongId)?.drawings?.[songPageIndex] || "" : ""} />
            {/key}
        {/if}
    </div>
</main>

<style>
    header {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 1000;

        display: flex;
        padding-top: 20px;
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
        padding: 0 20px;
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
        background-color: var(--md-sys-color-primary-container, #ffdcc1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .fullscreen-section-icon {
        color: var(--md-sys-color-primary, #f5aa67);
        font-size: 28px;
    }

    .fullscreen-section-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: var(--md-sys-color-on-surface, #201a17);
        letter-spacing: 0.5px;
        line-height: 1.25;
        max-width: 90%;
        word-break: break-word;
    }

    .fullscreen-section-divider {
        width: 60px;
        height: 2px;
        background-color: var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.15));
        border-radius: 1px;
    }

    .progress {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 18px;
        display: flex;
        gap: 8px;
        z-index: 1001;
        pointer-events: none;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.35);
        transition:
            transform 160ms ease,
            background 160ms ease,
            opacity 160ms ease;
        opacity: 0.95;
    }

    .dot.active {
        background: white;
        transform: scale(1.4);
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

    md-menu-item {
        white-space: nowrap;
    }
</style>
