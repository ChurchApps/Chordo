import AllSongsPage from "./AllSongsPage.svelte"
import FolderPage from "./FolderPage.svelte"
import HomePage from "./HomePage.svelte"
import LandingPage from "./LandingPage.svelte"
import ListPage from "./ListPage.svelte"
import SharePreviewPage from "./SharePreviewPage.svelte"
import SongEditPage from "./SongEditPage.svelte"
import SongFullscreen from "./SongFullscreen.svelte"
import SongPage from "./SongPage.svelte"

export const pages = {
    landing: {
        title: "Chordo",
        component: LandingPage
    },
    /// Main App
    home: {
        title: "Chordo",
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
    share_preview: {
        title: "Import Shared",
        component: SharePreviewPage
    }
}
