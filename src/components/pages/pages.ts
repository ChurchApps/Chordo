import HomePage from "./HomePage.svelte"
import FolderPage from "./FolderPage.svelte"
import ListPage from "./ListPage.svelte"
import SongPage from "./SongPage.svelte"
import AllSongsPage from "./AllSongsPage.svelte"
import SongEditPage from "./SongEditPage.svelte"
import SongFullscreen from "./SongFullscreen.svelte"
import SongDraw from "./SongDraw.svelte"

export const pages = {
    home: {
        title: "Chord Sheet Manager",
        component: HomePage
    },
    folder: {
        title: "Folder",
        component: FolderPage
    },
    list: {
        title: "List",
        component: ListPage
    },
    song: {
        title: "Song",
        component: SongPage
    },
    song_edit: {
        title: "Edit Song",
        component: SongEditPage
    },
    all_songs: {
        title: "All Songs",
        component: AllSongsPage
    },
    song_live: {
        title: "",
        component: SongFullscreen
    },
    song_draw: {
        title: "",
        component: SongDraw
    }
}
