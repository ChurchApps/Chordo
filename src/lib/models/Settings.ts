import { setLocale, type SupportedLocale } from "../state/i18n.svelte"
import { setTheme, type SupportedTheme } from "../state/theme.svelte"
import type { NonFunctionProperties } from "../utils/common"

export type SettingsKeys = NonFunctionProperties<Settings>

export type PageSwitchAnimation = "none" | "fast" | "slow"

export interface SongPaperOptions {
    background?: string
    fontSize?: number
    pageAnimation?: PageSwitchAnimation
}

export interface DrawSettings {
    color?: string
    brushSize?: number
}

export type ShareCacheEntry = {
    id: string
    createdAt: number
}

export class Settings {
    locale?: SupportedLocale
    theme?: SupportedTheme
    draw?: DrawSettings
    paperOptions?: SongPaperOptions
    shareCache?: Record<string, ShareCacheEntry>

    constructor(data: Partial<SettingsKeys> = {}) {
        if (data.locale) this.locale = data.locale
        if (data.theme) this.theme = data.theme
        if (data.draw) this.draw = { ...data.draw }
        if (data.paperOptions) this.paperOptions = { ...data.paperOptions }
        if (data.shareCache) this.shareCache = this.initShareCache(data)
    }

    /**
     * Applies active settings across the application subsystems (i18n, themes, fonts, etc.).
     */
    apply(): void {
        if (this.locale) {
            setLocale(this.locale)
        }
        if (this.theme) {
            setTheme(this.theme)
        }
    }

    private static ONE_DAY = 24 * 60 * 60 * 1000
    private static SHARE_CACHE_EXPIRY_MS = 90 * this.ONE_DAY
    private initShareCache(data: Partial<SettingsKeys> = {}): Record<string, ShareCacheEntry> {
        const now = Date.now()
        const cleaned: Record<string, ShareCacheEntry> = {}
        for (const [hash, entry] of Object.entries(data.shareCache || {})) {
            if (!entry) continue

            const normalized: ShareCacheEntry = typeof entry === "string" ? { id: entry, createdAt: now } : entry

            if (normalized.id && now - (normalized.createdAt || 0) <= Settings.SHARE_CACHE_EXPIRY_MS) {
                cleaned[hash] = normalized
            }
        }
        return cleaned
    }
}
