<script lang="ts">
    import type { Folder } from "$lib/models/Folder"
    import type { List } from "$lib/models/List"
    import type { Song } from "$lib/models/Song"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { t } from "$lib/state/i18n.svelte"
    import { getCurrentSong, goBack, isFullscreenPage, listEditingState, menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { closeSearch, openSearch, searchState } from "$lib/state/search.svelte"
    import { playbackState, togglePlayback } from "$lib/state/playback.svelte"
    import { parsePlaybackUrl } from "$lib/utils/playback"
    import storage from "$lib/storage/StorageManager.svelte"
    import { shareList, shareSong } from "$lib/share/share"
    import { clearSharePayload } from "$lib/share/share.svelte"
    import { pages } from "../pages/pages"
    import TransposeButton from "../song/TransposeButton.svelte"

    let headerPath = $derived(
        menuState.previousPages.reduce((path, page) => {
            const title = page.customPageTitle
            if (title) path += title + " / "
            return path
        }, "")
    )

    const nonTranslatablePages = ["home", "song_live", "song_draw"] as const

    let headerTitle = $derived.by(() => {
        if (menuState.customPageTitle) return menuState.customPageTitle
        if (nonTranslatablePages.includes(menuState.activePage as any)) {
            return pages[menuState.activePage]?.title ?? ""
        }
        return t("pages", menuState.activePage as any)
    })

    let isEditing = $derived(listEditingState.isEditing) // menuState.activePage === "list" && listEditingState.isEditing
    let moreMenuOpen = $state(false)

    let searchPlaceholder = $derived.by(() => {
        switch (menuState.activePage) {
            case "all_songs":
                return t("search", "placeholder_songs")
            case "folder":
                return t("search", "placeholder_lists")
            case "list":
                return t("search", "placeholder_songs")
            case "home":
            default:
                return t("search", "placeholder_all")
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

    function confirmDeleteSong(song: Song | null) {
        if (!song) return
        openConfirm({
            title: t("confirm", "delete_song_title"),
            message: `Are you sure you want to delete "${song.name}"? This action cannot be undone.`,
            confirmLabel: t("common", "delete"),
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
            title: t("confirm", "delete_list_title"),
            message: `Are you sure you want to delete "${list.name}"?`,
            confirmLabel: t("common", "delete"),
            isDestructive: true,
            onConfirm: () => {
                storage.deleteList(list.id)
                goBack()
            }
        })
    }

    function confirmDeleteFolder(folder: Folder | null) {
        if (!folder || folder.type === "shared") return
        openConfirm({
            title: t("confirm", "delete_folder_title"),
            message: `Are you sure you want to delete folder "${folder.name}"?`,
            confirmLabel: t("common", "delete"),
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
            {#if menuState.activePage === "share_preview"}
                <md-icon-button
                    aria-label="Home"
                    onclick={() => {
                        clearSharePayload()
                        setActivePage("home")
                    }}
                >
                    <span class="material-symbols-outlined">home</span>
                </md-icon-button>
            {:else if isEditing}
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
                    {t("common", "edit")}
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
                    {@const activePlaybackUrl = currentSong?.playbackUrl || currentSong?.spotify || currentSong?.getMetadata("playback") || currentSong?.getMetadata("spotify")}
                    {@const activePlaybackInfo = parsePlaybackUrl(activePlaybackUrl)}
                    {#if activePlaybackInfo && currentSong}
                        <md-icon-button aria-label={t("song_edit", "play")} title={t("song_edit", "play")} onclick={() => togglePlayback(currentSong.id)}>
                            {#if activePlaybackInfo.provider === "spotify"}
                                <svg width="22" height="22" viewBox="0 0 24 24" fill={playbackState.isOpen ? "#1DB954" : "currentColor"}>
                                    <path
                                        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.307c-.216.353-.674.466-1.027.25-2.822-1.724-6.374-2.115-10.559-1.159-.404.093-.807-.16-.9-.564-.092-.404.161-.807.564-.9 4.582-1.047 8.514-.606 11.672 1.346.353.216.466.674.25 1.027zm1.465-3.262c-.272.441-.849.582-1.29.31-3.23-1.986-8.155-2.56-11.977-1.4-4.99.151-.989-.138-1.14-.637-.152-.499.138-.989.637-1.14 4.381-1.33 9.807-.687 13.46 1.577.441.272.582.849.31 1.29zm.126-3.41c-3.874-2.3-10.264-2.512-13.97-1.386-.595.181-1.226-.157-1.407-.752-.181-.595.157-1.226.752-1.407 4.257-1.293 11.31-1.045 15.772 1.603.535.318.708 1.01.39 1.545-.318.535-1.01.708-1.545.39z"
                                    />
                                </svg>
                            {:else if activePlaybackInfo.provider === "youtube"}
                                <svg width="22" height="22" viewBox="0 0 24 24" fill={playbackState.isOpen ? "#FF0000" : "currentColor"}>
                                    <path
                                        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                                    />
                                </svg>
                            {:else}
                                <span class="material-symbols-outlined" style={playbackState.isOpen ? "color: var(--md-sys-color-primary, #6750a4);" : ""}>play_circle</span>
                            {/if}
                        </md-icon-button>
                    {/if}
                    <TransposeButton />
                    <md-icon-button aria-label="Edit" onclick={() => setActivePage("song_edit", currentSong?.id ?? menuState.contentId, currentSong?.name ?? "Edit Song")}>
                        <span class="material-symbols-outlined">edit</span>
                    </md-icon-button>
                {:else if menuState.activePage === "home" || menuState.activePage === "all_songs"}
                    <!-- || menuState.activePage === "folder" || menuState.activePage === "list" -->
                    <md-icon-button aria-label="Search" onclick={openSearch}>
                        <span class="material-symbols-outlined">search</span>
                    </md-icon-button>
                {/if}

                {@const activeFolder = menuState.activePage === "folder" ? storage.getFolderById(menuState.contentId) : null}
                {#if menuState.activePage !== "share_preview" && !(menuState.activePage === "folder" && activeFolder?.type === "shared")}
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
                                    <div slot="headline">{t("menu", "settings")}</div>
                                </md-menu-item>
                                <md-menu-item
                                    onclick={() => {
                                        moreMenuOpen = false
                                        setActivePopup("about")
                                    }}
                                >
                                    <span class="material-symbols-outlined" slot="start">info</span>
                                    <div slot="headline">{t("menu", "about")}</div>
                                </md-menu-item>
                            {:else if menuState.activePage === "song"}
                                <md-menu-item
                                    onclick={() => {
                                        moreMenuOpen = false
                                        if (currentSong) shareSong(currentSong)
                                    }}
                                >
                                    <span class="material-symbols-outlined" slot="start">share</span>
                                    <div slot="headline">{t("menu", "share_song")}</div>
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
                                    <div slot="headline" style="color: var(--md-sys-color-error, #ba1a1a);">{t("menu", "delete_song")}</div>
                                </md-menu-item>
                            {:else if menuState.activePage === "list"}
                                {@const currentList = storage.getListById(menuState.contentId)}
                                <md-menu-item
                                    onclick={() => {
                                        moreMenuOpen = false
                                        setActivePopup("rename_list")
                                    }}
                                >
                                    <span class="material-symbols-outlined" slot="start">edit</span>
                                    <div slot="headline">{t("menu", "rename_list")}</div>
                                </md-menu-item>
                                <md-menu-item
                                    onclick={() => {
                                        moreMenuOpen = false
                                        if (currentList) shareList(currentList, storage.songs)
                                    }}
                                >
                                    <span class="material-symbols-outlined" slot="start">share</span>
                                    <div slot="headline">{t("menu", "share_list")}</div>
                                </md-menu-item>
                                <md-menu-item
                                    onclick={() => {
                                        moreMenuOpen = false
                                        confirmDeleteList(currentList)
                                    }}
                                >
                                    <span class="material-symbols-outlined" slot="start" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                                    <div slot="headline" style="color: var(--md-sys-color-error, #ba1a1a);">{t("menu", "delete_list")}</div>
                                </md-menu-item>
                            {:else if menuState.activePage === "folder"}
                                {@const currentFolder = storage.getFolderById(menuState.contentId)}
                                {#if currentFolder && currentFolder.type !== "shared"}
                                    <md-menu-item
                                        onclick={() => {
                                            moreMenuOpen = false
                                            setActivePopup("rename_folder")
                                        }}
                                    >
                                        <span class="material-symbols-outlined" slot="start">edit</span>
                                        <div slot="headline">{t("menu", "rename_folder")}</div>
                                    </md-menu-item>
                                    <md-menu-item
                                        onclick={() => {
                                            moreMenuOpen = false
                                            confirmDeleteFolder(currentFolder)
                                        }}
                                    >
                                        <span class="material-symbols-outlined" slot="start" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                                        <div slot="headline" style="color: var(--md-sys-color-error, #ba1a1a);">{t("menu", "delete_folder")}</div>
                                    </md-menu-item>
                                {/if}
                            {/if}
                        </md-menu>
                    </div>
                {/if}
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
        color: var(--md-sys-color-on-primary-container);
    }

    .top-bar-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

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
        color: var(--md-sys-color-on-primary-container, #002020);
    }

    .search-input::placeholder {
        color: var(--md-sys-color-on-primary-container, #002020);
        opacity: 0.6;
    }
</style>
