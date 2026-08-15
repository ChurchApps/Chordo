<script lang="ts">
    import { onMount } from "svelte"
    import { Folders } from "$lib/models/Folder"
    import { setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { t } from "$lib/state/i18n.svelte"

    let folderName = $state("")

    function closeDialog() {
        folderName = ""
        setActivePopup(null)
    }

    function createFolder() {
        const name = folderName.trim()
        if (!name) return

        const folder = Folders.create({ name })
        if (folder) setActivePage("folder", folder.id, folder.name)
        closeDialog()
    }

    onMount(() => {
        const inputField = document.getElementById("folder-name-input")
        if (inputField) inputField.focus()
    })

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            createFolder()
        }
    }
</script>

<md-dialog id="create-folder" open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline">
        <div class="dialog-header">
            <span class="material-symbols-outlined headline-icon">folder</span>
            <span>{t("new", "folder")}</span>
        </div>
    </div>

    <form slot="content" method="dialog" class="dialog-form">
        <md-outlined-text-field id="folder-name-input" label={t("new", "folder_name_label")} placeholder={t("new", "folder_name_placeholder")} value={folderName} oninput={(e: Event) => (folderName = (e.target as HTMLInputElement).value)} onkeydown={keydown} required
        ></md-outlined-text-field>
    </form>

    <div slot="actions">
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("common", "cancel")}</md-text-button>
        <md-filled-button role="button" tabindex="0" onclick={createFolder} disabled={!folderName.trim()}>{t("common", "create")}</md-filled-button>
    </div>
</md-dialog>

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--md-sys-color-on-surface, #2b2930);
        font-size: 1.35rem;
    }
    .headline-icon {
        color: var(--md-sys-color-primary);
    }
    .dialog-form {
        display: flex;
        flex-direction: column;
        padding-top: 12px;
        min-width: 320px;
        max-width: 500px;
    }
    md-outlined-text-field {
        width: 100%;
    }
</style>
