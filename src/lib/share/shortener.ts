import storage from "../storage/StorageManager.svelte"
import { createShareUrl, getShareBaseUrl } from "./shareCodec"

const DPASTE_EXPIRY_DAYS = "90"

async function sha256(text: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
}

// In-memory read cache for fetched short snippets to prevent redundant network hits and 429 errors
const fetchedSnippetCache = new Map<string, string>()

export async function createShortShare(encodedPayload: string): Promise<string> {
    try {
        const hash = await sha256(encodedPayload)

        // Check if we already have a cached share ID for this exact content SHA
        const cachedId = storage.settings.shareCache?.[hash]
        if (cachedId) {
            return `${getShareBaseUrl()}/#share=d:${cachedId}`
        }

        let id: string | null = null

        // 1. Try dpaste.org (higher limits and reliable API)
        try {
            const formData = new FormData()
            formData.append("content", encodedPayload)
            formData.append("expires", import.meta.env?.DEV ? "1" : DPASTE_EXPIRY_DAYS)
            formData.append("format", "url")

            const res = await fetch("https://dpaste.org/api/", {
                method: "POST",
                body: formData
            })

            if (res.ok) {
                const pasteUrl = (await res.text()).trim()
                id =
                    pasteUrl
                        .split("/")
                        .filter(Boolean)
                        .pop()
                        ?.replace(/\.txt$/, "") || null
            }
        } catch {
            // fallback
        }

        // 2. Fallback: Try dpaste.com
        if (!id) {
            try {
                const formData = new FormData()
                formData.append("content", encodedPayload)
                formData.append("expiry_days", import.meta.env?.DEV ? "1" : DPASTE_EXPIRY_DAYS)

                const res = await fetch("https://dpaste.com/api/v2/", {
                    method: "POST",
                    body: formData
                })

                if (res.ok) {
                    const pasteUrl = (await res.text()).trim()
                    id =
                        pasteUrl
                            .split("/")
                            .filter(Boolean)
                            .pop()
                            ?.replace(/\.txt$/, "") || null
                }
            } catch {
                // fallback
            }
        }

        if (!id) throw new Error("Shortener unavailable")

        // Persist to local settings shareCache
        if (!storage.settings.shareCache) {
            storage.settings.shareCache = {}
        }
        storage.settings.shareCache[hash] = id
        storage.persist()

        // Also save to fetchedSnippetCache for instant local resolution
        fetchedSnippetCache.set(id, encodedPayload)

        return `${getShareBaseUrl()}/#share=d:${id}`
    } catch {
        // Fallback to long URL if offline or network fails
        return createShareUrl(encodedPayload)
    }
}

export async function fetchShortShare(id: string): Promise<string | null> {
    const cleanId = id
        .replace(/^(?:d:|p:|id:)/, "")
        .replace(/\.txt$|\/raw$/, "")
        .trim()
    if (!cleanId) return null

    if (fetchedSnippetCache.has(cleanId)) {
        return fetchedSnippetCache.get(cleanId)!
    }

    // Try dpaste.org first
    try {
        const res = await fetch(`https://dpaste.org/${cleanId}/raw`)
        if (res.ok) {
            const text = (await res.text()).trim()
            if (text && !text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
                fetchedSnippetCache.set(cleanId, text)
                return text
            }
        }
    } catch {
        // ignore and try fallback
    }

    // Try dpaste.com as fallback
    try {
        const res = await fetch(`https://dpaste.com/${cleanId}.txt`)
        if (res.ok) {
            const text = (await res.text()).trim()
            if (text && !text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
                fetchedSnippetCache.set(cleanId, text)
                return text
            }
        }
    } catch {
        // ignore
    }

    return null
}
