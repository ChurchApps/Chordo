<script lang="ts">
    import { goBack, menuState } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import Draw from "../draw/Draw.svelte"
    import ChordPro from "../song/ChordPro.svelte"
    import Paper from "../song/Paper.svelte"

    let songPageId = menuState.contentId

    let songId: string | null = $state(null)
    let pageIndex: number | null = $state(null)

    let song = $derived(songId ? storage.getSongById(songId) : null)

    $effect(() => {
        if (!songPageId?.includes(":")) return
        const [_songId, pageIndexStr] = songPageId.split(":")

        const _pageIndex = parseInt(pageIndexStr)

        songId = _songId
        pageIndex = _pageIndex
    })
</script>

<main>
    <div class="slider-viewport">
        <div class="slide">
            <Paper {pageIndex} padding={12} headerText={song?.name || ""}>
                <ChordPro {songId} numColumns={2} showMeta />
            </Paper>
        </div>
    </div>

    <Draw
        editable
        initialData={song?.drawings?.[pageIndex ?? 0] || ""}
        onFinish={(dataUrl) => {
            if (!song || pageIndex === null) return
            song.drawings[pageIndex] = dataUrl
            storage.persist()
            goBack()
        }}
    />
</main>

<!-- <div class="fab-container">
    <md-fab aria-label="Done" onclick={goBack}>
        <span class="material-symbols-outlined" slot="icon">check</span>
    </md-fab>
</div> -->

<style>
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
</style>
