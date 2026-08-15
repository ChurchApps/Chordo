<script lang="ts">
    import { calculateTransposeSemitones, hasTransposableContent } from "$lib/chords/transpose"
    import type { Folder } from "$lib/models/Folder"
    import type { List } from "$lib/models/List"
    import type { Song } from "$lib/models/Song"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { getCurrentSong, goBack, isFullscreenPage, listEditingState, menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { closeSearch, openSearch, searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { shareList, shareSong } from "$lib/utils/share"
    import { pages } from "../pages/pages"

    let headerPath = $derived(
        menuState.previousPages.reduce((path, page) => {
            const title = page.customPageTitle
            if (title) path += title + " / "
            return path
        }, "")
    )

    let headerTitle = $derived(menuState.customPageTitle ?? pages[menuState.activePage]?.title ?? "")

    let isEditing = $derived(listEditingState.isEditing) // menuState.activePage === "list" && listEditingState.isEditing
    let moreMenuOpen = $state(false)

    let searchPlaceholder = $derived.by(() => {
        switch (menuState.activePage) {
            case "all_songs":
                return "Search songs..."
            case "folder":
                return "Search lists..."
            case "list":
                return "Search songs..."
            case "home":
            default:
                return "Search folders, lists, songs..."
        }
    })

    let searchInputElement = $state<HTMLInputElement | null>(null)

    $effect(() => {
        if (searchState.isOpen && searchInputElement) {
            searchInputElement.focus()
        }
    })

    // Active song context
    let activeSongContext = $derived(storage.songs && storage.lists ? getCurrentSong() : null)
    let currentSong = $derived(activeSongContext?.song ?? null)

    let canTranspose = $derived(currentSong ? hasTransposableContent(currentSong.content, currentSong.getMetadata("key"), currentSong.images) : false)

    // Semitone distance / count from base key
    let transposeCount = $derived.by(() => {
        if (!currentSong) return 0
        return calculateTransposeSemitones({
            targetKey: activeSongContext?.listItem?.transposed,
            lastTransposed: currentSong.lastTransposed,
            songKey: currentSong.getMetadata("key"),
            content: currentSong.content
        })
    })

    function confirmDeleteSong(song: Song | null) {
        if (!song) return
        openConfirm({
            title: "Delete Song?",
            message: `Are you sure you want to delete "${song.name}"? This action cannot be undone.`,
            confirmLabel: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                await storage.deleteSong(song.id)
                goBack()
            }
        })
    }

    function confirmDeleteList(list: List | null) {
        if (!list) return
        openConfirm({
            title: "Delete List?",
            message: `Are you sure you want to delete "${list.name}"?`,
            confirmLabel: "Delete",
            isDestructive: true,
            onConfirm: () => {
                storage.deleteList(list.id)
                goBack()
            }
        })
    }

    function confirmDeleteFolder(folder: Folder | null) {
        if (!folder) return
        openConfirm({
            title: "Delete Folder?",
            message: `Are you sure you want to delete folder "${folder.name}"?`,
            confirmLabel: "Delete",
            isDestructive: true,
            onConfirm: () => {
                storage.deleteFolder(folder.id)
                goBack()
            }
        })
    }
</script>

{#if isFullscreenPage(menuState.activePage)}
    <!-- don't show any headers -->
{:else if searchState.isOpen}
    <header class="top-app-bar search-mode">
        <md-icon-button aria-label="Close search" onclick={closeSearch}>
            <span class="material-symbols-outlined">arrow_back</span>
        </md-icon-button>

        <div class="search-input-container">
            <input
                bind:this={searchInputElement}
                type="text"
                class="search-input"
                placeholder={searchPlaceholder}
                bind:value={searchState.query}
                onkeydown={(e) => {
                    if (e.key === "Escape") closeSearch()
                }}
            />
        </div>
    </header>
{:else}
    <header class="top-app-bar">
        <div class="top-bar-left">
            {#if isEditing}
                <md-icon-button disabled>
                    <span class="material-symbols-outlined">edit</span>
                </md-icon-button>
            {:else if menuState.previousPages.length > 0}
                <md-icon-button aria-label="Go back" onclick={goBack}>
                    <span class="material-symbols-outlined">arrow_back</span>
                </md-icon-button>
            {:else}
                <md-icon-button aria-label="Menu" disabled>
                    <span class="material-symbols-outlined">music_note</span>
                </md-icon-button>
            {/if}

            <h1 class="top-bar-title">
                {#if isEditing}
                    Edit
                {:else}
                    <span style="font-size: 0.7em;opacity: 0.7;">{headerPath}</span>{headerTitle}
                {/if}
            </h1>
        </div>

        <div class="top-bar-actions">
            {#if isEditing}
                <md-icon-button aria-label="Delete selected" onclick={() => listEditingState.onDeleteSelected?.()}>
                    <span class="material-symbols-outlined" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                </md-icon-button>
            {:else}
                {#if menuState.activePage === "song"}
                    <div class="action-btn-wrapper">
                        <md-icon-button aria-label="Transpose" disabled={!canTranspose} onclick={() => setActivePopup("transpose")}>
                            <span class="material-symbols-outlined">swap_vert</span>
                        </md-icon-button>
                        {#if transposeCount !== 0}
                            <span class="badge" class:negative={transposeCount < 0}>
                                {transposeCount > 0 ? "+" + transposeCount : transposeCount}
                            </span>
                        {/if}
                    </div>
                    <md-icon-button aria-label="Edit" onclick={() => setActivePage("song_edit", menuState.contentId, "Edit Song")}>
                        <span class="material-symbols-outlined">edit</span>
                    </md-icon-button>
                {:else if menuState.activePage === "home" || menuState.activePage === "all_songs" || menuState.activePage === "folder" || menuState.activePage === "list"}
                    <md-icon-button aria-label="Search" onclick={openSearch}>
                        <span class="material-symbols-outlined">search</span>
                    </md-icon-button>
                {/if}

                <div class="more-menu-wrapper">
                    <md-icon-button id="more-options-btn" aria-label="More options" onclick={() => (moreMenuOpen = !moreMenuOpen)}>
                        <span class="material-symbols-outlined">more_vert</span>
                    </md-icon-button>

                    <md-menu id="more-options-menu" anchor="more-options-btn" open={moreMenuOpen} onclosed={() => (moreMenuOpen = false)} quick>
                        {#if menuState.activePage === "home" || menuState.activePage === "all_songs"}
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    setActivePopup("settings")
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start">settings</span>
                                <div slot="headline">Settings</div>
                            </md-menu-item>
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    setActivePopup("about")
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start">info</span>
                                <div slot="headline">About</div>
                            </md-menu-item>
                        {:else if menuState.activePage === "song"}
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    if (currentSong) shareSong(currentSong)
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start">share</span>
                                <div slot="headline">Share Song</div>
                            </md-menu-item>
                        {:else if menuState.activePage === "song_edit"}
                            {@const editSong = storage.getSongById(menuState.contentId)}
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    confirmDeleteSong(editSong)
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                                <div slot="headline" style="color: var(--md-sys-color-error, #ba1a1a);">Delete Song</div>
                            </md-menu-item>
                        {:else if menuState.activePage === "list"}
                            {@const currentList = storage.getListById(menuState.contentId)}
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    if (currentList) shareList(currentList, storage.songs)
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start">share</span>
                                <div slot="headline">Share List</div>
                            </md-menu-item>
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    confirmDeleteList(currentList)
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                                <div slot="headline" style="color: var(--md-sys-color-error, #ba1a1a);">Delete List</div>
                            </md-menu-item>
                        {:else if menuState.activePage === "folder"}
                            {@const currentFolder = storage.getFolderById(menuState.contentId)}
                            <md-menu-item
                                onclick={() => {
                                    moreMenuOpen = false
                                    confirmDeleteFolder(currentFolder)
                                }}
                            >
                                <span class="material-symbols-outlined" slot="start" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                                <div slot="headline" style="color: var(--md-sys-color-error, #ba1a1a);">Delete Folder</div>
                            </md-menu-item>
                        {/if}
                    </md-menu>
                </div>
            {/if}
        </div>
    </header>
{/if}

<style>
    .top-app-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;

        height: 64px;
        min-height: 64px;

        padding: 0 16px;

        z-index: 10;

        user-select: none;
    }

    .top-bar-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .top-bar-title {
        font-size: 1.25rem;
        font-weight: 500;
        letter-spacing: 0.15px;
    }

    .top-bar-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .action-btn-wrapper,
    .more-menu-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    md-menu {
        min-width: 180px;
    }

    md-menu-item {
        white-space: nowrap;
    }

    .badge {
        position: absolute;
        bottom: 6px;
        right: 4px;
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        font-size: 0.65rem;
        font-weight: 700;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 9999px;
        pointer-events: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        font-variant-numeric: tabular-nums;
    }
    /* .badge.negative {
        background: var(--md-sys-color-tertiary, #7d5260);
    } */

    /* search */

    .top-app-bar.search-mode {
        gap: 8px;
    }

    .search-input-container {
        flex: 1;
        display: flex;
        align-items: center;
    }

    .search-input {
        width: 100%;
        height: 40px;
        background: transparent;
        border: none;
        outline: none;
        font-size: 1.1rem;
        font-family: inherit;
        color: var(--md-sys-color-on-primary, #044444);
    }

    .search-input::placeholder {
        color: var(--md-sys-color-on-primary, #044444);
        opacity: 0.6;
    }
</style>
