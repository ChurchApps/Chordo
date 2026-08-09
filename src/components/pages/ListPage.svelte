<script lang="ts">
    import { Songs } from "../../lib/models/Song"
    import { menuState, setActivePage } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"

    let listId = menuState.contentId
    let songs = $derived(Songs.get(storage.songs, listId))

    // function moveUp(idx: number) {
    //     const listId = menuState.contentId
    //     if (!listId) return
    //     storage.moveSongInList(listId, idx, idx - 1)
    // }

    // function moveDown(idx: number) {
    //     const listId = menuState.contentId
    //     if (!listId) return
    //     storage.moveSongInList(listId, idx, idx + 1)
    // }

    // moveSongInList(listId: string, fromIndex: number, toIndex: number): boolean {
    //     const list = this.findList(listId)
    //     if (!list) return false
    //     const len = list.songs.length
    //     if (fromIndex < 0 || fromIndex >= len) return false
    //     if (toIndex < 0 || toIndex >= len) return false
    //     const [item] = list.songs.splice(fromIndex, 1)
    //     list.songs.splice(toIndex, 0, item)
    //     this.save()
    //     return true
    // }

    function openSong(songId: string, songName: string) {
        setActivePage("song", songId, songName)
    }
</script>

<main>
    {#if songs.length}
        <md-list class="song-list scroll-list">
            {#each songs as song, idx}
                <!-- TODO: rearrange -->

                <md-list-item type="button" onclick={() => openSong(song.id, song.name)}>
                    <div slot="headline">{song.name}</div>
                    <md-icon slot="start">music_note</md-icon>
                    <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>

                    <!-- <div class="song-controls">
                        <md-icon-button onclick={() => moveUp(idx)} disabled={idx === 0}>
                            <span class="material-symbols-outlined">arrow_upward</span>
                        </md-icon-button>
                        <md-icon-button onclick={() => moveDown(idx)} disabled={idx === songs.length - 1}>
                            <span class="material-symbols-outlined">arrow_downward</span>
                        </md-icon-button>
                    </div> -->
                </md-list-item>
            {/each}
        </md-list>
    {:else}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">library_music</span>
                <h2>No songs yet</h2>
                <p>Tap the + button in the bottom right to add songs.</p>
            </div>
        </div>
    {/if}
</main>

<div class="fab-container">
    <md-fab aria-label="Add" onclick={() => setActivePage("all_songs", listId, "Add Songs")}>
        <span class="material-symbols-outlined" slot="icon">add</span>
    </md-fab>
</div>

<style>
    .song-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
    }
</style>
