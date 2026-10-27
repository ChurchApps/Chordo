<script lang="ts">
    import { integrationState } from "$lib/integrations/integrationState.svelte"
    import type { Folder } from "$lib/models/Folder"
    import type { List } from "$lib/models/List"
    import type { Song } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePage } from "$lib/state/menu.svelte"
    import { searchNamedItems, searchSongs, searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import type { Snippet } from "svelte"

    interface Props {
        folders?: Folder[]
        lists?: List[]
        songs?: Song[]
        onSelectFolder?: (folder: Folder) => void
        onSelectList?: (list: List) => void
        onSelectSong?: (song: Song) => void
        query?: string
        children?: Snippet
    }

    let { folders = [], lists = [], songs = [], onSelectFolder, onSelectList, onSelectSong, query = searchState.query, children }: Props = $props()

    // Automatically filter items using the shared priority ranking
    let filteredFolders = $derived(folders.length > 0 ? searchNamedItems(folders, query) : [])
    let filteredLists = $derived(lists.length > 0 ? searchNamedItems(lists, query) : [])
    let filteredSongs = $derived(songs.length > 0 ? searchSongs(songs, query) : [])

    let hasProvidedItems = $derived(filteredFolders.length > 0 || filteredLists.length > 0 || filteredSongs.length > 0)

    function handleFolderClick(folder: Folder) {
        if (onSelectFolder) onSelectFolder(folder)
        else setActivePage("folder", folder.id, folder.name)
    }

    function handleListClick(list: List) {
        if (onSelectList) onSelectList(list)
        else setActivePage("list", list.id, list.name)
    }

    function handleSongClick(song: Song) {
        if (onSelectSong) onSelectSong(song)
        else setActivePage("song", song.id, song.name)
    }
</script>

{#if children}
    {@render children()}
{:else if hasProvidedItems}
    <div class="search-results-container scroll-list">
        {#if filteredFolders.length > 0}
            <div class="search-category-title">
                {t("search", "category_folders")}
                {#if filteredFolders.length > 1}({filteredFolders.length}){/if}
            </div>

            <md-list class="search-list">
                {#each filteredFolders as folder}
                    {@const count = folder.getLists ? folder.getLists(storage.lists).length : (folder.lists?.length ?? 0)}
                    <md-list-item type="button" onclick={() => handleFolderClick(folder)}>
                        <div slot="headline">{folder.type === "shared" ? t("folder_types", "shared") : folder.name}</div>
                        <md-icon slot="start">{folder.type === "shared" ? "share" : "folder"}</md-icon>
                        <span slot="trailing-supporting-text" class="item-count">{count}</span>
                        <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                    </md-list-item>
                {/each}
            </md-list>
        {/if}

        {#if filteredLists.length > 0}
            <div class="search-category-title">
                {t("search", "category_lists")}
                {#if filteredLists.length > 1}({filteredLists.length}){/if}
            </div>

            <md-list class="search-list">
                {#each filteredLists as list}
                    {@const count = list.songs?.filter((s) => s.type !== "section").length ?? 0}
                    {@const planStatus = integrationState.getPlanStatus(list.id)}
                    <md-list-item type="button" onclick={() => handleListClick(list)}>
                        <div slot="headline" class="list-headline-row">
                            <span>{list.name}</span>
                            {#if planStatus === "new"}
                                <span class="plan-badge new">{t("common", "new")}</span>
                            {:else if planStatus === "changed"}
                                <span class="plan-badge changed">{t("common", "changed")}</span>
                            {/if}
                        </div>
                        <md-icon slot="start">list</md-icon>
                        <span slot="trailing-supporting-text" class="item-count">{count}</span>
                        <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                    </md-list-item>
                {/each}
            </md-list>
        {/if}

        {#if filteredSongs.length > 0}
            <div class="search-category-title">
                {t("search", "category_songs")}
                {#if filteredSongs.length > 1}({filteredSongs.length}){/if}
            </div>

            <md-list class="search-list">
                {#each filteredSongs as song}
                    {@const artist = song.metadata?.artist || (song.getMetadata ? song.getMetadata("artist") : "")}
                    {@const key = song.metadata?.key || (song.getMetadata ? song.getMetadata("key") : "")}
                    <md-list-item type="button" onclick={() => handleSongClick(song)}>
                        <div slot="headline">{song.name}</div>
                        {#if artist || key}
                            <div slot="supporting-text">
                                {#if artist}<span class="supporting-artist">{artist}</span>{/if}
                                {#if key}<span class="supporting-key"
                                        >{#if artist}&nbsp;•&nbsp;{/if}{t("common", "key")}: {key}</span
                                    >{/if}
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
            <!-- {#if query}<p>{query}</p>{/if} -->
        </div>
    </div>
{/if}

<style>
    .search-results-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
    }

    .search-category-title {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--md-sys-color-on-primary-container, #002020);
        opacity: 0.7;
        padding: 12px 16px 4px 16px;
    }

    .list-headline-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .plan-badge {
        font-size: 0.7rem;
        font-weight: 700;
        line-height: 1;
        padding: 2px 6px;
        border-radius: 9999px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .plan-badge.new {
        background: #2e7d32;
        color: #ffffff;
    }

    .plan-badge.changed {
        background: #ed6c02;
        color: #ffffff;
    }

    .supporting-artist {
        font-weight: 500;
    }

    .supporting-key {
        opacity: 0.8;
    }
</style>
