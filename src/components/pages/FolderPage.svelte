<script lang="ts">
    import { Lists } from "$lib/models/List"
    import { menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let lists = $derived(Lists.get(storage.lists, menuState.contentId))

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
            {#each filteredLists as list}
                <md-list-item type="button" onclick={() => openList(list.id, list.name)}>
                    <div slot="headline">{list.name}</div>
                    <md-icon slot="start">list</md-icon>
                    <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                </md-list-item>
            {/each}
        </md-list>
    {:else if isSearching}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">search_off</span>
                <h2>No lists found</h2>
                <p>No lists match "{searchState.query}".</p>
            </div>
        </div>
    {:else}
        <div class="center">
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">list</span>
                <h2>No lists yet</h2>
                <p>Tap the + button in the bottom right to create your first list where you can add songs.</p>
            </div>
        </div>
    {/if}
</main>

<div class="fab-container">
    <md-fab aria-label="Add" onclick={() => setActivePopup("create_list")}>
        <span class="material-symbols-outlined" slot="icon">add</span>
    </md-fab>
</div>
