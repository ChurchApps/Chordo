<script lang="ts">
    import { onMount } from "svelte"
    import { Songs } from "../../lib/models/Song"
    import { goBack, menuState, setActivePage, setActivePopup } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"

    let songs = $derived(Songs.get(storage.songs))

    onMount(() => {
        if (!songs.length) setActivePopup("create_song")
    })

    function openSong(songId: string, songName: string) {
        setActivePage("song", songId, songName)
    }

    let listOpened = !!menuState.contentId
    let addSongsOrder: string[] = $state([])
    function toggleSong(songId: string) {
        if (addSongsOrder.includes(songId)) {
            addSongsOrder = addSongsOrder.filter((id) => id !== songId)
        } else {
            addSongsOrder = [...addSongsOrder, songId]
        }
    }
    async function addSongs() {
        let list = storage.getListById(menuState.contentId)
        if (!list) return

        // go back first so we get the slide in animation in the list
        goBack()

        // wait for page navigation animation
        setTimeout(() => {
            list.addSongs(addSongsOrder)
            storage.lists = [...storage.lists]
        }, 80)
    }
</script>

<main>
    {#if songs.length}
        <md-list class="song-list scroll-list">
            {#each songs as song, idx}
                {@const selected = addSongsOrder.includes(song.id)}

                <md-list-item type="button" class:selected onclick={() => (listOpened ? toggleSong(song.id) : openSong(song.id, song.name))}>
                    <div slot="headline">{song.name}</div>
                    <md-icon slot="start">music_note</md-icon>
                    {#if listOpened && selected}
                        <span slot="end" class="number">{addSongsOrder.indexOf(song.id) + 1}</span>
                    {:else if listOpened}
                        <md-icon slot="end" style="opacity: 0.8;">add</md-icon>
                    {:else}
                        <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                    {/if}
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
    {#if listOpened && addSongsOrder.length > 0}
        <md-fab aria-label="Done" onclick={addSongs}>
            <span class="material-symbols-outlined" slot="icon">check</span>
        </md-fab>
    {:else}
        <md-fab aria-label="Add" onclick={() => setActivePopup("create_song")}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    {/if}
</div>

<style>
    .song-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
    }

    md-list-item.selected {
        background-color: rgb(255 255 255 / 0.3);
    }
    .number {
        width: 24px;
        height: 24px;

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--md-sys-color-primary);
        color: white;
        font-weight: bold;
        border-radius: 50%;
    }
</style>
