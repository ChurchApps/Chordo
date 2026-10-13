import { sharePreviewState } from "$lib/share/share.svelte"
import { getCurrentSong, menuState } from "$lib/state/menu.svelte"
import storage from "$lib/storage/StorageManager.svelte"

const DEFAULT_TITLE = "Chordo: Free Chord Sheet Manager"

export function getDocumentTitle(): string {
    const page = menuState.activePage

    if (page === "share_preview" && sharePreviewState.payload) {
        const p = sharePreviewState.payload
        const isList = p.type === "list"
        const name = isList ? p.list.name : p.song.name
        const artist = isList ? "" : p.song.metadata?.artist || p.song.artist
        return `${name}${artist ? ` - ${artist}` : ""} • Chordo${isList ? " Setlist" : ""}`
    }

    const title = menuState.customPageTitle
    if (!title || page === "home" || page === "landing") {
        return DEFAULT_TITLE
    }

    if (page === "song" || page === "song_live" || page === "song_edit") {
        const currentContext = (page === "song" || page === "song_live") ? getCurrentSong() : null
        const isSection = currentContext?.listItem?.type === "section"
        const song = (page === "song" || page === "song_live") && currentContext !== null
            ? currentContext.song
            : storage.getSongById(menuState.contentId)
        const artist = isSection ? "" : (song?.metadata?.artist || (typeof song?.getMetadata === "function" ? song.getMetadata("artist") : ""))
        return `${title}${artist ? ` - ${artist}` : ""} • Chordo`
    }

    if (page === "list") {
        return `${title} • Chordo Setlist`
    }

    return `${title} • Chordo`
}

export function initDocumentTitle(): void {
    $effect(() => {
        if (typeof document !== "undefined") {
            document.title = getDocumentTitle()
        }
    })
}
