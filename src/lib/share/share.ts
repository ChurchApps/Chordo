import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { t } from "$lib/state/i18n.svelte"
import { showToast } from "$lib/state/toast.svelte"
import storage from "$lib/storage/StorageManager.svelte"
import { buildListSharePayload, buildSongSharePayload, parseSharePayload, type SharePayload } from "./shareCodec"

// In-memory cache for fetched share data to avoid redundant network hits
const shareDataCache = new Map<string, SharePayload>()

// --- SHA256 Caching Helper ---

async function sha256(text: string): Promise<string> {
    if (typeof crypto?.subtle !== "undefined") {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
        return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
    }
    return text
}

// --- URL & Share Creation ---

export function getShareBaseUrl(): string {
    return typeof window !== "undefined" ? window.location.origin : "https://chordo.org"
}

export function createShareUrl(id: string): string {
    return `${getShareBaseUrl()}/?share=${encodeURIComponent(id)}`
}

export async function createShare(payload: SharePayload): Promise<string> {
    const payloadStr = JSON.stringify(payload)
    const hash = await sha256(payloadStr)

    // Check cached share ID in settings
    const cached = storage.settings?.shareCache?.[hash]
    if (cached?.id) {
        shareDataCache.set(cached.id, payload)
        return createShareUrl(cached.id)
    }

    const res = await fetch("https://chordo.org/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr
    })

    if (!res.ok) throw new Error(`Failed to create share: ${res.statusText}`)

    const data = (await res.json()) as { id: string; url: string }
    if (!data?.id) throw new Error("Invalid response from share API")

    storage.settings.shareCache = storage.settings.shareCache || {}
    storage.settings.shareCache[hash] = { id: data.id, createdAt: Date.now() }
    storage.persist()

    shareDataCache.set(data.id, payload)
    return createShareUrl(data.id)
}

// --- URL Parsing & Resolution ---

export function extractSharePayloadFromUrl(url: string = typeof window !== "undefined" ? window.location.href : ""): string | null {
    if (!url) return null
    const match = url.match(/[?&#](?:share|s)=([^&#]+)/)
    return match ? decodeURIComponent(match[1]) : null
}

export async function fetchShare(id: string): Promise<SharePayload | null> {
    const cleanId = decodeURIComponent(id)
        .replace(/^https?:\/\/content\.chordo\.org\//, "")
        .replace(/\.json$/, "")
        .trim()

    if (!cleanId) return null
    if (shareDataCache.has(cleanId)) return shareDataCache.get(cleanId)!

    try {
        const res = await fetch(`https://content.chordo.org/${cleanId}.json`)
        if (!res.ok) return null

        const parsed = parseSharePayload(await res.json())
        if (parsed) shareDataCache.set(cleanId, parsed)
        return parsed
    } catch (e) {
        console.error("Failed to fetch share content:", e)
        return null
    }
}

export async function resolveSharePayload(raw: string): Promise<SharePayload | null> {
    return raw ? fetchShare(raw) : null
}

// --- Clipboard & Native Share API ---

export async function copyUrlToClipboard(url: string, title?: string, hasMedia = false): Promise<boolean> {
    const duration = hasMedia ? 4000 : 3000

    if (navigator?.share) {
        try {
            await navigator.share({ title: title || "Chord Sheet", url })
            const msg = hasMedia ? t("share", "shared_no_media") : t("share", "shared_success")
            showToast(msg, "success", duration)
            return true
        } catch (err) {
            if ((err as Error).name === "AbortError") return false
        }
    }

    const copyMsg = hasMedia ? t("share", "link_copied_no_media") : t("share", "link_copied")

    if (navigator?.clipboard) {
        try {
            await navigator.clipboard.writeText(url)
            showToast(copyMsg, "success", duration)
            return true
        } catch (e) {
            console.error("Clipboard API failed, attempting fallback:", e)
        }
    }

    try {
        const textarea = document.createElement("textarea")
        textarea.value = url
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)

        showToast(copyMsg, "success", duration)
        return true
    } catch {
        showToast(t("share", "copy_failed"), "error")
        return false
    }
}

// --- Exported Share Handlers ---

export async function shareSong(song: Song): Promise<boolean> {
    try {
        const hasMedia = Boolean(song.images?.length)
        const payload = buildSongSharePayload(song)
        const url = await createShare(payload)
        return await copyUrlToClipboard(url, song.name, hasMedia)
    } catch (e) {
        console.error("Error creating song share URL:", e)
        showToast(t("share", "generate_failed"), "error")
        return false
    }
}

export async function shareList(list: List, allSongs: Song[]): Promise<boolean> {
    try {
        const listSongs = list.getSongs(allSongs)
        const hasMedia = listSongs.some((s) => s.images?.length)
        const payload = buildListSharePayload(list, allSongs)
        const url = await createShare(payload)
        return await copyUrlToClipboard(url, list.name, hasMedia)
    } catch (e) {
        console.error("Error creating list share URL:", e)
        showToast(t("share", "generate_failed"), "error")
        return false
    }
}
