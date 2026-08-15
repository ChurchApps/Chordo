import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"

export async function shareContent(title: string, text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.share) {
        try {
            await navigator.share({
                title,
                text
            })
            return true
        } catch (err) {
            // User cancelled or share failed, fallback to clipboard
            if ((err as Error).name === "AbortError") return false
        }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (e) {
            console.error("Clipboard copy failed:", e)
        }
    }

    return false
}

export async function shareSong(song: Song): Promise<boolean> {
    const artist = song.getMetadata("artist")
    const key = song.getMetadata("key")

    let header = song.name
    if (artist) header += ` - ${artist}`
    if (key) header += ` (Key: ${key})`

    const body = song.content || ""
    const fullText = `${header}\n\n${body}`.trim()

    return shareContent(song.name, fullText)
}

export async function shareList(list: List, allSongs: Song[]): Promise<boolean> {
    const songs = list.getSongs(allSongs)

    let text = `Setlist: ${list.name}\n`
    text += `Total songs: ${songs.length}\n\n`

    songs.forEach((song, index) => {
        const item = list.getSongItem(index)
        const key = item?.transposed || song.getMetadata("key")
        const artist = song.getMetadata("artist")

        let line = `${index + 1}. ${song.name}`
        if (artist) line += ` - ${artist}`
        if (key) line += ` [${key}]`
        text += line + "\n"
    })

    return shareContent(list.name, text.trim())
}
