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
