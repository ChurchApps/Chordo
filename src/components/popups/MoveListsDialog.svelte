<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { listEditingState, popupState, setActivePopup } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { showToast } from "$lib/state/toast.svelte"

    const selectedListIds: string[] = $derived(popupState.targetId ? popupState.targetId.split(",").filter(Boolean) : [])

    import { menuState } from "$lib/state/menu.svelte"
    import { Folders } from "$lib/models/Folder"
    import BaseDialog from "./BaseDialog.svelte"

    // Current folder id: prefer menuState.contentId if we are on a folder page, otherwise find by list id
    const currentFolderId = $derived(menuState.activePage === "folder" && menuState.contentId ? menuState.contentId : selectedListIds.length > 0 ? (storage.folders.find((f) => f.lists.includes(selectedListIds[0]))?.id ?? null) : null)

    // All folders
    const allFolders = $derived(Folders.get(storage.folders).filter((f) => f.type !== "shared"))

    // User chooses destination folder (starts with the folder the setlist is currently in)
    let selectedFolderId = $state<string | null>(null)

    $effect(() => {
        if (selectedFolderId === null && currentFolderId) {
            selectedFolderId = currentFolderId
        }
    })

    function closeDialog() {
        setActivePopup(null)
    }

    function moveLists() {
        if (!selectedFolderId || selectedListIds.length === 0) return

        const targetFolder = storage.getFolderById(selectedFolderId)
        if (!targetFolder) return

        // Remove selected lists from other folders
        for (const folder of storage.folders) {
            if (folder.id !== targetFolder.id && folder.lists.some((id) => selectedListIds.includes(id))) {
                folder.lists = folder.lists.filter((id) => !selectedListIds.includes(id))
                storage.updateFolder(folder)
            }
        }

        // Add to target folder
        for (const id of selectedListIds) {
            if (!targetFolder.lists.includes(id)) {
                targetFolder.lists.push(id)
            }
        }
        storage.updateFolder(targetFolder)

        const count = selectedListIds.length
        const targetFolderName = targetFolder.name

        // Exit selection/editing mode
        listEditingState.isEditing = false
        closeDialog()

        showToast(count === 1 ? t("folder", "moved_single").replace("{folder}", targetFolderName) : t("folder", "moved_plural").replace("{count}", count.toString()).replace("{folder}", targetFolderName), "success")
    }
</script>

<BaseDialog open icon="drive_file_move" title={t("folder", "move_to_folder")} onclose={closeDialog}>
    <div class="dialog-content">
        <div class="folder-options">
            {#each allFolders as folder (folder.id)}
                <button type="button" class="folder-option" class:selected={selectedFolderId === folder.id} onclick={() => (selectedFolderId = folder.id)}>
                    <span class="material-symbols-outlined folder-icon">folder</span>
                    <span class="folder-name">{folder.name}</span>
                    {#if selectedFolderId === folder.id}
                        <span class="material-symbols-outlined check-icon">check_circle</span>
                    {:else}
                        <span class="material-symbols-outlined uncheck-icon">radio_button_unchecked</span>
                    {/if}
                </button>
            {/each}
        </div>
    </div>

    {#snippet actions()}
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>
            {t("common", "cancel")}
        </md-text-button>
        <md-filled-button role="button" tabindex="0" disabled={!selectedFolderId || selectedFolderId === currentFolderId} onclick={moveLists}>
            {t("common", "move")}
        </md-filled-button>
    {/snippet}
</BaseDialog>

<style>
    .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 280px;
        max-height: 350px;
        overflow-y: auto;
    }

    .folder-options {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .folder-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: var(--md-sys-color-surface-container-low, rgba(0, 0, 0, 0.03));
        color: var(--md-sys-color-on-surface);
        cursor: pointer;
        font-family: inherit;
        font-size: 15px;
        text-align: left;
        transition: background-color 0.15s ease;
    }

    .folder-option:hover {
        background: var(--md-sys-color-surface-container-high, rgba(0, 0, 0, 0.08));
    }

    .folder-option.selected {
        background: var(--md-sys-color-primary-container, rgba(103, 80, 164, 0.12));
        color: var(--md-sys-color-on-primary-container, #21005d);
        font-weight: 500;
    }

    .folder-icon {
        color: var(--md-sys-color-primary);
        font-size: 22px;
    }

    .folder-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .check-icon {
        color: var(--md-sys-color-primary);
        font-size: 22px;
    }

    .uncheck-icon {
        opacity: 0.38;
        font-size: 22px;
    }
</style>
