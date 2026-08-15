import { setLocale, type SupportedLocale } from "../state/i18n.svelte"
import type { NonFunctionProperties } from "../utils/common"

export type SettingsKeys = NonFunctionProperties<Settings>

export class Settings {
    locale?: SupportedLocale

    constructor(data: Partial<SettingsKeys> = {}) {
        if (data.locale) {
            this.locale = data.locale
        }
    }

    /**
     * Applies active settings across the application subsystems (i18n, themes, fonts, etc.).
     */
    apply(): void {
        if (this.locale) {
            setLocale(this.locale)
        }
    }
}
