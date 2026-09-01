import { createStore, get, set, del } from "idb-keyval"

type ConfigNames = "data"

function initStore(dbName: string, storeName: string) {
    try {
        if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
            return createStore(dbName, storeName)
        }
    } catch (e) {
        console.warn(`Failed to initialize IndexedDB store ${dbName}:`, e)
    }
    return null
}

// Dedicated IndexedDB custom stores for sheet-manager
const configStore = initStore("sheet-manager-db", "config-store")
const mediaStore = initStore("sheet-manager-media-db", "media-store")

// Request persistent storage so the browser does not evict data when low on disk
try {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
        navigator.storage
            .persist()
            .then((persistent) => {
                if (persistent) {
                    console.log("IndexedDB persistent storage granted")
                }
            })
            .catch(() => {})
    }
} catch {
    // Ignore storage permission check error
}

export class FileSystem {
    private static webUrlCache: Record<string, string> = {}

    private static getKey(folderName: string, name: string): string {
        const cleanName = name.replace(/\\/g, "/")
        return `${folderName}/${cleanName}`
    }

    // --- JSON & Config Storage ---

    static async writeJSONFile<T extends object>(folderName: string, name: string, data: T): Promise<boolean> {
        const key = this.getKey(folderName, name)
        let jsonString: string
        try {
            // Svelte 5 state proxies and class methods cannot be structured-cloned directly by IndexedDB,
            // so we stringify into clean JSON.
            jsonString = JSON.stringify(data)
        } catch (err) {
            console.error(`Failed to stringify JSON for "${key}":`, err)
            return false
        }

        try {
            if (configStore) {
                await set(key, jsonString, configStore)
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem(`sm_${key}`, jsonString)
            }
            return true
        } catch (err) {
            console.error(`Failed to write JSON for "${key}":`, err)
            // Fallback to localStorage if IndexedDB encounters an issue
            try {
                if (typeof localStorage !== "undefined") {
                    localStorage.setItem(`sm_${key}`, jsonString)
                    return true
                }
            } catch (fallbackErr) {
                console.error(`LocalStorage fallback failed for "${key}":`, fallbackErr)
            }
            return false
        }
    }

    static async readJSONFile<T extends object>(folderName: string, name: string): Promise<T | null> {
        const key = this.getKey(folderName, name)
        try {
            let raw: any = undefined
            if (configStore) {
                raw = await get<any>(key, configStore)
            }
            if (raw === undefined && typeof localStorage !== "undefined") {
                raw = localStorage.getItem(`sm_${key}`)
            }
            if (raw === undefined || raw === null) {
                return null
            }
            if (typeof raw === "string") {
                return JSON.parse(raw) as T
            }
            return raw as T
        } catch (err) {
            console.error(`Failed to read JSON for "${key}":`, err)
            return null
        }
    }

    // --- Binary & Media Operations (Images, PDFs) ---

    static async writeFile(folderName: string, name: string, base64Data: string): Promise<boolean> {
        const key = this.getKey(folderName, name)

        // Ensure data URL prefix is included in memory cache
        let fullDataUrl = base64Data
        if (!base64Data.startsWith("data:")) {
            fullDataUrl = `data:image/png;base64,${base64Data}`
        }
        this.webUrlCache[key] = fullDataUrl

        try {
            if (mediaStore) {
                await set(key, fullDataUrl, mediaStore)
            } else if (typeof localStorage !== "undefined") {
                localStorage.setItem(`sm_media_${key}`, fullDataUrl)
            }
            return true
        } catch (err) {
            console.error(`Failed to write media for "${key}":`, err)
            return false
        }
    }

    static async getFileWebUrl(folderName: string, name: string): Promise<string | null> {
        const key = this.getKey(folderName, name)

        if (this.webUrlCache[key]) {
            return this.webUrlCache[key]
        }

        try {
            if (mediaStore) {
                const data = await get<string>(key, mediaStore)
                if (data) {
                    const formatted = data.startsWith("data:") ? data : `data:image/png;base64,${data}`
                    this.webUrlCache[key] = formatted
                    return formatted
                }
            }
            if (typeof localStorage !== "undefined") {
                const data = localStorage.getItem(`sm_media_${key}`)
                if (data) {
                    const formatted = data.startsWith("data:") ? data : `data:image/png;base64,${data}`
                    this.webUrlCache[key] = formatted
                    return formatted
                }
            }
            return null
        } catch (err) {
            console.error(`Failed to read web media "${key}":`, err)
            return null
        }
    }

    static async deleteFile(folderName: string, name: string): Promise<boolean> {
        const key = this.getKey(folderName, name)
        delete this.webUrlCache[key]

        try {
            if (mediaStore) {
                await del(key, mediaStore)
            }
            if (typeof localStorage !== "undefined") {
                localStorage.removeItem(`sm_media_${key}`)
            }
            return true
        } catch (err) {
            console.error(`Failed to delete media "${key}":`, err)
            return false
        }
    }

    // --- Helpers ---

    static async saveConfig<T extends object>(config: ConfigNames, data: T): Promise<boolean> {
        return this.writeJSONFile<T>("config", config, data)
    }

    static async loadConfig<T extends object>(config: ConfigNames): Promise<T | null> {
        return this.readJSONFile<T>("config", config)
    }

    static async saveMedia(name: string, base64Data: string): Promise<boolean> {
        return this.writeFile("media", name, base64Data)
    }

    static async resolveImageUrl(imagePathOrDataUrl: string): Promise<string> {
        if (!imagePathOrDataUrl) return ""
        if (imagePathOrDataUrl.startsWith("data:") || imagePathOrDataUrl.startsWith("http:") || imagePathOrDataUrl.startsWith("https:") || imagePathOrDataUrl.startsWith("blob:")) {
            return imagePathOrDataUrl
        }
        const webUrl = await this.getMediaWebUrl(imagePathOrDataUrl)
        return webUrl || imagePathOrDataUrl
    }

    static async getMediaWebUrl(name: string): Promise<string | null> {
        return this.getFileWebUrl("media", name)
    }

    static async deleteMedia(name: string): Promise<boolean> {
        return this.deleteFile("media", name)
    }
}
