import { showToast } from "../state/toast.svelte"
import { integrationState } from "./integrationState.svelte"
import { churchApps } from "./providers/churchApps"
import { planningCenter } from "./providers/planningCenter"

/**
 * Parses and executes OAuth redirect callback parameters from the URL.
 * Automatically clears query parameters from browser history upon completion.
 */
export async function handleOAuthCallback(): Promise<void> {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const code = url.searchParams.get("code")
    const stateParam = url.searchParams.get("state")

    if (code && (url.pathname.includes("/oauth/callback") || stateParam)) {
        let providerId: "churchapps" | "planning_center" = "planning_center"
        if (stateParam) {
            try {
                const parsedState = JSON.parse(atob(stateParam))
                if (parsedState.provider) providerId = parsedState.provider
            } catch {}
        }

        const provider = providerId === "churchapps" ? churchApps : planningCenter
        showToast(`Connecting to ${provider.name}...`, "info", 3000)

        const success = await provider.handleCallback(code)
        if (success) {
            integrationState.setConnected(providerId)
            showToast(`Connected to ${provider.name}!`, "success", 4000)
        } else {
            showToast(`Failed to connect to ${provider.name}`, "error", 5000)
        }

        // Clean URL query params
        window.history.replaceState({}, document.title, window.location.pathname.replace(/\/oauth\/callback\/?$/, ""))
    }
}
