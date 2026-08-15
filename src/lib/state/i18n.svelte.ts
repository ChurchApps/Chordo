import type enJson from "../../lang/en.json"

export type TranslationsSchema = typeof enJson

// 1. Constrain SectionKey to string keys only
export type SectionKey = keyof TranslationsSchema & string

// 2. Distribute over S, check that the section is an object, and extract string keys
export type ItemKey<S extends SectionKey> = S extends SectionKey ? (TranslationsSchema[S] extends Record<string, unknown> ? keyof TranslationsSchema[S] & string : never) : never

export const SUPPORTED_LANGUAGES = [
    { code: "en", label: "English", prefixes: ["en"] },
    { code: "no", label: "Norsk", prefixes: ["no", "nb", "nn"] }
] as const

export type SupportedLocale = (typeof SUPPORTED_LANGUAGES)[number]["code"]

// Vite glob import for translation modules
const modules = import.meta.glob<{ default: Record<string, Record<string, string>> }>("../../lang/*.json")

function detectDefaultLocale(): SupportedLocale {
    if (typeof navigator !== "undefined") {
        const languages = navigator.languages || [navigator.language]
        for (const lang of languages) {
            if (!lang) continue

            const code = lang.toLowerCase()
            const match = SUPPORTED_LANGUAGES.find((item) => item.prefixes.some((prefix) => code.startsWith(prefix)))
            if (match) return match.code
        }
    }

    return SUPPORTED_LANGUAGES[0].code
}

const initialLocale = detectDefaultLocale()
let currentLocale = $state<SupportedLocale>(initialLocale)
let currentTranslations = $state<Record<string, Record<string, string>>>({})
let isLoaded = $state<boolean>(false)

export async function loadLocale(locale: SupportedLocale): Promise<void> {
    isLoaded = false
    const path = `../../lang/${locale}.json`
    const loader = modules[path]

    if (loader) {
        try {
            const mod = await loader()
            currentTranslations = mod.default || mod
            currentLocale = locale
            isLoaded = true
        } catch (err) {
            console.error(`Failed to load translation file for locale "${locale}"`, err)
        }
    } else {
        console.error(`Translation module not found for path "${path}"`)
    }
}

export function getLocale(): SupportedLocale {
    return currentLocale
}

export function setLocale(locale: SupportedLocale): void {
    if (locale === currentLocale) return
    loadLocale(locale)
}

export function getIsLoaded(): boolean {
    return isLoaded
}

/**
 * Type-safe translation function requiring valid section and key derived from src/lang/en.json.
 */
export function t<S extends SectionKey>(section: S, key: ItemKey<S>): string {
    if (!isLoaded) return ""

    const fallback = `${section}.${key}`
    return currentTranslations[section]?.[key] ?? fallback
}

// Initial load for default locale
loadLocale(initialLocale)
