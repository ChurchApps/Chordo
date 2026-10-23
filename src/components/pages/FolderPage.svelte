<script lang="ts">
    import { getCachedPlansAsLists, integrationState } from "$lib/integrations/integrationState.svelte"
    import { Lists } from "$lib/models/List"
    import { t } from "$lib/state/i18n.svelte"
    import { listSortState, sortLists } from "$lib/state/listSort.svelte"
    import { listEditingState, menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { formatDate } from "$lib/utils/common"
    import { createHoldToSelect } from "$lib/utils/holdToSelect"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import "@material/web/progress/linear-progress.js"
    import { onMount } from "svelte"

    let folderId = $derived(menuState.contentId)
    let activeProvider = $derived(integrationState.getActiveProvider())
    let isExternalFolder = $derived(!!activeProvider && folderId === activeProvider.id)

    onMount(() => {
        if (isExternalFolder) integrationState.syncPlans(false)
    })

    let lists = $derived(isExternalFolder ? sortLists(getCachedPlansAsLists(), listSortState.sortBy) : Lists.get(storage.lists, folderId, listSortState.sortBy))
    let isDateSort = $derived(listSortState.sortBy.startsWith("date"))

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)
    let searchQuery = $derived(searchState.query.trim().toLowerCase())

    let filteredLists = $derived.by(() => {
        if (!isSearching) return lists
        return lists.filter((l) => l.name.toLowerCase().includes(searchQuery))
    })

    function openList(listId: string, listName: string) {
        setActivePage("list", listId, listName)
    }

    let isEditing = $derived(listEditingState.isEditing)
    let selectedListIds = $state<string[]>([])

    function removeSelectedLists() {
        if (selectedListIds.length === 0) return
        const count = selectedListIds.length
        const message = count === 1 ? t("confirm", "delete_list_msg") : t("confirm", "delete_lists_msg").replace("{count}", count.toString())

        openConfirm({
            title: count === 1 ? t("confirm", "delete_list_title") : t("confirm", "delete_lists_title"),
            message,
            confirmLabel: t("common", "delete"),
            isDestructive: true,
            onConfirm: () => {
                const idsToDelete = [...selectedListIds]
                for (const id of idsToDelete) {
                    storage.deleteList(id)
                }
                selectedListIds = []
                listEditingState.isEditing = false
            }
        })
    }

    function renameSelectedList() {
        if (selectedListIds.length !== 1) return
        const listId = selectedListIds[0]
        setActivePopup("rename_list", listId)
    }

    function duplicateSelectedLists() {
        if (selectedListIds.length === 0) return
        for (const listId of selectedListIds) {
            if (isExternalFolder) {
                const plan = integrationState.cachedPlans.find((p) => p.id === listId)
                if (plan) {
                    integrationState.duplicatePlanToLocal(plan)
                }
            } else {
                Lists.duplicate(listId)
            }
        }
        selectedListIds = []
        listEditingState.isEditing = false
    }

    function moveSelectedLists() {
        if (selectedListIds.length === 0) return
        setActivePopup("move_lists", selectedListIds.join(","))
    }

    $effect(() => {
        if (!isExternalFolder && isEditing) {
            listEditingState.onMoveSelected = selectedListIds.length > 0 ? moveSelectedLists : undefined
            listEditingState.onDeleteSelected = selectedListIds.length > 0 ? removeSelectedLists : undefined
            listEditingState.onEditSelected = selectedListIds.length === 1 ? renameSelectedList : undefined
            listEditingState.editActionType = selectedListIds.length === 1 ? "rename" : undefined
            listEditingState.onDuplicateSelected = selectedListIds.length > 0 ? duplicateSelectedLists : undefined
        } else if (isExternalFolder && isEditing) {
            listEditingState.onMoveSelected = undefined
            listEditingState.onDeleteSelected = undefined
            listEditingState.onEditSelected = undefined
            listEditingState.editActionType = undefined
            listEditingState.onDuplicateSelected = selectedListIds.length > 0 ? duplicateSelectedLists : undefined
        } else {
            listEditingState.onMoveSelected = undefined
            listEditingState.onDeleteSelected = undefined
            listEditingState.onEditSelected = undefined
            listEditingState.editActionType = undefined
            listEditingState.onDuplicateSelected = undefined
            selectedListIds = []
        }
    })

    const selection = createHoldToSelect(
        () => selectedListIds,
        (ids) => (selectedListIds = ids)
    )

    function handleListClick(listId: string, listName: string) {
        if (selection.handleClick(listId)) return
        openList(listId, listName)
    }
