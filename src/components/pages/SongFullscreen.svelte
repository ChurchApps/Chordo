<script lang="ts">
    import { onMount, tick } from "svelte"
    import { slide } from "svelte/transition"
    import { goBack, menuState, setActivePage, savedFullscreenPosition } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import { requestWakeLock, releaseWakeLock } from "../../lib/utils/wakeLock"
    import { enterFullscreen, exitFullscreen, toggleFullscreen, isFullscreenActive } from "../../lib/utils/fullscreen"
    import ChordPro from "../song/ChordPro.svelte"
    import Paper from "../song/Paper.svelte"
    import Draw from "../draw/Draw.svelte"

    // --- State & Derived State ---
    const listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId)
    const list = $derived(listId ? storage.getListById(listId, storage.lists) : null)
    const songs = $derived(list?.songs ?? (menuState.contentId ? [{ songId: menuState.contentId }] : []))

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

    // --- Actions Header Toggle ---
    function windowClick(e: MouseEvent) {
        if (didDrag || (e.target as HTMLElement)?.closest("header")) return

        actionsVisible = !actionsVisible
        clearTimeout(hideTimeout)

        if (actionsVisible) {
            hideTimeout = setTimeout(() => (actionsVisible = false), 3000)
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
                const item = songs[index]
                return item?.songId ?? null
            })

            pageIndexMap = pages.map((page) => {
                const slideEl = page.closest(".slide")
                return slideEl ? Array.from(slideEl.querySelectorAll(".paper-page")).indexOf(page) : 0
            })

            pageSongIndexMap = pages.map((page) => {
                const slideEl = page.closest(".slide") as HTMLElement | null
                return slideEl ? slideEls.indexOf(slideEl) : 0
            })
        } else {
            pageSongMap = songs.map((s) => s?.songId ?? null)
            pageIndexMap = songs.map(() => 0)
            pageSongIndexMap = songs.map((_, i) => i)
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
            const targetPageIdx = pageSongIndexMap.indexOf(savedFullscreenPosition.index)
            currentPageIndex = targetPageIdx !== -1 ? targetPageIdx : Math.min(savedFullscreenPosition.index, totalPages - 1)
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
        const songId = (pageCount > 0 ? pageSongMap[globalIndex] : songs[globalIndex]?.songId) ?? songs[0]?.songId ?? null
        const pageInSong = pageIndexMap[globalIndex] ?? 0
        const songIndexInList = pageSongIndexMap[globalIndex] ?? globalIndex

        if (initialPositionConsumed && songIndexInList >= 0 && songIndexInList < songs.length) {
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

    async function handleGoBack() {
        if (isFullscreenActive()) {
            await exitFullscreen()
        }
        goBack()
    }

    // --- Lifecycle & DOM Observation ---
    onMount(() => {
        let observer: MutationObserver | null = null
        requestWakeLock()
        enterFullscreen().then(() => {
            isNativeFullscreen = isFullscreenActive()
        })

        const onFsChange = () => {
            isNativeFullscreen = isFullscreenActive()
        }
        document.addEventListener("fullscreenchange", onFsChange)
        document.addEventListener("webkitfullscreenchange", onFsChange)

        tick().then(() => {
            if (sliderEl) {
                updatePageCount()
                observer = new MutationObserver(updatePageCount)
                observer.observe(sliderEl, { childList: true, subtree: true })
            }
            setPositionByIndex(false)
        })

        return () => {
            releaseWakeLock()
            if (isFullscreenActive()) {
                exitFullscreen()
            }
            document.removeEventListener("fullscreenchange", onFsChange)
            document.removeEventListener("webkitfullscreenchange", onFsChange)
            observer?.disconnect()
        }
    })
</script>

<svelte:window onclick={windowClick} />

{#if actionsVisible}
    <header transition:slide={{ duration: 200, axis: "y" }}>
        <div style="display:flex;align-items:center;gap:12px;width:100%;padding: 0 20px;">
            <md-icon-button onclick={handleGoBack} aria-label="Go back">
                <md-icon>arrow_back</md-icon>
            </md-icon-button>

            <div style="flex:1"></div>

            <!-- <md-icon-button
                onclick={handleToggleFullscreen}
                aria-label="Toggle Fullscreen"
            >
                <md-icon>{isNativeFullscreen ? "fullscreen_exit" : "fullscreen"}</md-icon>
            </md-icon-button> -->

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
        <div class="slider" bind:this={sliderEl} onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={pointerUp} onlostpointercapture={pointerUp} style="touch-action: pan-y;">
            {#each songs as songItem, i}
                {@const songId = songItem?.songId ?? null}
                {@const song = storage.getSongById(songId, storage.songs)}
                {@const targetKey = songItem?.transposed || song?.lastTransposed}
                {@const hasMedia = !!song?.images.length}

                <div class="slide">
                    <Paper padding={hasMedia ? 0 : 12} background={hasMedia ? "black" : "white"} headerText={song?.name ?? ""}>
                        {#key targetKey + ":" + (song?.lastTransposed ?? "")}
                            <ChordPro {songId} {targetKey} numColumns={2} showMeta lightMode={Math.abs(i - currentPageIndex) > 1} />
                        {/key}
                    </Paper>
                </div>
            {/each}
        </div>

        <!-- WIP: make drawing move/slide along with the "slider" -->
        {#key visibleSongId + ":" + songPageIndex}
            <Draw initialData={visibleSongId ? storage.getSongById(visibleSongId)?.drawings?.[songPageIndex] || "" : ""} />
        {/key}
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
        box-sizing: border-box;
    }

    /* Horizontal pagination container */
    .slider-viewport :global(.pages-stack) {
        display: flex !important;
        flex-direction: row !important;
        gap: 0 !important;
        width: auto !important;
        height: 100vh !important;
        align-items: center !important;
    }

    /* Individual A-Paper Page */
    .slider-viewport :global(.paper-page) {
        --margin-x: 10px;
        --margin-y: 10px;

        /* Height fills the screen (leaving room for top/bottom margins) */
        height: calc(100vh - var(--margin-y)) !important;
        max-height: calc(100vh - var(--margin-y)) !important;

        /* Width adheres to A4 aspect ratio (210/297), constrained by screen width */
        width: auto !important;
        max-width: calc(100vw - var(--margin-x)) !important;
        aspect-ratio: 210 / 297;

        /* Calculate exact rendered paper width */
        --paper-w: min(calc((100vh - var(--margin-y)) * (210 / 297)), calc(100vw - var(--margin-x)));

        /* Auto-calculate side margins so total slot footprint = 100vw */
        margin-left: calc((100vw - var(--paper-w)) / 2) !important;
        margin-right: calc((100vw - var(--paper-w)) / 2) !important;

        flex-shrink: 0 !important;
        box-sizing: border-box !important;
        /* box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important; */
        border-radius: 2px !important;
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
</style>
