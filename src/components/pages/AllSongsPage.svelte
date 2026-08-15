<script lang="ts">
    import { onMount } from "svelte"
    import { Songs } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import { goBack, menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let songs = $derived(Songs.get(storage.songs))

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)
    let searchQuery = $derived(searchState.query.trim().toLowerCase())

    let filteredSongs = $derived.by(() => {
        if (!isSearching) return songs
        return songs.filter(
            (s) =>
                s.name.toLowerCase().includes(searchQuery) ||
                (s.metadata?.artist && s.metadata.artist.toLowerCase().includes(searchQuery))
        )
    })

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
        const list = storage.getListById(menuState.contentId)
        if (!list) return

        // go back first so we get the slide in animation in the list
        goBack()

        // wait for page navigation animation
        setTimeout(() => {
            list.addSongs(addSongsOrder)
        }, 80)
    }
</script>

<main>
    {#if filteredSongs.length}
        <md-list class="song-list scroll-list">
            {#each filteredSongs as song, idx}
                {@const selected = addSongsOrder.includes(song.id)}
                {@const artist = song.metadata?.artist || (song.getMetadata ? song.getMetadata("artist") : "")}
                {@const key = song.metadata?.key || (song.getMetadata ? song.getMetadata("key") : "")}

                <md-list-item type="button" class:selected onclick={() => (listOpened ? toggleSong(song.id) : openSong(song.id, song.name))}>
                    <div slot="headline">{song.name}</div>
                    {#if artist || key}
                        <div slot="supporting-text">
                            {artist || ""}
                            {#if artist && key} • {/if}
                            {#if key}{t("common", "key")}: {key}{/if}
                        </div>
                    {/if}
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
    {:else if isSearching}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">search_off</span>
                <h2>{t("search", "no_results")}</h2>
                <p>{searchState.query}</p>
            </div>
        </div>
    {:else}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">library_music</span>
                <h2>{t("empty_state", "no_songs_title")}</h2>
                <p>{t("empty_state", "no_songs_desc")}</p>
            </div>
        </div>
    {/if}
</main>

<div class="fab-container">
    {#if listOpened && addSongsOrder.length > 0}
        <md-fab aria-label={t("common", "done")} onclick={addSongs}>
            <span class="material-symbols-outlined" slot="icon">check</span>
        </md-fab>
    {:else}
        <md-fab aria-label={t("common", "add")} onclick={() => setActivePopup("create_song")}>
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
