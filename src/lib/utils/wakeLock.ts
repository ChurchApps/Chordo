/**
 * Screen Wake Lock API helper
 * Keeps the screen awake during live performances / fullscreen song viewing.
 */

let wakeLockSentinel: WakeLockSentinel | null = null
let isRequested = false

export async function requestWakeLock(): Promise<boolean> {
    isRequested = true
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
        return false
    }

    try {
        if (!wakeLockSentinel || wakeLockSentinel.released) {
            wakeLockSentinel = await (navigator as any).wakeLock.request("screen")
            wakeLockSentinel?.addEventListener("release", () => {
                wakeLockSentinel = null
            })
        }
        return true
    } catch (err) {
        console.warn("Screen Wake Lock could not be acquired:", err)
        return false
    }
}

export async function releaseWakeLock(): Promise<void> {
    isRequested = false
    if (wakeLockSentinel) {
        try {
            await wakeLockSentinel.release()
        } catch {}
        wakeLockSentinel = null
    }
}

// Re-acquire wake lock if tab becomes visible again while still in view mode
if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (isRequested && document.visibilityState === "visible") {
            requestWakeLock()
        }
    })
}
