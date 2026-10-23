import AboutDialog from "./AboutDialog.svelte"
import ImportDialog from "./ImportDialog.svelte"
import MetronomeDialog from "./MetronomeDialog.svelte"
import SettingsDialog from "./SettingsDialog.svelte"
import ShareDialog from "./ShareDialog.svelte"
import TextInputDialog from "./TextInputDialog.svelte"
import MoveListsDialog from "./MoveListsDialog.svelte"
import TransposeDialog from "./TransposeDialog.svelte"

export const popups = {
    create_song: {
        component: TextInputDialog
    },
    create_list: {
        component: TextInputDialog
    },
    rename_list: {
        component: TextInputDialog
    },
    create_folder: {
        component: TextInputDialog
    },
    rename_folder: {
        component: TextInputDialog
    },
    create_section: {
        component: TextInputDialog
    },
    rename_section: {
        component: TextInputDialog
    },
    move_lists: {
        component: MoveListsDialog
    },
    transpose: {
        component: TransposeDialog
    },
    metronome: {
        component: MetronomeDialog
    },
    about: {
        component: AboutDialog
    },
    settings: {
        component: SettingsDialog
    },
    paste_link: {
        component: TextInputDialog
    },
    share_song: {
        component: ShareDialog
    },
    share_list: {
        component: ShareDialog
    },
    import_song: {
        component: ImportDialog
    },
    import_list: {
        component: ImportDialog
    }
}
