<script lang="ts">
    import { Lists } from "$lib/models/List"
    import { t } from "$lib/state/i18n.svelte"
    import { listSortState } from "$lib/state/listSort.svelte"
    import { menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let lists = $derived(Lists.get(storage.lists, menuState.contentId, listSortState.sortBy))
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
</script>

<main>
    {#if filteredLists.length}
        <md-list class="list scroll-list">
            {#each filteredLists as list, idx}
                {@const count = list.songs?.filter((s) => s.type !== "section").length ?? 0}
                {@const dateStr = list.createdAt ? new Date(list.createdAt).toLocaleDateString() : "—"}
                {@const prevDateStr = idx > 0 ? (filteredLists[idx - 1].createdAt ? new Date(filteredLists[idx - 1].createdAt).toLocaleDateString() : "—") : null}
                {@const showDateHeader = isDateSort && (idx === 0 || dateStr !== prevDateStr)}

                {#if showDateHeader}
                    <div class="group-header">
                        <span>{dateStr}</span>
                    </div>
                {/if}

                <md-list-item type="button" onclick={() => openList(list.id, list.name)}>
                    <div slot="headline">{list.name}</div>
                    <md-icon slot="start">list</md-icon>
                    <span slot="trailing-supporting-text" class="item-count">{count}</span>
                    <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
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
                <span class="material-symbols-outlined empty-icon">list</span>
                <h2>{t("empty_state", "no_lists_title")}</h2>
                <p>{t("empty_state", "no_lists_desc")}</p>
            </div>
        </div>
    {/if}
</main>

<div class="fab-container">
    <md-fab aria-label="Add" onclick={() => setActivePopup("create_list")}>
        <span class="material-symbols-outlined" slot="icon">add</span>
    </md-fab>
</div>

<style>
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
</style>
