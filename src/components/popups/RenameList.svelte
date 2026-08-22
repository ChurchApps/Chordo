<script lang="ts">
    import { onMount } from "svelte"
    import { menuState, setActivePopup, updatePageTitle } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { t } from "$lib/state/i18n.svelte"

    const currentList = storage.getListById(menuState.contentId)
    let listName = $state(currentList?.name ?? "")

    function closeDialog() {
        setActivePopup(null)
    }

    function renameList() {
        const name = listName.trim()
        if (!name || !currentList) return

        currentList.name = name
        storage.updateList(currentList)
        updatePageTitle(name)
        closeDialog()
    }

    onMount(() => {
        const inputField = document.getElementById("rename-list-input") as HTMLInputElement | null
        if (inputField) {
            inputField.focus()
            inputField.select?.()
        }
    })

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            renameList()
        }
    }
</script>

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline">
        <div class="dialog-header">
            <span class="material-symbols-outlined headline-icon">edit</span>
            <span>{t("rename", "list")}</span>
        </div>
    </div>

    <form slot="content" method="dialog" class="dialog-form">
        <md-outlined-text-field
            id="rename-list-input"
            label={t("new", "list_name_label")}
            placeholder={t("new", "list_name_placeholder")}
            value={listName}
            oninput={(e: Event) => (listName = (e.target as HTMLInputElement).value)}
            onkeydown={keydown}
            required
        ></md-outlined-text-field>
    </form>

    <div slot="actions">
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("common", "cancel")}</md-text-button>
        <md-filled-button role="button" tabindex="0" onclick={renameList} disabled={!listName.trim()}>{t("common", "save")}</md-filled-button>
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
