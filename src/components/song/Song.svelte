<script lang="ts">
    import storage from "../../lib/storage/StorageManager.svelte"
    import ChordPro from "./ChordPro.svelte"

    let { songId } = $props<{ songId: string | null }>()

    let song = $derived(storage.getSongById(songId, storage.songs))
    let hasMedia = $derived(!!song?.images.length)
</script>

<div id={songId} class="paper-wrapper">
    <div class="paper" class:hasMedia>
        <ChordPro {songId} />
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
</style>
