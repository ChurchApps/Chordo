<script lang="ts">
    import { onMount, tick } from "svelte"
    import { slide } from "svelte/transition"
    import { goBack, menuState, setActivePage, savedFullscreenPosition } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import ChordPro from "../song/ChordPro.svelte"
    import Paper from "../song/Paper.svelte"
    import Draw from "../draw/Draw.svelte"

    // --- State & Derived State ---
    const listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId)
    const list = $derived(listId ? storage.getListById(listId, storage.lists) : null)
    const songs = $derived(list?.songs ?? [menuState.contentId])

    let actionsVisible = $state(false)
    let hideTimeout: ReturnType<typeof setTimeout> | undefined

    // Carousel state
    let currentPageIndex = $state(0)
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

    // --- Page Counting & Mapping ---
    function updatePageCount() {
        if (!sliderEl) return

        const pages = Array.from(sliderEl.querySelectorAll<HTMLElement>(".paper-page"))
        const slideEls = Array.from(sliderEl.querySelectorAll<HTMLElement>(".slide"))

        totalPages = pages.length || 1

        // Build mappings: global page index -> (songId, indexInSong)
        pageSongMap = pages.map((page) => {
            const slideEl = page.closest(".slide") as HTMLElement | null
            const index = slideEl ? slideEls.indexOf(slideEl) : -1
            return songs[index] ?? null
        })

        pageIndexMap = pages.map((page) => {
            const slideEl = page.closest(".slide")
            return slideEl ? Array.from(slideEl.querySelectorAll(".paper-page")).indexOf(page) : 0
        })

        // Restore saved position if restoring
        if (savedFullscreenPosition.index != null && pages.length > savedFullscreenPosition.index) {
            currentPageIndex = savedFullscreenPosition.index
            savedFullscreenPosition.index = null
            setPositionByIndex(false)
        } else if (currentPageIndex >= totalPages) {
            currentPageIndex = Math.max(0, totalPages - 1)
            setPositionByIndex()
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
        const threshold = sliderEl.clientWidth * 0.2

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
        currentTranslate = -currentPageIndex * sliderEl.clientWidth
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
        const globalIndex = Math.max(0, Math.min(index, Math.max(0, pageSongMap.length - 1)))
        const songId = pageSongMap[globalIndex] ?? songs[0] ?? null
        const pageInSong = pageIndexMap[globalIndex] ?? 0

        if (globalIndex !== previousPage) {
            previousPage = globalIndex
            songPageId = `${songId}:${pageInSong}`

            visibleSongId = songId
            songPageIndex = pageInSong
        }
    }

    // --- Lifecycle & DOM Observation ---
    onMount(() => {
        let observer: MutationObserver | null = null

        tick().then(() => {
            if (savedFullscreenPosition.index != null) {
                currentPageIndex = savedFullscreenPosition.index
            }
            setPositionByIndex(false)

            if (sliderEl) {
                updatePageCount()
                observer = new MutationObserver(updatePageCount)
                observer.observe(sliderEl, { childList: true, subtree: true })
            }
        })

        return () => observer?.disconnect()
    })

    $effect(() => {
        if (menuState.activePage === "song_live" && savedFullscreenPosition.index != null) {
            currentPageIndex = savedFullscreenPosition.index
            setPositionByIndex(false)
        }
    })
</script>

<svelte:window onclick={windowClick} />

{#if actionsVisible}
    <header transition:slide={{ duration: 200, axis: "y" }}>
        <div style="display:flex;align-items:center;gap:12px;width:100%;padding: 0 20px;">
            <md-icon-button onclick={goBack}>
                <md-icon>arrow_back</md-icon>
            </md-icon-button>

            <div style="flex:1"></div>

            <md-icon-button
                onclick={() => {
                    savedFullscreenPosition.index = currentPageIndex
                    setActivePage("song_draw", songPageId)
                }}
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
            {#each songs as songId}
                <div class="slide">
                    <Paper padding={12} headerText={songId ? storage.getSongById(songId)?.name : ""}>
                        <ChordPro {songId} numColumns={2} showMeta />
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
    :global(.pages-stack) {
        display: flex !important;
        flex-direction: row !important;
        gap: 0 !important;
        width: auto !important;
        height: 100vh !important;
        align-items: center !important;
    }

    /* Individual A-Paper Page */
    :global(.paper-page) {
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
        background: #ffffff !important;
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
