export type NonFunctionProperties<T> = Pick<
    T,
    {
        [K in keyof T]: T[K] extends Function ? never : K
    }[keyof T]
>

export function clone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") return obj
    try {
        return JSON.parse(JSON.stringify(obj))
    } catch (e) {
        console.error("Failed to clone object:", e)
        return obj
    }
}

export function getId(customPrefix: string = "id"): string {
    return `${customPrefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`
}

export function sortByName<T extends { name: string }>(arr: T[]): T[] {
    return clone(arr).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Formats a date timestamp in a localized, user-friendly format (e.g., "Oct 22, 2026" or "22. okt. 2026")
 * using the user's preferred browser locale.
 */
export function formatDate(timestamp: number | string | Date | undefined | null): string {
    if (!timestamp) return "—"
    try {
        const d = new Date(timestamp)
        if (isNaN(d.getTime())) return "—"
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        })
    } catch {
        return "—"
    }
}

/**
 * Creates a safe, clean file name for downloads/exports across operating systems.
 */
export function sanitizeFilename(name: string, extension: string = "json"): string {
    const cleanBase = (name || "untitled")
        .toLowerCase()
        .trim()
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^[._]+|[._]+$/g, "") || "untitled"

    const cleanExt = extension.replace(/^\./, "").trim()
    return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase
}

/**
 * Creates a scheduler that debounces calls (if delayMs > 0) and executes via requestAnimationFrame.
 */
export function createRafScheduler<T extends (...args: any[]) => void>(fn: T) {
    let rafId: number | null = null
    let timerId: ReturnType<typeof setTimeout> | null = null

    function cancel() {
        if (timerId !== null) {
            clearTimeout(timerId)
            timerId = null
        }
        if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
    }

    function schedule(...args: Parameters<T>) {
        scheduleDebounced(0, ...args)
    }

    function scheduleDebounced(delayMs: number, ...args: Parameters<T>) {
        cancel()
        const run = () => {
            rafId = requestAnimationFrame(() => {
                rafId = null
                fn(...args)
            })
        }

        if (delayMs > 0) {
            timerId = setTimeout(() => {
                timerId = null
                run()
            }, delayMs)
        } else {
            run()
        }
    }

    return { schedule, scheduleDebounced, cancel }
}
