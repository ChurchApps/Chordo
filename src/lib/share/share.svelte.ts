import type { SharePayload } from "$lib/share/shareCodec"

export const sharePreviewState = $state<{
    payload: SharePayload | null
    rawPayload: string | null
}>({
    payload: null,
    rawPayload: null
})

export function setSharePayload(payload: SharePayload | null, rawPayload: string | null = null): void {
    sharePreviewState.payload = payload
    sharePreviewState.rawPayload = rawPayload
}

export function clearSharePayload(): void {
    sharePreviewState.payload = null
    sharePreviewState.rawPayload = null
    if (typeof window !== "undefined") {
        // Remove hash / query share params without refreshing
        const cleanUrl = window.location.href.replace(/[#?](?:share|s)=[^&#]*/, "").replace(/[#?]$/, "")
        window.history.replaceState(null, "", cleanUrl)
    }
}
