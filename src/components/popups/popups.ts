import AboutDialog from "./AboutDialog.svelte"
import SettingsDialog from "./SettingsDialog.svelte"
import TextInputDialog from "./TextInputDialog.svelte"
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
    transpose: {
        component: TransposeDialog
    },
    about: {
        component: AboutDialog
    },
    settings: {
        component: SettingsDialog
    }
}

