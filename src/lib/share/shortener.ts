import storage from "../storage/StorageManager.svelte"
import { createShareUrl, getShareBaseUrl } from "./shareCodec"

async function sha256(text: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function createShortShare(encodedPayload: string): Promise<string> {
    try {
        const hash = await sha256(encodedPayload)

        // Check if we already have a cached share ID for this exact content SHA
        const cachedId = storage.settings.shareCache?.[hash]
        if (cachedId) {
            return `${getShareBaseUrl()}/#share=d:${cachedId}`
        }

        const formData = new FormData()
        formData.append("content", encodedPayload)
        formData.append("expiry_days", import.meta.env?.DEV ? "1" : "365")

        const res = await fetch("https://dpaste.com/api/v2/", {
            method: "POST",
            body: formData
        })

        if (!res.ok) throw new Error("Failed to shorten")

        const pasteUrl = (await res.text()).trim()
        const id = pasteUrl.split("/").filter(Boolean).pop()?.replace(/\.txt$/, "")
        if (!id) throw new Error("No paste ID returned")

        // Persist to local settings shareCache
        if (!storage.settings.shareCache) {
            storage.settings.shareCache = {}
        }
        storage.settings.shareCache[hash] = id
        storage.persist()

        return `${getShareBaseUrl()}/#share=d:${id}`
    } catch {
        // Fallback to long URL if offline or network fails
        return createShareUrl(encodedPayload)
    }
}

export async function fetchShortShare(id: string): Promise<string | null> {
    const cleanId = id.replace(/^(?:d:|p:|id:)/, "").replace(/\.txt$|\/raw$/, "").trim()
    if (!cleanId) return null

    // Try dpaste.com first
    try {
        const res = await fetch(`https://dpaste.com/${cleanId}.txt`)
        if (res.ok) {
            const text = (await res.text()).trim()
            if (text && !text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
                return text
            }
        }
    } catch {
        // ignore and fallback
    }

    // Try dpaste.org as fallback
    try {
        const res = await fetch(`https://dpaste.org/${cleanId}/raw`)
        if (res.ok) {
            const text = (await res.text()).trim()
            if (text && !text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
                return text
            }
        }
    } catch {
        // ignore
    }

    return null
}
