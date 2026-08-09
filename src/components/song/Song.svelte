<script lang="ts">
    import ChordPro from "./ChordPro.svelte"

    let { songId } = $props<{ songId: string | null }>()
</script>

<div id={songId} class="paper-wrapper">
    <div class="paper">
        <ChordPro {songId} />
    </div>
</div>

<style>
    .paper-wrapper {
        width: 100%;
        height: 100%;
    }

    .paper {
        width: 100%;
        height: 100%;

        color: black;
        background-color: white;
        /* font-family: "Roboto", sans-serif; */

        padding: 40px 50px;
        border-radius: 6px;
        box-sizing: border-box;
    }
</style>
