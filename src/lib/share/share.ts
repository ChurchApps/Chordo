import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { showToast } from "$lib/state/toast.svelte"
import { createShareUrl, encodeListShare, encodeSongShare } from "./shareCodec"

export async function copyUrlToClipboard(url: string, title?: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.share) {
        try {
            await navigator.share({
                title: title || "Chord Sheet",
                url
            })
            showToast("Shared successfully", "success")
            return true
        } catch (err) {
            if ((err as Error).name === "AbortError") return false
            // If share fails, fall through to clipboard copy
        }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(url)
            showToast("Share link copied to clipboard!", "success")
            return true
        } catch (e) {
            console.error("Clipboard copy failed:", e)
        }
    }

    // Fallback: prompt or execCommand
    try {
        const textarea = document.createElement("textarea")
        textarea.value = url
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        showToast("Share link copied to clipboard!", "success")
        return true
    } catch {
        showToast("Failed to copy link", "error")
        return false
    }
}

export async function shareSong(song: Song): Promise<boolean> {
    try {
        const encoded = await encodeSongShare(song)
        const url = createShareUrl(encoded)
        return await copyUrlToClipboard(url, song.name)
    } catch (e) {
        console.error("Error creating song share URL:", e)
        showToast("Failed to generate share link", "error")
        return false
    }
}

export async function shareList(list: List, allSongs: Song[]): Promise<boolean> {
    try {
        const encoded = await encodeListShare(list, allSongs)
        const url = createShareUrl(encoded)
        return await copyUrlToClipboard(url, list.name)
    } catch (e) {
        console.error("Error creating list share URL:", e)
        showToast("Failed to generate share link", "error")
        return false
    }
}
