import CreateFolder from "./CreateFolder.svelte"
import CreateList from "./CreateList.svelte"
import CreateSong from "./CreateSong.svelte"

export const popups = {
    create_song: {
        component: CreateSong
    },
    create_list: {
        component: CreateList
    },
    create_folder: {
        component: CreateFolder
    }
}
