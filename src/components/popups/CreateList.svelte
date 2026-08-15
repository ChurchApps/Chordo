<script lang="ts">
    import { onMount } from "svelte"
    import { Lists } from "$lib/models/List"
    import { menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { t } from "$lib/state/i18n.svelte"

    let listName = $state("")
    let folderId = menuState.contentId

    function closeDialog() {
        listName = ""
        setActivePopup(null)
    }

    function createList() {
        const name = listName.trim()
        if (!name || !folderId) return

        const list = Lists.create({ name }, folderId)
        if (list) setActivePage("list", list.id, list.name)
        closeDialog()
    }

    onMount(() => {
        const inputField = document.getElementById("list-name-input")
        if (inputField) inputField.focus()
    })

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            createList()
        }
    }
</script>

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline">
        <div class="dialog-header">
            <span class="material-symbols-outlined headline-icon">list</span>
            <span>{t("new", "list")}</span>
        </div>
    </div>

    <form slot="content" method="dialog" class="dialog-form">
        <md-outlined-text-field id="list-name-input" label={t("new", "list_name_label")} placeholder={t("new", "list_name_placeholder")} value={listName} oninput={(e: Event) => (listName = (e.target as HTMLInputElement).value)} onkeydown={keydown} required></md-outlined-text-field>

        <!-- <label style="margin-top:12px">Folder</label>
        <select style="width:100%; margin-top:4px; padding:8px;" bind:value={folderId}>
            {#each folders as f}
                <option value={f.id}>{f.name}</option>
            {/each}
        </select> -->
    </form>

    <div slot="actions">
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("common", "cancel")}</md-text-button>
        <md-filled-button role="button" tabindex="0" onclick={createList} disabled={!listName.trim() || !folderId}>{t("common", "create")}</md-filled-button>
    </div>
</md-dialog>

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #2b2930;
        font-size: 1.35rem;
    }
    .headline-icon {
        color: #2b2930;
    }
    .dialog-form {
        display: flex;
        flex-direction: column;
        padding-top: 12px;
        min-width: 320px;
        max-width: 500px;
    }
    md-outlined-text-field {
        width: 400px;
    }
</style>
