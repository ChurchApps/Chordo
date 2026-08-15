<script lang="ts">
    import { slide } from "svelte/transition"
    import type { ListSongDisplayItem } from "$lib/models/List"
    import { listEditingState, menuState, savedFullscreenPosition, setActivePage } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { applyBatchMove, getDisplayList, handleContainerDragOver, handleContainerDrop, handleItemDragOver, handleItemDragStart, handleItemDrop, resetDragState, type ReorderState } from "$lib/utils/rearrange"

    let listId = $derived(menuState.contentId)
    let list = $derived(storage.getListById(listId, storage.lists))
    let listItems = $derived(list ? list.getListItems(storage.songs) : [])

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)
    let searchQuery = $derived(searchState.query.trim().toLowerCase())

    let isEditing = $derived(listEditingState.isEditing)
    let selectedIndices = $state<number[]>([])

    function removeSelectedSongs() {
        if (!list || selectedIndices.length === 0) return
        // Sort indices in descending order to avoid index shifts during removal
        const sorted = [...selectedIndices].sort((a, b) => b - a)
        for (const idx of sorted) {
            list.removeSong(idx)
        }

        storage.lists = [...storage.lists]
        selectedIndices = []
        listEditingState.isEditing = false
    }

    $effect(() => {
        if (isEditing) {
            listEditingState.onDeleteSelected = removeSelectedSongs
            if (selectedIndices.length === 0 && listItems.length > 0) {
                selectedIndices = [0]
            }
        } else {
            listEditingState.onDeleteSelected = undefined
            selectedIndices = []
        }
    })

    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressed = false

    let reorderState = $state<ReorderState>({
        draggedIdx: null,
        draggedIndices: [],
        dragOverIdx: null
    })

    let displaySongs = $derived.by(() => {
        const base = getDisplayList(listItems, reorderState)
        if (!isSearching) return base
        return base.filter(
            ({ item: songItem }) =>
                songItem.name.toLowerCase().includes(searchQuery) ||
                (songItem.song?.metadata?.artist && songItem.song.metadata.artist.toLowerCase().includes(searchQuery))
        )
    })

    function onBatchMove(fromIndices: number[], targetIdx: number) {
        if (!list || fromIndices.length === 0) return
        const { updatedList, newSelectedIndices } = applyBatchMove(list.songs, fromIndices, targetIdx)
        list.songs = updatedList
        storage.persist()
        storage.lists = [...storage.lists]
        selectedIndices = newSelectedIndices
    }

    function startPress(e: PointerEvent, originalIdx: number) {
        if (e.button !== 0) return
        longPressed = false
        longPressTimer = setTimeout(() => {
            longPressed = true
            listEditingState.isEditing = true
            if (!selectedIndices.includes(originalIdx)) {
                selectedIndices = [...selectedIndices, originalIdx]
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

    function handleContextMenu(e: MouseEvent, originalIdx: number) {
        e.preventDefault()
        listEditingState.isEditing = true
        if (!selectedIndices.includes(originalIdx)) {
            selectedIndices = [...selectedIndices, originalIdx]
        }
    }

    function handleItemClick(item: ListSongDisplayItem, originalIdx: number) {
        if (longPressed) {
            longPressed = false
            return
        }
        if (isEditing) {
            if (selectedIndices.length === 1 && selectedIndices[0] === originalIdx) return
            if (selectedIndices.includes(originalIdx)) {
                selectedIndices = selectedIndices.filter((i) => i !== originalIdx)
            } else {
                selectedIndices = [...selectedIndices, originalIdx]
            }
            return
        }
        if (item.isDeleted) return

        savedFullscreenPosition.index = originalIdx
        setActivePage("song", item.songId, item.name)
    }

    function applyMove(from: number, to: number) {
        if (!list) return
        list.moveSong(from, to)
        storage.lists = [...storage.lists]
    }
</script>

<main>
    {#if listItems.length}
        <md-list class="song-list scroll-list" ondragover={(e: DragEvent) => handleContainerDragOver(e, listItems.length, reorderState)} ondrop={(e: DragEvent) => handleContainerDrop(e, listItems.length, reorderState, onBatchMove)}>
            {#each displaySongs as { item: songItem, originalIdx }, idx (songItem.songId + "-" + originalIdx)}
                {@const isGhost = reorderState.draggedIdx !== null && (reorderState.draggedIndices.length > 0 ? reorderState.draggedIndices.includes(originalIdx) : originalIdx === reorderState.draggedIdx)}
                {@const isSelected = isEditing && selectedIndices.includes(originalIdx)}
                {@const artist = songItem.song?.metadata?.artist || (songItem.song?.getMetadata ? songItem.song.getMetadata("artist") : "")}
                {@const key = songItem.transposed || songItem.song?.metadata?.key || (songItem.song?.getMetadata ? songItem.song.getMetadata("key") : "")}
                <div
                    role="listitem"
                    class="song-item-wrapper"
                    class:ghost={isGhost}
                    transition:slide={{ duration: 250 }}
                    draggable={isEditing}
                    ondragstart={(e) => handleItemDragStart(e, originalIdx, selectedIndices, reorderState)}
                    ondragover={(e) => handleItemDragOver(e, idx, reorderState)}
                    ondrop={(e) => handleItemDrop(e, idx, reorderState, onBatchMove)}
                    ondragend={() => resetDragState(reorderState)}
                >
                    <md-list-item
                        type="button"
                        class:selected={isSelected}
                        class:deleted-item={songItem.isDeleted}
                        disabled={songItem.isDeleted && !isEditing}
                        onpointerdown={(e: PointerEvent) => startPress(e, originalIdx)}
                        onpointerup={endPress}
                        onpointerleave={endPress}
                        oncontextmenu={(e: MouseEvent) => handleContextMenu(e, originalIdx)}
                        onclick={() => handleItemClick(songItem, originalIdx)}
                    >
                        {#if isEditing}
                            <div slot="start" class="drag-handle-container" title="Drag to reorder">
                                <span class="material-symbols-outlined drag-handle">drag_handle</span>
                            </div>
                        {:else if songItem.isDeleted}
                            <md-icon slot="start" style="opacity: 0.4;">music_off</md-icon>
                        {:else}
                            <md-icon slot="start">music_note</md-icon>
                        {/if}

                        <div slot="headline" class="song-headline" class:deleted={songItem.isDeleted}>
                            {songItem.name}
                            {#if songItem.isDeleted}
                                <span class="deleted-tag">Deleted</span>
                            {/if}
                        </div>

                        {#if !songItem.isDeleted && (artist || key)}
                            <div slot="supporting-text">
                                {artist || ""}
                                {#if artist && key} • {/if}
                                {#if key}Key: {key}{/if}
                            </div>
                        {/if}

                        {#if isEditing}
                            <div slot="end" class="song-controls"></div>
                        {:else if !songItem.isDeleted}
                            <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                        {/if}
                    </md-list-item>
                </div>
            {/each}
        </md-list>
    {:else if isSearching}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">search_off</span>
                <h2>No songs found</h2>
                <p>No songs match "{searchState.query}".</p>
            </div>
        </div>
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
    {#if isEditing}
        <md-fab aria-label="Done" onclick={() => (listEditingState.isEditing = false)}>
            <span class="material-symbols-outlined" slot="icon">check</span>
        </md-fab>
    {:else}
        <md-fab aria-label="Add" onclick={() => setActivePage("all_songs", listId, "Add Songs")}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    {/if}
</div>

<style>
    main {
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 64px - 6px);
    }

    .song-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 100%;
    }

    .song-item-wrapper {
        position: relative;
        transition:
            transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            opacity 0.2s ease;
    }
    .song-item-wrapper.ghost {
        opacity: 0.25;
        background: var(--md-sys-color-surface-container-high, #e6e0e9);
        border-radius: 8px;
    }
    md-list-item {
        min-height: 56px;
    }
    md-list-item.selected {
        background-color: rgb(0 0 0 / 0.08);
    }
    .drag-handle-container {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        width: 24px;
        height: 24px;
        color: var(--md-sys-color-outline, #79747e);
    }
    .drag-handle-container:active {
        cursor: grabbing;
    }
    .song-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 48px;
    }

    .song-headline {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .song-headline.deleted {
        opacity: 0.5;
        font-style: italic;
    }

    .deleted-tag {
        font-size: 0.7rem;
        font-style: normal;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.08);
        color: var(--md-sys-color-error, #ba1a1a);
        font-weight: 500;
    }
</style>
