<script lang="ts">
    import { slide } from "svelte/transition"
    import type { ListSongDisplayItem } from "$lib/models/List"
    import { t } from "$lib/state/i18n.svelte"
    import { listEditingState, menuState, savedFullscreenPosition, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { applyBatchMove, getDisplayList, handleContainerDragOver, handleContainerDrop, handleItemDragOver, handleItemDragStart, handleItemDrop, handlePointerDragStart, resetDragState, type ReorderState } from "$lib/utils/rearrange"

    let listId = $derived(menuState.contentId)
    let list = $derived(storage.getListById(listId, storage.lists))
    let listItems = $derived(list ? list.getListItems(storage.songs) : [])

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)
    let searchQuery = $derived(searchState.query.trim().toLowerCase())

    let isEditing = $derived(listEditingState.isEditing)
    let selectedIndices = $state<number[]>([])

    function removeSelectedSongs() {
        if (!list || selectedIndices.length === 0) return
        const sorted = [...selectedIndices].sort((a, b) => b - a)
        for (const idx of sorted) {
            list.removeSong(idx)
        }

        selectedIndices = []
        listEditingState.isEditing = false
    }

    function editSelectedSong() {
        if (!list || selectedIndices.length !== 1) return
        const idx = selectedIndices[0]
        const songItem = listItems[idx]
        if (!songItem || songItem.isDeleted) return

        if (songItem.isSection) {
            listEditingState.selectedIndex = idx
            setActivePopup("rename_section")
            return
        }

        savedFullscreenPosition.index = idx
        setActivePage("song_edit", songItem.songId, songItem.name)
    }

    $effect(() => {
        if (isEditing) {
            listEditingState.onDeleteSelected = removeSelectedSongs
            if (selectedIndices.length === 0 && listItems.length > 0) {
                selectedIndices = [0]
            }
            if (selectedIndices.length === 1) {
                const item = listItems[selectedIndices[0]]
                listEditingState.selectedIndex = selectedIndices[0]
                listEditingState.onEditSelected = item && !item.isDeleted ? editSelectedSong : undefined
            } else {
                listEditingState.onEditSelected = undefined
                listEditingState.selectedIndex = undefined
            }
        } else {
            listEditingState.onDeleteSelected = undefined
            listEditingState.onEditSelected = undefined
            listEditingState.selectedIndex = undefined
            selectedIndices = []
        }
    })

    $effect(() => {
        if (list) {
            if (!list.lastUsedAt || Date.now() - list.lastUsedAt > 60 * 1000) {
                list.touch()
            }
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
        return base.filter(({ item: songItem }) => songItem.name.toLowerCase().includes(searchQuery) || (songItem.song?.metadata?.artist && songItem.song.metadata.artist.toLowerCase().includes(searchQuery)))
    })

    function onBatchMove(fromIndices: number[], targetIdx: number) {
        if (!list || fromIndices.length === 0) return
        const { updatedList, newSelectedIndices } = applyBatchMove(list.songs, fromIndices, targetIdx)
        list.setSongs(updatedList)
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

    /**
     * Ensures edit mode is active and the targeted item is part of the batch before dragging.
     */
    function prepareImmediateDrag(originalIdx: number) {
        endPress()
        if (!listEditingState.isEditing) {
            listEditingState.isEditing = true
        }
        if (!selectedIndices.includes(originalIdx)) {
            selectedIndices = [originalIdx]
        }
    }

    function handleImmediateDragStart(e: DragEvent, originalIdx: number) {
        prepareImmediateDrag(originalIdx)
        handleItemDragStart(e, originalIdx, selectedIndices, reorderState)
    }

    function handleImmediatePointerDragStart(e: PointerEvent, originalIdx: number) {
        prepareImmediateDrag(originalIdx)
        handlePointerDragStart(e, originalIdx, selectedIndices, reorderState, onBatchMove)
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
        if (item.isDeleted || item.isSection) return

        savedFullscreenPosition.index = originalIdx
        setActivePage("song", item.songId, item.name)
    }
</script>

<main>
    {#if listItems.length}
        <md-list class="song-list scroll-list" ondragover={(e: DragEvent) => handleContainerDragOver(e, listItems.length, reorderState)} ondrop={(e: DragEvent) => handleContainerDrop(e, listItems.length, reorderState, onBatchMove)}>
            {#each displaySongs as { item: songItem, originalIdx }, idx ((songItem.songId ?? songItem.id ?? "item") + "-" + originalIdx)}
                {@const isGhost = reorderState.draggedIdx !== null && (reorderState.draggedIndices.length > 0 ? reorderState.draggedIndices.includes(originalIdx) : originalIdx === reorderState.draggedIdx)}
                {@const isSelected = isEditing && selectedIndices.includes(originalIdx)}
                {@const artist = songItem.song?.metadata?.artist || (songItem.song?.getMetadata ? songItem.song.getMetadata("artist") : "")}
                {@const key = songItem.transposed || songItem.song?.metadata?.key || (songItem.song?.getMetadata ? songItem.song.getMetadata("key") : "")}
                <div
                    role="listitem"
                    class="song-item-wrapper"
                    class:ghost={isGhost}
                    data-reorder-idx={idx}
                    transition:slide={{ duration: 250 }}
                    draggable="true"
                    ondragstart={(e) => handleImmediateDragStart(e, originalIdx)}
                    ondragover={(e) => handleItemDragOver(e, idx, reorderState)}
                    ondrop={(e) => handleItemDrop(e, idx, reorderState, onBatchMove)}
                    ondragend={() => resetDragState(reorderState)}
                >
                    <md-list-item
                        type="button"
                        class:selected={isSelected}
                        class:deleted-item={songItem.isDeleted}
                        class:section-item={songItem.isSection}
                        disabled={songItem.isDeleted && !isEditing}
                        onpointerdown={(e: PointerEvent) => startPress(e, originalIdx)}
                        onpointerup={endPress}
                        onpointerleave={endPress}
                        oncontextmenu={(e: MouseEvent) => handleContextMenu(e, originalIdx)}
                        onclick={() => handleItemClick(songItem, originalIdx)}
                    >
                        {#if isEditing}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div slot="start" class="drag-handle-container" title="Drag to reorder" onpointerdown={(e) => handleImmediatePointerDragStart(e, originalIdx)}>
                                <span class="material-symbols-outlined drag-handle">drag_handle</span>
                            </div>
                        {:else if songItem.isSection}
                            <md-icon slot="start" class="section-icon">bookmark</md-icon>
                        {:else if songItem.isDeleted}
                            <md-icon slot="start" style="opacity: 0.4;">music_off</md-icon>
                        {:else}
                            <md-icon slot="start">music_note</md-icon>
                        {/if}

                        <div slot="headline" class="song-headline" class:deleted={songItem.isDeleted} class:section-headline={songItem.isSection}>
                            {songItem.name}
                            {#if songItem.isDeleted}
                                <span class="deleted-tag">{t("list", "deleted")}</span>
                            {/if}
                        </div>

                        {#if !songItem.isDeleted && !songItem.isSection && (artist || key)}
                            <div slot="supporting-text">
                                {artist || ""}
                                {#if artist && key}
                                    •
                                {/if}
                                {#if key}{t("common", "key")}: {key}{/if}
                            </div>
                        {/if}

                        {#if isEditing}
                            <div slot="end" class="song-controls"></div>
                        {:else if !songItem.isDeleted && !songItem.isSection}
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
    {#if isEditing}
        <md-fab aria-label={t("common", "done")} onclick={() => (listEditingState.isEditing = false)}>
            <span class="material-symbols-outlined" slot="icon">check</span>
        </md-fab>
    {:else}
        <md-fab aria-label={t("common", "add")} onclick={() => setActivePage("all_songs", listId, t("pages", "add_songs"))}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    {/if}
</div>

<style>
    main {
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 64px - 6px);
        min-height: calc(100dvh - 64px - 6px);
    }

    .song-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 100%;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .song-item-wrapper {
        position: relative;
        transition:
            transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            opacity 0.2s ease;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }
    .song-item-wrapper.ghost {
        opacity: 0.25;
        background: var(--md-sys-color-surface-container-high, #e6e0e9);
        border-radius: 8px;
    }
    md-list-item {
        min-height: 56px;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
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
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
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

    .section-headline {
        font-weight: 600;
        font-size: 0.92rem;
        color: var(--md-sys-color-primary);
        letter-spacing: 0.5px;
    }

    .section-icon {
        color: var(--md-sys-color-primary);
        --md-icon-size: 20px;
    }

    md-list-item.section-item {
        min-height: 40px;
        --md-list-item-one-line-container-height: 40px;
        --md-list-item-top-space: 4px;
        --md-list-item-bottom-space: 4px;
        background-color: var(--md-sys-color-surface-container-low, rgba(0, 0, 0, 0.03));
        border-top: 2px solid rgba(0, 0, 0, 0.04);
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
