export type SupportedTheme = "teal" | "indigo" | "blue" | "green" | "orange" | "rose" | "slate"

export interface ThemeOption {
    id: SupportedTheme
    labelKey: string
    color: string // Primary accent for preview dot/chip
    background: string // Background preview tint
}

export const SUPPORTED_THEMES: ThemeOption[] = [
    { id: "orange", labelKey: "Sunset Orange", color: "#f5aa67", background: "#feddc2" },
    { id: "teal", labelKey: "Teal", color: "#67b6b6", background: "#c1e9e9" },
    { id: "indigo", labelKey: "Indigo", color: "#a892e8", background: "#e8ddff" },
    { id: "blue", labelKey: "Ocean Blue", color: "#7eb4e8", background: "#cbe2f8" },
    { id: "green", labelKey: "Forest Green", color: "#7ec89f", background: "#cbead8" },
    { id: "rose", labelKey: "Rose Pink", color: "#f296b1", background: "#fcd0dc" },
    { id: "slate", labelKey: "Slate Grey", color: "#98aabf", background: "#d4dee8" }
]

export const DEFAULT_THEME: SupportedTheme = "orange"

let currentTheme = $state<SupportedTheme>(DEFAULT_THEME)

export function getTheme(): SupportedTheme {
    return currentTheme
}

export function setTheme(theme: SupportedTheme) {
    const validTheme = SUPPORTED_THEMES.find((t) => t.id === theme)?.id ?? DEFAULT_THEME
    currentTheme = validTheme

    if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = validTheme
        const matched = SUPPORTED_THEMES.find((t) => t.id === validTheme)
        if (matched) {
            const metaTheme = document.querySelector('meta[name="theme-color"]')
            if (metaTheme) {
                metaTheme.setAttribute("content", matched.color)
            }
        }
    }
}
