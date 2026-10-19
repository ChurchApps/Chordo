export type SupportedTheme = "teal" | "indigo" | "blue" | "green" | "orange" | "rose" | "slate" | "white" | "monochrome" | "gold" | "chocolate"

export interface ThemeOption {
    id: SupportedTheme
    labelKey: string
    color: string // Primary accent for preview dot/chip
    background: string // Background preview tint
    gradient?: string
}

export const SUPPORTED_THEMES: ThemeOption[] = [
    { id: "orange", labelKey: "Sunset Orange", color: "#f5aa67", background: "#feddc2" },
    { id: "teal", labelKey: "Teal", color: "#67b6b6", background: "#c1e9e9" },
    { id: "indigo", labelKey: "Indigo", color: "#a892e8", background: "#e8ddff" },
    { id: "blue", labelKey: "Ocean Blue", color: "#7eb4e8", background: "#cbe2f8" },
    { id: "green", labelKey: "Forest Green", color: "#7ec89f", background: "#cbead8" },
    { id: "rose", labelKey: "Rose Pink", color: "#f296b1", background: "#fcd0dc" },
    { id: "slate", labelKey: "Slate Grey", color: "#98aabf", background: "#d4dee8" },
    // black and white
    { id: "white", labelKey: "Pure White", color: "#ffffff", background: "#ffffff" },
    { id: "monochrome", labelKey: "Monochrome Dark", color: "#1c1c1e", background: "#2c2c2e" },
    // gradient themes
    {
        id: "gold",
        labelKey: "Metallic Gold",
        color: "#ba8c28",
        background: "#e2d2ab",
        gradient: "linear-gradient(135deg, #d8b15d 0%, #ba8c28 35%, #825d10 70%, #c69d3e 100%)"
    },
    {
        id: "chocolate",
        labelKey: "Chocolate",
        color: "#b07b32",
        background: "#3e2415",
        gradient: "linear-gradient(135deg, #e8be6d 0%, #9e5b22 45%, #422112 100%)"
    }
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
            let metaTheme = document.querySelector('meta[name="theme-color"]')
            if (!metaTheme) {
                metaTheme = document.createElement("meta")
                metaTheme.setAttribute("name", "theme-color")
                document.head.appendChild(metaTheme)
            }
            metaTheme.setAttribute("content", matched.background)
        }
    }
}
