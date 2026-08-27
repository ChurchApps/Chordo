<script lang="ts">
    import { onMount } from "svelte"
    import { Songs } from "$lib/models/Song"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { t } from "$lib/state/i18n.svelte"
    import { goBack, listEditingState, menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
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
    let isEditing = $derived(listEditingState.isEditing)
    let selectedSongIds = $state<string[]>([])

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

    function removeSelectedSongs() {
        if (selectedSongIds.length === 0) return
        const count = selectedSongIds.length
        const message =
            count === 1
                ? t("confirm", "delete_song_msg")
                : t("confirm", "delete_songs_msg").replace("{count}", count.toString())

        openConfirm({
            title: count === 1 ? t("confirm", "delete_song_title") : t("confirm", "delete_songs_title"),
            message,
            confirmLabel: t("common", "delete"),
            isDestructive: true,
            onConfirm: async () => {
                const idsToDelete = [...selectedSongIds]
                for (const id of idsToDelete) {
                    await storage.deleteSong(id)
                }
                selectedSongIds = []
                listEditingState.isEditing = false
            }
        })
    }

    function editSelectedSong() {
        if (selectedSongIds.length !== 1) return
        const songId = selectedSongIds[0]
        const song = storage.getSongById(songId, storage.songs)
        if (!song) return

        setActivePage("song_edit", song.id, song.name)
    }

    $effect(() => {
        if (!listOpened && isEditing) {
            listEditingState.onDeleteSelected = removeSelectedSongs
            if (selectedSongIds.length === 1) {
                listEditingState.onEditSelected = editSelectedSong
            } else {
                listEditingState.onEditSelected = undefined
            }
        } else if (!isEditing) {
            listEditingState.onDeleteSelected = undefined
            listEditingState.onEditSelected = undefined
            selectedSongIds = []
        }
    })

    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressed = false

    function startPress(e: PointerEvent, songId: string) {
        if (listOpened || e.button !== 0) return
        longPressed = false
        longPressTimer = setTimeout(() => {
            longPressed = true
            listEditingState.isEditing = true
            if (!selectedSongIds.includes(songId)) {
                selectedSongIds = [...selectedSongIds, songId]
            }
            if (navigator.vibrate) navigator.vibrate(50)
        }, 500)
    }

    function endPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer)
            longPressTimer = null
        }
    }

    function handleContextMenu(e: MouseEvent, songId: string) {
        if (listOpened) return
        e.preventDefault()
        listEditingState.isEditing = true
        if (!selectedSongIds.includes(songId)) {
            selectedSongIds = [...selectedSongIds, songId]
        }
    }

    function handleItemClick(songId: string, songName: string) {
        if (longPressed) {
            longPressed = false
            return
        }
        if (listOpened) {
            toggleSong(songId)
            return
        }
        if (isEditing) {
            if (selectedSongIds.includes(songId)) {
                selectedSongIds = selectedSongIds.filter((id) => id !== songId)
                if (selectedSongIds.length === 0) {
                    listEditingState.isEditing = false
                }
            } else {
                selectedSongIds = [...selectedSongIds, songId]
            }
            return
        }
        openSong(songId, songName)
    }
</script>

<main>
    {#if listOpened && !isSearching}
        <md-list class="section-create-list">
            <md-list-item
                type="button"
                class="create-section-item"
                onclick={() => setActivePopup("create_section")}
            >
                <div slot="headline" class="create-section-title">{t("list", "create_section")}</div>
                <md-icon slot="start" class="create-section-icon">bookmark_add</md-icon>
                <md-icon slot="end" style="opacity: 0.8;">add</md-icon>
            </md-list-item>
        </md-list>
    {/if}

    {#if filteredSongs.length}
        <md-list class="song-list scroll-list">
            {#each filteredSongs as song, idx}
                {@const isSelected = listOpened ? addSongsOrder.includes(song.id) : (isEditing && selectedSongIds.includes(song.id))}
                {@const artist = song.metadata?.artist || (song.getMetadata ? song.getMetadata("artist") : "")}
                {@const key = song.metadata?.key || (song.getMetadata ? song.getMetadata("key") : "")}

                <md-list-item
                    type="button"
                    class:selected={isSelected}
                    onpointerdown={(e: PointerEvent) => startPress(e, song.id)}
                    onpointerup={endPress}
                    onpointerleave={endPress}
                    oncontextmenu={(e: MouseEvent) => handleContextMenu(e, song.id)}
                    onclick={() => handleItemClick(song.id, song.name)}
                >
                    <div slot="headline">{song.name}</div>
                    {#if artist || key}
                        <div slot="supporting-text">
                            {artist || ""}
                            {#if artist && key} • {/if}
                            {#if key}{t("common", "key")}: {key}{/if}
                        </div>
                    {/if}
                    <md-icon slot="start">music_note</md-icon>
                    {#if listOpened && isSelected}
                        <span slot="end" class="number">{addSongsOrder.indexOf(song.id) + 1}</span>
                    {:else if listOpened}
                        <md-icon slot="end" style="opacity: 0.8;">add</md-icon>
                    {:else if isEditing && isSelected}
                        <md-icon slot="end" style="color: var(--md-sys-color-primary);">check_circle</md-icon>
                    {:else if isEditing}
                        <md-icon slot="end" style="opacity: 0.4;">radio_button_unchecked</md-icon>
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
    {:else if !listOpened && isEditing}
        <md-fab aria-label={t("common", "done")} onclick={() => (listEditingState.isEditing = false)}>
            <span class="material-symbols-outlined" slot="icon">check</span>
        </md-fab>
    {:else}
        <md-fab aria-label={t("common", "add")} onclick={() => setActivePopup("create_song")}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    {/if}
</div>

<style>
    .section-create-list {
        padding: 0;
        border-bottom: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.12));
    }
    .create-section-item {
        background-color: var(--md-sys-color-surface-container-low, rgba(0, 0, 0, 0.02));
    }
    .create-section-title {
        font-weight: 500;
        color: var(--md-sys-color-primary);
    }
    .create-section-icon {
        color: var(--md-sys-color-primary);
    }

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