</script>

<main>
    {#if isExternalFolder && integrationState.isLoading}
        <div class="loader-bar">
            <md-linear-progress indeterminate></md-linear-progress>
        </div>
    {/if}

    {#if filteredLists.length}
        <md-list class="list scroll-list">
            {#each filteredLists as list, idx}
                {@const isSelected = isEditing && selectedListIds.includes(list.id)}
                {@const count = list.songs?.filter((s) => s.type !== "section").length ?? 0}
                {@const dateStr = list.createdAt ? formatDate(list.createdAt) : ""}
                {@const prevList = idx > 0 ? filteredLists[idx - 1] : null}
                {@const prevDateStr = prevList && prevList.createdAt ? formatDate(prevList.createdAt) : null}
                {@const showDateHeader = isDateSort && (idx === 0 || dateStr !== prevDateStr)}

                {#if showDateHeader && dateStr}
                    <div class="group-header">
                        <span>{dateStr}</span>
                    </div>
                {/if}

                {@const planStatus = isExternalFolder ? integrationState.getPlanStatus(list.id) : null}

                <md-list-item
                    type="button"
                    class:selected={isSelected}
                    onpointerdown={(e: PointerEvent) => selection.startPress(e, list.id)}
                    onpointerup={selection.endPress}
                    onpointerleave={selection.endPress}
                    oncontextmenu={(e: MouseEvent) => selection.handleContextMenu(e, list.id)}
                    onclick={() => handleListClick(list.id, list.name)}
                >
                    <div slot="headline" class="list-headline-row">
                        <span>{list.name}</span>

                        {#if planStatus === "new"}
                            <span class="plan-badge new">{t("common", "new")}</span>
                        {:else if planStatus === "changed"}
                            <span class="plan-badge changed">{t("common", "changed")}</span>
                        {/if}
                    </div>

                    {#if isExternalFolder && dateStr && !showDateHeader}
                        <div slot="supporting-text">{dateStr}</div>
                    {/if}
                    <md-icon slot="start">list</md-icon>
                    {#if isEditing}
                        {#if isSelected}
                            <md-icon slot="end" style="color: var(--md-sys-color-primary);">check_circle</md-icon>
                        {:else}
                            <md-icon slot="end" style="opacity: 0.4;">radio_button_unchecked</md-icon>
                        {/if}
                    {:else}
                        <span slot="trailing-supporting-text" class="item-count">{count}</span>
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
    {:else if isExternalFolder}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">event_busy</span>
                <h2>{t("empty_state", "no_plans_title")}</h2>
                <p>{t("empty_state", "no_plans_desc")}</p>
                <md-outlined-button onclick={() => integrationState.syncPlans()} style="margin-top: 16px;">
                    <span class="material-symbols-outlined" slot="icon">refresh</span>
                    {t("common", "refresh")}
                </md-outlined-button>
            </div>
        </div>
    {:else}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">list</span>
                <h2>{t("empty_state", "no_lists_title")}</h2>
                <p>{t("empty_state", "no_lists_desc")}</p>
            </div>
        </div>
    {/if}
</main>

{#if !isEditing && !isExternalFolder}
    <div class="fab-container">
        <md-fab aria-label="Add" onclick={() => setActivePopup("create_list")}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    </div>
{/if}

<style>
    .loader-bar {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        z-index: 10;
    }

    .loader-bar md-linear-progress {
        width: 100%;
        --md-linear-progress-track-height: 4px;
    }

    .group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--md-sys-color-primary);
        padding: 14px 16px 4px 16px;
        background: var(--md-sys-color-primary-container);
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .list-headline-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .list-headline-row > span:first-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .plan-badge {
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 1;
        padding: 3px 6px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        flex-shrink: 0;
    }

    .plan-badge.new {
        background: #2e7d32;
        color: #ffffff;
    }

    .plan-badge.changed {
        background: #e65100;
        color: #ffffff;
    }

    md-list-item.selected {
        background-color: rgb(255 255 255 / 0.3);
    }
</style>
