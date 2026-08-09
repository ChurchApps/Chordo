<script lang="ts">
    import { menuState, setActivePage } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import Song from "../song/Song.svelte"

    let listId = menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null
    let list = $derived(listId ? storage.getListById(listId, storage.lists) : null)
    let songs = $derived(list ? list.songs : [menuState.contentId])
</script>

<main>
    <div class="songs">
        {#each songs as songId}
            <Song {songId} />
        {/each}
    </div>
</main>

<div class="fab-container">
    <md-fab aria-label="Play" onclick={() => setActivePage("song_live", menuState.contentId)}>
        <span class="material-symbols-outlined" slot="icon">play_arrow</span>
    </md-fab>
</div>

<style>
    main {
        overflow-y: auto;
    }

    .songs {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 10px;
        /* padding: 10px; */
    }
</style>
