import AboutDialog from "./AboutDialog.svelte"
import CreateFolder from "./CreateFolder.svelte"
import CreateList from "./CreateList.svelte"
import CreateSong from "./CreateSong.svelte"
import SettingsDialog from "./SettingsDialog.svelte"
import TransposeDialog from "./TransposeDialog.svelte"

export const popups = {
    create_song: {
        component: CreateSong
    },
    create_list: {
        component: CreateList
    },
    create_folder: {
        component: CreateFolder
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

