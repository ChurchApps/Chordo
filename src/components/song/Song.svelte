<script lang="ts">
    import storage from "$lib/storage/StorageManager.svelte"
    import ChordPro from "./ChordPro.svelte"

    let {
        songId,
        targetKey,
        semitones
    } = $props<{
        songId: string | null
        targetKey?: string
        semitones?: number
    }>()

    let song = $derived(storage.getSongById(songId, storage.songs))
    let hasMedia = $derived(!!song?.images.length)
</script>

<div id={songId} class="paper-wrapper">
    <div class="paper" class:hasMedia>
        {#key targetKey + ":" + semitones + ":" + (song?.lastTransposed ?? "")}
            <ChordPro {songId} {targetKey} {semitones} />
        {/key}
    </div>
</div>

<style>
    .paper-wrapper {
        width: 100%;
    }

    .paper {
        width: 100%;

        color: black;
        background-color: white;

        padding: 40px 50px;
        border-radius: 6px;
        box-sizing: border-box;
    }

    .paper.hasMedia {
        padding: 0;
    }

    @media print {
        .paper {
            padding: 0 !important;
            border-radius: 0 !important;
        }
    }
</style>
