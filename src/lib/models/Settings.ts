import { setLocale, type SupportedLocale } from "../state/i18n.svelte"
import { setTheme, type SupportedTheme } from "../state/theme.svelte"
import type { NonFunctionProperties } from "../utils/common"

export type SettingsKeys = NonFunctionProperties<Settings>

export interface DrawSettings {
    color?: string
    brushSize?: number
}

export class Settings {
    locale?: SupportedLocale
    theme?: SupportedTheme
    draw?: DrawSettings
    shareCache?: Record<string, string>

    constructor(data: Partial<SettingsKeys> = {}) {
        if (data.locale) this.locale = data.locale
        if (data.theme) this.theme = data.theme
        if (data.draw) this.draw = { ...data.draw }
        if (data.shareCache) this.shareCache = { ...data.shareCache }
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
}
