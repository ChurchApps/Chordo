<script lang="ts">
    import { onMount } from "svelte"
    import { Folders } from "$lib/models/Folder"
    import { Lists } from "$lib/models/List"
    import { Songs } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import { goBack, listEditingState, menuState, popupState, setActivePage, setActivePopup, updatePageTitle } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    type DialogConfig = {
        icon: string
        title: string
        label: string
        placeholder: string
        actionLabel: string
        initialValue: string
        submit: (value: string) => void
    }

    const currentFolder = $derived(menuState.contentId ? storage.getFolderById(menuState.contentId) : null)
    const currentList = $derived(menuState.contentId ? storage.getListById(menuState.contentId) : null)

    const config = $derived.by<DialogConfig | null>(() => {
        switch (popupState.popupId) {
            case "create_folder":
                return {
                    icon: "folder",
                    title: t("new", "folder"),
                    label: t("new", "folder_name_label"),
                    placeholder: t("new", "folder_name_placeholder"),
                    actionLabel: t("common", "create"),
                    initialValue: "",
                    submit: (name) => {
                        const folder = Folders.create({ name })
                        if (folder) setActivePage("folder", folder.id, folder.name)
                    }
                }
            case "create_list":
                return {
                    icon: "list",
                    title: t("new", "list"),
                    label: t("new", "list_name_label"),
                    placeholder: t("new", "list_name_placeholder"),
                    actionLabel: t("common", "create"),
                    initialValue: "",
                    submit: (name) => {
                        if (!menuState.contentId) return
                        const list = Lists.create({ name }, menuState.contentId)
                        if (list) setActivePage("list", list.id, list.name)
                    }
                }
            case "create_song":
                return {
                    icon: "music_note",
                    title: t("new", "song"),
                    label: t("new", "song_title_label"),
                    placeholder: t("new", "song_title_placeholder"),
                    actionLabel: t("common", "create"),
                    initialValue: "",
                    submit: (name) => {
                        const song = Songs.create({ name }, menuState.contentId)
                        if (menuState.contentId) {
                            setActivePage("song_edit", song.id, song.name, "replace")
                        } else {
                            setActivePage("song_edit", song.id, song.name, "append", { activePage: "song", contentId: song.id, customPageTitle: song.name })
                        }
                    }
                }
            case "create_section":
                return {
                    icon: "bookmark",
                    title: t("new", "section"),
                    label: t("new", "section_name_label"),
                    placeholder: t("new", "section_name_placeholder"),
                    actionLabel: t("common", "create"),
                    initialValue: "",
                    submit: (name) => {
                        const targetListId = menuState.contentId
                        if (!targetListId) return
                        const list = storage.getListById(targetListId)
                        if (!list) return

                        setActivePopup(null)
                        goBack()

                        setTimeout(() => {
                            list.addSection(name)
                        }, 80)
                    }
                }
            case "rename_list":
                return {
                    icon: "edit",
                    title: t("rename", "list"),
                    label: t("new", "list_name_label"),
                    placeholder: t("new", "list_name_placeholder"),
                    actionLabel: t("common", "save"),
                    initialValue: currentList?.name ?? "",
                    submit: (name) => {
                        if (!currentList) return
                        currentList.name = name
                        storage.updateList(currentList)
                        updatePageTitle(name)
                    }
                }
            case "rename_folder":
                return {
                    icon: "edit",
                    title: t("rename", "folder"),
                    label: t("new", "folder_name_label"),
                    placeholder: t("new", "folder_name_placeholder"),
                    actionLabel: t("common", "save"),
                    initialValue: currentFolder?.name ?? "",
                    submit: (name) => {
                        if (!currentFolder || currentFolder.type === "shared") return
                        currentFolder.name = name
                        storage.updateFolder(currentFolder)
                        updatePageTitle(name)
                    }
                }
            case "rename_section": {
                const list = currentList
                const idx = listEditingState.selectedIndex ?? 0
                const sectionItem = list?.songs[idx]
                return {
                    icon: "edit",
                    title: t("rename", "section"),
                    label: t("new", "section_name_label"),
                    placeholder: t("new", "section_name_placeholder"),
                    actionLabel: t("common", "save"),
                    initialValue: sectionItem?.name ?? "",
                    submit: (name) => {
                        if (!list) return
                        list.renameSection(idx, name)
                        listEditingState.isEditing = false
                    }
                }
            }
            default:
                return null
        }
    })

    let inputValue = $state("")

    $effect(() => {
        if (config) {
            inputValue = config.initialValue
        }
    })

    function closeDialog() {
        inputValue = ""
        setActivePopup(null)
    }

    function handleSubmit() {
        const val = inputValue.trim()
        if (!val || !config) return
        config.submit(val)
        closeDialog()
    }

    onMount(() => {
        const inputField = document.getElementById("text-popup-input") as HTMLInputElement | null
        if (inputField) {
            inputField.focus()
            if (config?.initialValue) {
                inputField.select?.()
            }
        }
    })

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
        }
    }
</script>

{#if config}
    <md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
        <div slot="headline">
            <div class="dialog-header">
                <span class="material-symbols-outlined headline-icon">{config.icon}</span>
                <span>{config.title}</span>
            </div>
        </div>

        <form slot="content" method="dialog" class="dialog-form">
            <md-outlined-text-field
                id="text-popup-input"
                label={config.label}
                placeholder={config.placeholder}
                value={inputValue}
                oninput={(e: Event) => (inputValue = (e.target as HTMLInputElement).value)}
                onkeydown={keydown}
                required
            ></md-outlined-text-field>
        </form>

        <div slot="actions">
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("common", "cancel")}</md-text-button>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-filled-button role="button" tabindex="0" onclick={handleSubmit} disabled={!inputValue.trim()}>{config.actionLabel}</md-filled-button>
        </div>
    </md-dialog>
{/if}

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
