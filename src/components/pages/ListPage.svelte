<script lang="ts">
    import { getExternalSong, getPlanAsList, integrationState } from "$lib/integrations/integrationState.svelte"
    import type { ListSongDisplayItem } from "$lib/models/List"
    import { t } from "$lib/state/i18n.svelte"
    import { listEditingState, menuState, savedFullscreenPosition, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchListDisplayItems, searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { createHoldToSelect } from "$lib/utils/holdToSelect"
    import { applyBatchMove, getDisplayList, handleContainerDragOver, handleContainerDrop, handleItemDragOver, handleItemDragStart, handleItemDrop, handlePointerDragStart, resetDragState, type ReorderState } from "$lib/utils/rearrange"
    import { onDestroy, untrack } from "svelte"
    import { slide } from "svelte/transition"
    import SearchResults from "../common/SearchResults.svelte"
    import Song from "../song/Song.svelte"

    onDestroy(() => {
        selection.clearTimer()
    })

    let listId = $derived(menuState.contentId)
    let isExternal = $derived(!storage.getListById(listId, storage.lists) && !!getPlanAsList(listId))
    let list = $derived(storage.getListById(listId, storage.lists) || getPlanAsList(listId))
    let listItems = $derived(list ? list.getListItems(storage.songs, getExternalSong) : [])

    let lastTouchedListId: string | null = null
    $effect(() => {
        const id = listId
        if (id && id !== lastTouchedListId) {
            lastTouchedListId = id
            untrack(() => {
                const target = storage.getListById(id)
                target?.touch()
                if (isExternal) integrationState.markPlanAsSeen(id)
            })
        }
    })

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)

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

        if (songItem.type === "section") {
            listEditingState.selectedIndex = idx
            setActivePopup("rename_section")
            return
        }

        savedFullscreenPosition.pageIndex = null
        savedFullscreenPosition.index = idx
        setActivePage("song_edit", songItem.id, songItem.name)
    }

    $effect(() => {
        if (isEditing) {
            listEditingState.onDeleteSelected = selectedIndices.length > 0 ? removeSelectedSongs : undefined
            if (selectedIndices.length === 1) {
                const item = listItems[selectedIndices[0]]
                listEditingState.selectedIndex = selectedIndices[0]
                listEditingState.onEditSelected = item && !item.isDeleted ? editSelectedSong : undefined
                listEditingState.editActionType = item?.type === "section" ? "rename" : "edit"
            } else {
                listEditingState.onEditSelected = undefined
                listEditingState.selectedIndex = undefined
                listEditingState.editActionType = undefined
            }
        } else {
            listEditingState.onDeleteSelected = undefined
            listEditingState.onEditSelected = undefined
            listEditingState.selectedIndex = undefined
            listEditingState.editActionType = undefined
            selectedIndices = []
        }
    })

    const selection = createHoldToSelect(
        () => selectedIndices,
        (indices) => (selectedIndices = indices),
        { disabled: () => isExternal }
    )

    let reorderState = $state<ReorderState>({
        draggedIdx: null,
        draggedIndices: [],
        dragOverIdx: null
    })

    let filteredItems = $derived.by(() => {
        const base = getDisplayList(listItems, reorderState)
        if (!isSearching) return base
        return searchListDisplayItems(base, searchState.query)
    })

    function onDragEnd() {
        resetDragState(reorderState)
    }

    function onBatchMove(fromIndices: number[], targetIdx: number) {
        if (!list || fromIndices.length === 0) return
        const { updatedList } = applyBatchMove(list.songs, fromIndices, targetIdx)
        const isChanged = updatedList.length !== list.songs.length || updatedList.some((item, i) => item !== list.songs[i])
        if (isChanged) {
            list.setSongs(updatedList)
            selectedIndices = []
        }
    }

    /**
     * Ensures edit mode is active and the targeted item is part of the batch before dragging.
     */
    function prepareImmediateDrag(originalIdx: number) {
        selection.clearTimer()
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
        handlePointerDragStart(e, originalIdx, selectedIndices, reorderState, onBatchMove, onDragEnd)
    }

    function handleItemClick(item: ListSongDisplayItem, originalIdx: number) {
        if (selection.handleClick(originalIdx, false)) return
        if (item.isDeleted) return

        savedFullscreenPosition.pageIndex = null
        savedFullscreenPosition.index = originalIdx
        setActivePage("song", item.id ?? null, item.name)
    }
</script>

