<script lang="ts">
    import { integrationState } from "$lib/integrations/integrationState.svelte"
    import { Folders } from "$lib/models/Folder"
    import { pasteSharedFromClipboard } from "$lib/share/share"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { t } from "$lib/state/i18n.svelte"
    import { listEditingState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { searchState } from "$lib/state/search.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { createHoldToSelect } from "$lib/utils/holdToSelect"
    import { isIosStandalone } from "$lib/utils/iosPwa"
    import SearchResults from "../common/SearchResults.svelte"

    let activeProvider = $derived(integrationState.getActiveProvider())
    let externalPlans = $derived(integrationState.cachedPlans)
    let updatedExternalCount = $derived.by(() => {
        if (!activeProvider) return 0
        return externalPlans.filter((p) => Boolean(integrationState.getPlanStatus(p.id))).length
    })

    let folders = $derived(Folders.get(storage.folders))

    let isSearching = $derived(searchState.isOpen && searchState.query.trim().length > 0)

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

    function openAllSongs() {
        setActivePage("all_songs")
    }

    let isEditing = $derived(listEditingState.isEditing)
    let selectedFolderIds = $state<string[]>([])

    function removeSelectedFolders() {
        if (selectedFolderIds.length === 0) return
        const count = selectedFolderIds.length
        const message = count === 1 ? t("confirm", "delete_folder_msg") : t("confirm", "delete_folders_msg").replace("{count}", count.toString())

        openConfirm({
            title: count === 1 ? t("confirm", "delete_folder_title") : t("confirm", "delete_folders_title"),
            message,
            confirmLabel: t("common", "delete"),
            isDestructive: true,
            onConfirm: () => {
                const idsToDelete = [...selectedFolderIds]
                for (const id of idsToDelete) {
                    storage.deleteFolder(id)
                }
                selectedFolderIds = []
                listEditingState.isEditing = false
            }
        })
    }

    function renameSelectedFolder() {
        if (selectedFolderIds.length !== 1) return
        const folderId = selectedFolderIds[0]
        const folder = storage.getFolderById(folderId)
        if (!folder || folder.type === "shared") return
        setActivePopup("rename_folder", folderId)
    }

    $effect(() => {
        if (isEditing) {
            const deletableCount = selectedFolderIds.filter((id) => {
                const f = storage.getFolderById(id)
                return f && f.type !== "shared"
            }).length

            listEditingState.onDeleteSelected = deletableCount > 0 ? removeSelectedFolders : undefined

            if (selectedFolderIds.length === 1) {
                const folder = storage.getFolderById(selectedFolderIds[0])
                listEditingState.onEditSelected = folder && folder.type !== "shared" ? renameSelectedFolder : undefined
                listEditingState.editActionType = "rename"
            } else {
                listEditingState.onEditSelected = undefined
                listEditingState.editActionType = undefined
            }
            listEditingState.onDuplicateSelected = undefined
        } else {
            listEditingState.onDeleteSelected = undefined
            listEditingState.onEditSelected = undefined
            listEditingState.onDuplicateSelected = undefined
            listEditingState.editActionType = undefined
            selectedFolderIds = []
        }
    })

    const selection = createHoldToSelect(
        () => selectedFolderIds,
        (ids) => (selectedFolderIds = ids)
    )

    function handleFolderClick(folderId: string, folderName: string, isShared: boolean) {
        if (isShared && isEditing) return
        if (selection.handleClick(folderId)) return
        openFolder(folderId, folderName)
    }
</script>

<!-- Main Content: show folders or search results -->
<main>
    {#if isSearching}
        <SearchResults {folders} lists={storage.lists} songs={storage.songs} />
    {:else}
        <md-list class="folders-list scroll-list" style="overflow: initial;">
            {#if isIosPwa}
                <md-list-item type="button" onclick={() => pasteSharedFromClipboard()} class="paste-shared-item" disabled={isEditing}>
                    <div slot="headline">{t("home", "paste_shared")}</div>
                    <div slot="supporting-text">{t("home", "paste_shared_desc")}</div>
                    <md-icon slot="start">content_paste</md-icon>
                    {#if !isEditing}
                        <md-icon slot="end" style="opacity: 0.8;">arrow_forward</md-icon>
                    {/if}
                </md-list-item>
            {/if}
            <md-list-item type="button" onclick={() => openAllSongs()} disabled={isEditing}>
                <div slot="headline">{t("pages", "all_songs")}</div>
                <md-icon slot="start">library_music</md-icon>
                <span slot="trailing-supporting-text" class="item-count">{storage.songs.length}</span>
                {#if !isEditing}
                    <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                {/if}
            </md-list-item>
        </md-list>

        <hr />

        {#if recentLists.length > 0}
            <div class="recently-used-section">
                <div class="section-title">{t("home", "recently_used")}</div>
                <md-list class="folders-list scroll-list" style="overflow: initial;">
                    {#each recentLists as list}
                        {@const count = list.songs?.filter((s) => s.type !== "section" && !s.isSection).length ?? 0}
                        <md-list-item type="button" onclick={() => openList(list.id, list.name)} disabled={isEditing}>
                            <div slot="headline">{list.name}</div>
                            <md-icon slot="start">list</md-icon>
                            <span slot="trailing-supporting-text" class="item-count">{count}</span>
                            {#if !isEditing}
                                <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                            {/if}
                        </md-list-item>
                    {/each}
                </md-list>

                <hr />
            </div>
        {/if}

        {#if folders.length || activeProvider}
            <div class="section-title">{t("search", "category_folders")}</div>
            <md-list class="folders-list scroll-list">
                {#if activeProvider}
                    <md-list-item type="button" onclick={() => openFolder(activeProvider.id, activeProvider.name)} class="external-folder-item" disabled={isEditing}>
                        <div slot="headline" class="provider-headline-row">
                            <span>{activeProvider.name}</span>
                            {#if updatedExternalCount > 0}
                                <span class="provider-updates-badge">
                                    {updatedExternalCount}
                                </span>
                            {/if}
                        </div>
                        <md-icon slot="start">cloud</md-icon>
                        <span slot="trailing-supporting-text" class="item-count">{externalPlans.length}</span>
                        {#if !isEditing}
                            <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                        {/if}
                    </md-list-item>
                {/if}
                {#each folders as folder}
                    {@const isShared = folder.type === "shared"}
                    {@const isSelected = isEditing && selectedFolderIds.includes(folder.id)}
                    {@const count = folder.getLists ? folder.getLists(storage.lists).length : (folder.lists?.length ?? 0)}
                    <md-list-item
                        type="button"
                        class:selected={isSelected}
                        disabled={isEditing && isShared}
                        onpointerdown={(e: PointerEvent) => !isShared && selection.startPress(e, folder.id)}
                        onpointerup={selection.endPress}
                        onpointerleave={selection.endPress}
                        oncontextmenu={(e: MouseEvent) => !isShared && selection.handleContextMenu(e, folder.id)}
                        onclick={() => handleFolderClick(folder.id, folder.name, isShared)}
                    >
                        <div slot="headline">{folder.type === "shared" ? t("folder_types", "shared") : folder.name}</div>
                        <md-icon slot="start">{folder.type === "shared" ? "share" : "folder"}</md-icon>
                        {#if isEditing}
                            {#if !isShared}
                                {#if isSelected}
                                    <md-icon slot="end" style="color: var(--md-sys-color-primary);">check_circle</md-icon>
                                {:else}
                                    <md-icon slot="end" style="opacity: 0.4;">radio_button_unchecked</md-icon>
                                {/if}
                            {/if}
                        {:else}
                            <span slot="trailing-supporting-text" class="item-count">{count}</span>
                            <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                        {/if}
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

{#if !isSearching && !isEditing}
    <div class="fab-container">
        <md-fab aria-label="Add" onclick={() => setActivePopup("create_folder")}>
            <span class="material-symbols-outlined" slot="icon">add</span>
        </md-fab>
    </div>
{/if}

<style>
    .section-title {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--md-sys-color-on-primary-container, #002020);
        opacity: 0.7;
        padding: 12px 16px 4px 16px;
    }

    .provider-headline-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .provider-updates-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.72rem;
        font-weight: 700;
        line-height: 1;
        padding: 2px 7px;
        border-radius: 9999px;
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
    }

    md-list-item.selected {
        background-color: rgb(255 255 255 / 0.3);
    }

    @media (max-height: 600px) {
        .recently-used-section {
            display: none;
        }
    }
</style>
