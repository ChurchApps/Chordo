<script lang="ts">
    import { Folders } from "$lib/models/Folder"
    import { pasteSharedFromClipboard } from "$lib/share/share"
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { isIosStandalone } from "$lib/utils/iosPwa"

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
        return storage.songs.filter((s) => s.name.toLowerCase().includes(searchQuery) || (s.metadata?.artist && s.metadata.artist.toLowerCase().includes(searchQuery)))
    })

    let totalResults = $derived(matchedFolders.length + matchedLists.length + matchedSongs.length)

    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

    let recentLists = $derived.by(() => {
        const now = Date.now()
        const oneMonthAgo = now - ONE_MONTH_MS

        return storage.lists
            .map((list) => ({
                list,
                lastUsed: list.lastUsedAt ?? list.createdAt
            }))
            .filter(({ lastUsed }) => lastUsed && lastUsed >= oneMonthAgo)
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, 3)
            .map(({ list }) => list)
    })

    let isIosPwa = $derived(isIosStandalone())

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

<!-- Main Content: show folders or search results -->
<main>
    {#if isSearching}
        {#if totalResults > 0}
            <div class="search-results-container scroll-list">
                {#if matchedFolders.length > 0}
                    <div class="search-category-title">{t("search", "category_folders")} ({matchedFolders.length})</div>
                    <md-list class="folders-list">
                        {#each matchedFolders as folder}
                            {@const count = folder.getLists ? folder.getLists(storage.lists).length : (folder.lists?.length ?? 0)}
                            <md-list-item type="button" onclick={() => openFolder(folder.id, folder.name)}>
                                <div slot="headline">{folder.type === "shared" ? t("folder_types", "shared") : folder.name}</div>
                                <md-icon slot="start">{folder.type === "shared" ? "share" : "folder"}</md-icon>
                                <span slot="trailing-supporting-text" class="item-count">{count}</span>
                                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                            </md-list-item>
                        {/each}
                    </md-list>
                {/if}

                {#if matchedLists.length > 0}
                    <div class="search-category-title">{t("search", "category_lists")} ({matchedLists.length})</div>
                    <md-list class="folders-list">
                        {#each matchedLists as list}
                            {@const count = list.songs?.length ?? 0}
                            <md-list-item type="button" onclick={() => openList(list.id, list.name)}>
                                <div slot="headline">{list.name}</div>
                                <md-icon slot="start">list</md-icon>
                                <span slot="trailing-supporting-text" class="item-count">{count}</span>
                                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                            </md-list-item>
                        {/each}
                    </md-list>
                {/if}

                {#if matchedSongs.length > 0}
                    <div class="search-category-title">{t("search", "category_songs")} ({matchedSongs.length})</div>
                    <md-list class="folders-list">
                        {#each matchedSongs as song}
                            {@const artist = song.metadata?.artist || (song.getMetadata ? song.getMetadata("artist") : "")}
                            {@const key = song.metadata?.key || (song.getMetadata ? song.getMetadata("key") : "")}
                            <md-list-item type="button" onclick={() => openSong(song.id, song.name)}>
                                <div slot="headline">{song.name}</div>
                                {#if artist || key}
                                    <div slot="supporting-text">
                                        {artist || ""}
                                        {#if artist && key}
                                            •
                                        {/if}
                                        {#if key}{t("common", "key")}: {key}{/if}
                                    </div>
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
                    <h2>{t("search", "no_results")}</h2>
                    <p>{searchState.query}</p>
                </div>
            </div>
        {/if}
    {:else}
        <md-list class="folders-list scroll-list" style="overflow: initial;">
            {#if isIosPwa}
                <md-list-item type="button" onclick={() => pasteSharedFromClipboard()} class="paste-shared-item">
                    <div slot="headline">{t("home", "paste_shared")}</div>
                    <div slot="supporting-text">{t("home", "paste_shared_desc")}</div>
                    <md-icon slot="start">content_paste</md-icon>
                    <md-icon slot="end" style="opacity: 0.8;">arrow_forward</md-icon>
                </md-list-item>
            {/if}
            <md-list-item type="button" onclick={() => openAllSongs()}>
                <div slot="headline">{t("pages", "all_songs")}</div>
                <md-icon slot="start">library_music</md-icon>
                <span slot="trailing-supporting-text" class="item-count">{storage.songs.length}</span>
                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
            </md-list-item>
        </md-list>

        <hr />

        {#if recentLists.length > 0}
            <div class="section-title">{t("home", "recently_used")}</div>
            <md-list class="folders-list scroll-list" style="overflow: initial;">
                {#each recentLists as list}
                    {@const count = list.songs?.length ?? 0}
                    <md-list-item type="button" onclick={() => openList(list.id, list.name)}>
                        <div slot="headline">{list.name}</div>
                        <md-icon slot="start">list</md-icon>
                        <span slot="trailing-supporting-text" class="item-count">{count}</span>
                        <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                    </md-list-item>
                {/each}
            </md-list>

            <hr />
        {/if}

        {#if folders.length}
            <div class="section-title">{t("search", "category_folders")}</div>
            <md-list class="folders-list scroll-list">
                {#each folders as folder}
                    {@const count = folder.getLists ? folder.getLists(storage.lists).length : (folder.lists?.length ?? 0)}
                    <md-list-item type="button" onclick={() => openFolder(folder.id, folder.name)}>
                        <div slot="headline">{folder.type === "shared" ? t("folder_types", "shared") : folder.name}</div>
                        <md-icon slot="start">{folder.type === "shared" ? "share" : "folder"}</md-icon>
                        <span slot="trailing-supporting-text" class="item-count">{count}</span>
                        <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                    </md-list-item>
                {/each}
            </md-list>
        {:else}
            <div class="center">
                <div class="empty-state">
                    <span class="material-symbols-outlined empty-icon">folder</span>
                    <h2>{t("empty_state", "no_folders_title")}</h2>
                    <p>{t("empty_state", "no_folders_desc")}</p>
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

<style>
    .search-results-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }

    .section-title,
    .search-category-title {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--md-sys-color-on-primary-container, #002020);
        opacity: 0.7;
        padding: 12px 16px 4px 16px;
    }
</style>
