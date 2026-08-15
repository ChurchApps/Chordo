<script lang="ts">
    import { Folders } from "$lib/models/Folder"
    import { setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let folders = $derived(Folders.get(storage.folders))

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)
    let searchQuery = $derived(searchState.query.trim().toLowerCase())

    let matchedFolders = $derived.by(() => {
        if (!isSearching) return []
        return storage.folders.filter((f) => f.name.toLowerCase().includes(searchQuery))
    })

    let matchedLists = $derived.by(() => {
        if (!isSearching) return []
        return storage.lists.filter((l) => l.name.toLowerCase().includes(searchQuery))
    })

    let matchedSongs = $derived.by(() => {
        if (!isSearching) return []
        return storage.songs.filter(
            (s) =>
                s.name.toLowerCase().includes(searchQuery) ||
                (s.metadata?.artist && s.metadata.artist.toLowerCase().includes(searchQuery))
        )
    })

    let totalResults = $derived(matchedFolders.length + matchedLists.length + matchedSongs.length)

    function openFolder(id: string, name: string) {
        setActivePage("folder", id, name)
    }

    function openList(id: string, name: string) {
        setActivePage("list", id, name)
    }

    function openSong(id: string, name: string) {
        setActivePage("song", id, name)
    }

    function openAllSongs() {
        setActivePage("all_songs")
    }
</script>

<!-- TODO: icons should be offline -->
<!-- TODO: allow the user to create a bunch of songs before creating any folders/lists to get started...? -->
<!-- TODO: have a "All songs" custom folder - if any songs -->
<!-- TODO: lyrics only mode -->
<!-- TODO: Transpose / Nashville -->
<!-- TODO: print / share P2P -->
<!-- TODO: add spotify playback URLs -->

<!-- Main Content: show folders or search results -->
<main>
    {#if isSearching}
        {#if totalResults > 0}
            <div class="search-results-container scroll-list">
                {#if matchedFolders.length > 0}
                    <div class="search-category-title">Folders ({matchedFolders.length})</div>
                    <md-list class="folders-list">
                        {#each matchedFolders as folder}
                            <md-list-item type="button" onclick={() => openFolder(folder.id, folder.name)}>
                                <div slot="headline">{folder.name}</div>
                                <md-icon slot="start">folder</md-icon>
                                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                            </md-list-item>
                        {/each}
                    </md-list>
                {/if}

                {#if matchedLists.length > 0}
                    <div class="search-category-title">Lists ({matchedLists.length})</div>
                    <md-list class="folders-list">
                        {#each matchedLists as list}
                            <md-list-item type="button" onclick={() => openList(list.id, list.name)}>
                                <div slot="headline">{list.name}</div>
                                <md-icon slot="start">list</md-icon>
                                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                            </md-list-item>
                        {/each}
                    </md-list>
                {/if}

                {#if matchedSongs.length > 0}
                    <div class="search-category-title">Songs ({matchedSongs.length})</div>
                    <md-list class="folders-list">
                        {#each matchedSongs as song}
                            <md-list-item type="button" onclick={() => openSong(song.id, song.name)}>
                                <div slot="headline">{song.name}</div>
                                {#if song.metadata?.artist}
                                    <div slot="supporting-text">{song.metadata.artist}</div>
                                {/if}
                                <md-icon slot="start">music_note</md-icon>
                                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                            </md-list-item>
                        {/each}
                    </md-list>
                {/if}
            </div>
        {:else}
            <div class="center">
                <div class="empty-state">
                    <span class="material-symbols-outlined empty-icon">search_off</span>
                    <h2>No results found</h2>
                    <p>No folders, lists, or songs match "{searchState.query}".</p>
                </div>
            </div>
        {/if}
    {:else}
        <md-list class="folders-list scroll-list">
            <md-list-item type="button" onclick={() => openAllSongs()}>
                <div slot="headline">All songs</div>
                <md-icon slot="start">library_music</md-icon>
                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
            </md-list-item>
        </md-list>

        <hr />

        {#if folders.length}
            <md-list class="folders-list scroll-list">
                {#each folders as folder}
                    <md-list-item type="button" onclick={() => openFolder(folder.id, folder.name)}>
                        <div slot="headline">{folder.name}</div>
                        <md-icon slot="start">folder</md-icon>
                        <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                    </md-list-item>
                {/each}
            </md-list>
        {:else}
            <div class="center">
                <div class="empty-state">
                    <span class="material-symbols-outlined empty-icon">folder</span>
                    <h2>No folders yet</h2>
                    <p>Tap the + button in the bottom right to create your first folder to organize your content.</p>
                </div>
            </div>
        {/if}
    {/if}
</main>

{#if !isSearching}
    <div class="fab-container">
        <md-fab aria-label="Add" onclick={() => setActivePopup("create_folder")}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    </div>
{/if}

<!-- {#if addMenuOpen}
    <div class="speed-dial-menu" transition:fade={{ duration: 150 }}>
        <md-elevation></md-elevation>
        <md-text-button class="menu-item" onclick={() => openDialog("create_folder")}>
            <span style="display: flex;align-items: center;justify-content: right;gap: 12px;">
                <span class="material-symbols-outlined item-icon">folder</span>
                <span class="item-label">New Folder</span>
            </span>
        </md-text-button>
        <md-elevation></md-elevation>
        <md-text-button class="menu-item" onclick={() => openDialog("create_list")}>
            <span style="display: flex;align-items: center;justify-content: right;gap: 12px;">
                <span class="material-symbols-outlined item-icon">list</span>
                <span class="item-label">New List</span>
            </span>
        </md-text-button>
        <md-elevation></md-elevation>
        <md-text-button class="menu-item" onclick={() => openDialog("create_song")}>
            <span style="display: flex;align-items: center;justify-content: right;gap: 12px;">
                <span class="material-symbols-outlined item-icon">description</span>
                <span class="item-label">New Song</span>
            </span>
        </md-text-button>
    </div>
{/if}

<div class="fab-container">
    <md-fab aria-label="Add" onclick={() => (addMenuOpen = !addMenuOpen)}>
        <span class="material-symbols-outlined" slot="icon">
            {addMenuOpen ? "close" : "add"}
        </span>
    </md-fab>
</div> -->

<style>
    .search-results-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }

    .search-category-title {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--md-sys-color-on-primary, #044444);
        opacity: 0.7;
        padding: 12px 16px 4px 16px;
    }

    /* FAB Reveal Menu */
    /* .speed-dial-menu {
        position: fixed;
        bottom: 96px;
        right: 24px;
        z-index: 99;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: #2b2930;
        border-radius: 16px;
        padding: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);

        background-color: transparent;
        box-shadow: none;
        padding: 0;
        align-items: flex-end;
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: transparent;
        border: none;
        color: #e6e0e9;
        padding: 12px 16px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 0.95rem;
        font-family: inherit;
        transition: background-color 0.2s ease;

        width: fit-content;
        border-radius: 50px;
        background-color: #e6e0e9;
    }

    .menu-item:hover {
        background-color: rgba(208, 188, 255, 0.12);
    }

    .item-icon {
        color: #8c77bc;
    }

    md-text-button.folder-open,
    md-text-button.menu-item {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: var(--on-background);
    }

    md-text-button.menu-item :global(button) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    md-outlined-button.list-chip {
        margin-left: 6px;
        border-radius: 12px;
        padding: 6px 10px;
        color: var(--on-background);
        background: transparent;
    } */
</style>
