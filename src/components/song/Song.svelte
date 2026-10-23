<script lang="ts">
    import { getExternalSong } from "$lib/integrations/integrationState.svelte"
    import { fullscreenState } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import ChordPro from "./ChordPro.svelte"

    interface Props {
        songId: string | null
        targetKey?: string
        semitones?: number
    }

    let { songId, targetKey = undefined, semitones = undefined }: Props = $props()

    let song = $derived(storage.getSongById(songId, storage.songs) || getExternalSong(songId))
    let hasMedia = $derived(!!song?.images.length)

    let customBg = $derived(storage.settings.paperOptions?.background || "#ffffff")
    let paperBg = $derived(hasMedia ? "black" : customBg)
    let fontScale = $derived((storage.settings.paperOptions?.fontSize ?? 100) / 100)
    let chordColor = $derived(storage.settings.paperOptions?.chordColor || "#5498be")

    let isDarkBackground = $derived.by(() => {
        if (!paperBg) return false
        const bg = paperBg.toLowerCase().trim()
        if (bg === "black" || bg === "#000000" || bg === "#000" || bg === "#222222" || bg === "#1e1e1e" || bg === "#242424") return true
        if (bg.startsWith("#") && bg.length === 7) {
            const r = parseInt(bg.slice(1, 3), 16)
            const g = parseInt(bg.slice(3, 5), 16)
            const b = parseInt(bg.slice(5, 7), 16)
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            return luma < 128
        }
        return false
    })
</script>

<div id={songId} class="paper-wrapper">
    <div class="paper" class:hasMedia style="background-color: {paperBg}; color: {isDarkBackground ? '#e6e1e5' : '#111111'}; --font-scale: {fontScale}; --chord-color: {chordColor};">
        <ChordPro {songId} {targetKey} {semitones} hideChords={fullscreenState.lyricsOnly} />
    </div>
</div>

<style>
    .paper-wrapper {
        width: 100%;
    }

    .paper {
        width: 100%;

        padding: 40px 50px;
        border-radius: 6px;
        box-sizing: border-box;
    }

    .paper.hasMedia {
        padding: 0;
    }

    @media (max-width: 600px) {
        .paper {
            padding: 20px 16px;
        }
    }

    @media print {
        .paper {
            padding: 0 !important;
            border-radius: 0 !important;
        }
    }
</style>
