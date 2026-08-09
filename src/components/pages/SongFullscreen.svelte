<script lang="ts">
    import { slide } from "svelte/transition"
    import { goBack, menuState } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import ChordPro from "../song/ChordPro.svelte"
    import Paper from "../song/Paper.svelte"
    import { onMount, tick } from "svelte"

    let listId = menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null
    let list = $derived(listId ? storage.getListById(listId, storage.lists) : null)
    let songs = $derived(list ? list.songs : [menuState.contentId])

    let actionsVisible = $state(false)
    let hideTimeout: ReturnType<typeof setTimeout> | null = null
    function windowClick(e: MouseEvent) {
        if (didDrag) return
        if ((e.target as HTMLElement)?.closest("header")) return

        actionsVisible = !actionsVisible

        if (actionsVisible) {
            if (hideTimeout) clearTimeout(hideTimeout)
            hideTimeout = setTimeout(() => {
                actionsVisible = false
            }, 3000)
        }
    }

    // Carousel / page swipe state
    let currentPageIndex = $state(0)
    let totalPages = $state(1)
    let sliderEl: HTMLDivElement | null = null
    let isDragging = false
    let startX = 0
    let currentTranslate = 0
    let prevTranslate = 0
    let didDrag = false

    /**
     * Counts all generated .paper-page elements across all songs
     */
    function updatePageCount() {
        if (!sliderEl) return
        const pages = sliderEl.querySelectorAll(".paper-page")
        totalPages = pages.length || 1
        if (currentPageIndex >= totalPages) {
            currentPageIndex = Math.max(0, totalPages - 1)
            setPositionByIndex()
        }
    }

    function pointerDown(e: PointerEvent) {
        isDragging = true
        didDrag = false
        startX = e.clientX
        sliderEl?.setPointerCapture?.(e.pointerId)
    }

    function pointerMove(e: PointerEvent) {
        if (!isDragging || !sliderEl) return
        const currentX = e.clientX
        const delta = currentX - startX
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

    function setPositionByIndex() {
        if (!sliderEl) return
        const width = sliderEl.clientWidth
        currentTranslate = -currentPageIndex * width
        prevTranslate = currentTranslate
        sliderEl.style.transition = "transform 300ms ease"
        sliderEl.style.transform = `translateX(${currentTranslate}px)`
        setTimeout(() => {
            if (sliderEl) sliderEl.style.transition = ""
        }, 300)
    }

    // function goPrev() {
    //     if (currentPageIndex > 0) {
    //         currentPageIndex--
    //         setPositionByIndex()
    //     }
    // }
    // function goNext() {
    //     if (currentPageIndex < totalPages - 1) {
    //         currentPageIndex++
    //         setPositionByIndex()
    //     }
    // }

    onMount(() => {
        let observer: MutationObserver | null = null

        tick().then(() => {
            currentPageIndex = 0
            setPositionByIndex()

            if (sliderEl) {
                updatePageCount()

                // Observe DOM changes so page counts update dynamically when Paper finishes paginating
                observer = new MutationObserver(() => {
                    updatePageCount()
                })
                observer.observe(sliderEl, { childList: true, subtree: true })
            }
        })

        return () => {
            observer?.disconnect()
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

            <md-icon-button onclick={() => console.log("draw")}>
                <md-icon>draw</md-icon>
            </md-icon-button>
        </div>
    </header>

    <!-- <md-icon-button onclick={goPrev} disabled={currentPageIndex === 0}>
        <md-icon>chevron_left</md-icon>
    </md-icon-button>
    <md-icon-button onclick={goNext} disabled={currentPageIndex === totalPages - 1}>
        <md-icon>chevron_right</md-icon>
    </md-icon-button> -->

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