<main>
    {#if filteredItems.length}
        <md-list class="song-list scroll-list" ondragover={(e: DragEvent) => handleContainerDragOver(e, listItems.length, reorderState)} ondrop={(e: DragEvent) => handleContainerDrop(e, listItems.length, reorderState, onBatchMove)}>
            {#each filteredItems as { item: songItem, originalIdx }, idx ((songItem.id ?? "item") + "-" + originalIdx)}
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
                    ondragend={onDragEnd}
                >
                    <md-list-item
                        type="button"
                        class:selected={isSelected}
                        class:deleted-item={songItem.isDeleted}
                        class:section-item={songItem.type === "section"}
                        disabled={songItem.isDeleted && !isEditing}
                        onpointerdown={(e: PointerEvent) => selection.startPress(e, originalIdx)}
                        onpointerup={selection.endPress}
                        onpointerleave={selection.endPress}
                        oncontextmenu={(e: MouseEvent) => selection.handleContextMenu(e, originalIdx)}
                        onclick={() => handleItemClick(songItem, originalIdx)}
                    >
                        {#if isEditing}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div slot="start" class="drag-handle-container" title="Drag to reorder" onpointerdown={(e) => handleImmediatePointerDragStart(e, originalIdx)}>
                                <span class="material-symbols-outlined drag-handle">drag_handle</span>
                            </div>
                        {:else if songItem.type === "section"}
                            <md-icon slot="start" class="section-icon">bookmark</md-icon>
                        {:else if songItem.isDeleted}
                            <md-icon slot="start" style="opacity: 0.4;">music_off</md-icon>
                        {:else}
                            <md-icon slot="start">music_note</md-icon>
                        {/if}

                        <div slot="headline" class="song-headline" class:deleted={songItem.isDeleted} class:section-headline={songItem.type === "section"}>
                            {songItem.name}
                            {#if songItem.isDeleted}
                                <span class="deleted-tag">{t("list", "deleted")}</span>
                            {/if}
                        </div>

                        {#if !songItem.isDeleted && songItem.type !== "section" && (artist || key)}
                            <div slot="supporting-text">
                                {#if artist}<span class="supporting-artist">{artist}</span>{/if}
                                {#if key}<span class="supporting-key"
                                        >{#if artist}&nbsp;•&nbsp;{/if}{t("common", "key")}: {key}</span
                                    >{/if}
                            </div>
                        {/if}

                        {#if !isEditing && !songItem.isDeleted && songItem.type !== "section"}
                            <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                        {/if}
                    </md-list-item>
                </div>
            {/each}
        </md-list>
    {:else if isSearching}
        <SearchResults />
    {:else}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">library_music</span>
                <h2>{t("empty_state", "no_songs_title")}</h2>
                {#if !isExternal}
                    <p>{t("empty_state", "no_songs_desc")}</p>
                {:else}
                    <md-outlined-button onclick={() => integrationState.syncPlans()} style="margin-top: 16px;">
                        <span class="material-symbols-outlined" slot="icon">refresh</span>
                        {t("common", "refresh")}
                    </md-outlined-button>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Print-only full setlist sheets -->
    {#if list && list.songs?.length}
        <div class="print-setlist-container">
            {#each list.songs as songItem, idx ((songItem?.id ?? "song") + "-" + idx)}
                {@const isSection = songItem?.type === "section"}
                {@const songId = isSection ? null : (songItem?.id ?? null)}
                {@const currentSong = songId ? storage.getSongById(songId, storage.songs) : null}
                {@const targetKey = songItem?.transposed || currentSong?.lastTransposed}

                {#if isSection}
                    <div class="print-section-divider">
                        <div class="print-section-line"></div>
                        <div class="print-section-content">
                            <span class="material-symbols-outlined print-section-icon">bookmark</span>
                            <span class="print-section-title">{songItem.name}</span>
                        </div>
                        <div class="print-section-line"></div>
                    </div>
                {:else if currentSong}
                    <div class="print-song-item">
                        <Song {songId} {targetKey} />
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</main>

{#if !isExternal}
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
{/if}

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
        background-color: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.08));
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
        color: var(--md-sys-color-on-surface, #1b1b1f);
        letter-spacing: 0.5px;
    }

    .section-icon {
        color: var(--md-sys-color-on-surface, #1b1b1f);
        --md-icon-size: 24px;
        font-size: 20px;
    }

    md-list-item.section-item {
        min-height: 40px;
        --md-list-item-one-line-container-height: 40px;
        --md-list-item-top-space: 4px;
        --md-list-item-bottom-space: 4px;
        background-color: var(--md-sys-color-surface-container-low, rgba(0, 0, 0, 0.03));
        border-top: 2px solid rgba(0, 0, 0, 0.04);
    }
    md-list-item.section-item.selected {
        background-color: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.08));
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

    .print-setlist-container {
        display: none;
    }

    @media print {
        .song-list,
        .center,
        .fab-container {
            display: none !important;
        }

        .print-setlist-container {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 24px !important;
        }

        .print-song-item {
            width: 100% !important;
            break-before: page !important;
            page-break-before: always !important;
        }

        .print-setlist-container > .print-song-item:first-child {
            break-before: auto !important;
            page-break-before: auto !important;
        }

        .print-section-divider {
            display: flex !important;
            align-items: center !important;
            gap: 16px !important;
            padding-top: 50px !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }

        .print-section-line {
            flex: 1 !important;
            height: 1px !important;
            background: rgba(0, 0, 0, 0.25) !important;
        }

        .print-section-content {
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .print-section-icon {
            font-size: 40px !important;
            color: #000000 !important;
        }

        .print-section-title {
            font-weight: 700 !important;
            font-size: 2rem !important;
            color: #000000 !important;
            letter-spacing: 0.5px !important;
        }
    }
</style>
