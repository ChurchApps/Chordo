export function isIos(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false
    }
    const userAgent = window.navigator.userAgent.toLowerCase()
    return (
        /iphone|ipad|ipod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1)
    )
}

export function isIosStandalone(): boolean {
    if (!isIos()) return false
    try {
        return (
            ("standalone" in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone)) ||
            (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches)
        )
    } catch {
        return false
    }
}

/**
 * Detects whether the app is currently running inside iOS Safari in standard browser mode
 * (i.e. not installed/running as a standalone PWA).
 */
export function isIosSafariNonStandalone(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false
    }

    if (!isIos()) return false

    // Check if already launched as standalone PWA
    const isStandalone =
        ("standalone" in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone)) ||
        window.matchMedia("(display-mode: standalone)").matches

    if (isStandalone) return false

    const userAgent = window.navigator.userAgent.toLowerCase()
    // Exclude other browsers on iOS like Chrome (crios), Firefox (fxios), Edge (edgios), Opera (opios)
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios|opios|mercury/.test(userAgent)

    return isSafari
}

const IOS_PROMPT_STORAGE_KEY = "chordo_ios_install_prompt_dismissed"

export function isIosPromptDismissed(): boolean {
    if (typeof localStorage === "undefined") return false
    try {
        const item = localStorage.getItem(IOS_PROMPT_STORAGE_KEY)
        if (!item) return false
        const parsed = JSON.parse(item)
        // If dismissed less than 7 days ago, don't show
        if (parsed.dismissedAt && Date.now() - parsed.dismissedAt < 7 * 24 * 60 * 60 * 1000) {
            return true
        }
    } catch {
        return false
    }
    return false
}

export function dismissIosPrompt(): void {
    if (typeof localStorage === "undefined") return
    try {
        localStorage.setItem(
            IOS_PROMPT_STORAGE_KEY,
            JSON.stringify({
                dismissedAt: Date.now()
            })
        )
    } catch {
        // ignore localStorage errors
    }
}
