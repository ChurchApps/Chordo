/**
 * Browser Fullscreen API helper
 */

// Controls whether auto-entering fullscreen is disabled during local development (Vite dev server)
const disableFullscreenInDev: boolean = true

export function isFullscreenAvailable(): boolean {
    if (typeof document === "undefined") return false
    return !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled || (document as any).mozFullScreenEnabled || (document as any).msFullscreenEnabled)
}

export function isFullscreenActive(): boolean {
    if (typeof document === "undefined") return false
    return !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement)
}

export async function enterFullscreen(element?: HTMLElement | null, force: boolean = false): Promise<boolean> {
    if (typeof document === "undefined") return false

    // Skip auto-fullscreen in development mode unless explicitly forced (e.g. manual button click)
    if (!force && disableFullscreenInDev && import.meta.env?.DEV) {
        return false
    }

    const target = element || document.documentElement

    if (isFullscreenActive()) return true

    try {
        if (target.requestFullscreen) {
            await target.requestFullscreen({ navigationUI: "hide" } as any)
            return true
        } else if ((target as any).webkitRequestFullscreen) {
            await (target as any).webkitRequestFullscreen()
            return true
        } else if ((target as any).mozRequestFullScreen) {
            await (target as any).mozRequestFullScreen()
            return true
        } else if ((target as any).msRequestFullscreen) {
            await (target as any).msRequestFullscreen()
            return true
        }
    } catch (err) {
        console.warn("Fullscreen request not granted or user canceled:", err)
    }
    return false
}

export async function exitFullscreen(): Promise<boolean> {
    if (typeof document === "undefined") return false
    if (!isFullscreenActive()) return true

    try {
        if (document.exitFullscreen) {
            await document.exitFullscreen()
            return true
        } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen()
            return true
        } else if ((document as any).mozCancelFullScreen) {
            await (document as any).mozCancelFullScreen()
            return true
        } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen()
            return true
        }
    } catch (err) {
        console.warn("Failed to exit fullscreen:", err)
    }
    return false
}

export async function toggleFullscreen(element?: HTMLElement | null): Promise<boolean> {
    if (isFullscreenActive()) {
        return !(await exitFullscreen())
    } else {
        // Manual toggle passes force=true so it works in dev mode when intentionally clicked
        return await enterFullscreen(element, true)
    }
}
