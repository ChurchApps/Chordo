// Common OAuth & External Content types and base class

export interface ExternalSongItem {
    id: string
    name: string
    content: string
    artist?: string
    key?: string
    bpm?: number
    timeSignature?: string
}

export interface ExternalPlanItem {
    id: string
    title: string
    type: "song" | "header" | "item"
    song?: ExternalSongItem
}

export interface ExternalPlan {
    id: string
    name: string
    date?: string
    sortDate: number
    items: ExternalPlanItem[]
}

export interface OAuthTokens {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
}

export abstract class BaseOAuthClient {
    abstract id: "churchapps" | "planning_center"
    abstract name: string
    abstract icon: string
    protected abstract get clientId(): string
    protected get clientSecret(): string | undefined {
        return undefined
    }
    protected abstract apiBase: string

    get redirectUri(): string {
        return typeof window !== "undefined" ? `${window.location.origin}/oauth/callback` : ""
    }

    private get tokenKey(): string {
        return `chordo_${this.id}_tokens`
    }

    private get verifierKey(): string {
        return `chordo_${this.id}_verifier`
    }

    getTokens(): OAuthTokens | null {
        try {
            const raw = localStorage.getItem(this.tokenKey)
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    }

    setTokens(tokens: OAuthTokens | null): void {
        if (!tokens) localStorage.removeItem(this.tokenKey)
        else localStorage.setItem(this.tokenKey, JSON.stringify(tokens))
    }

    isConnected(): boolean {
        return !!this.getTokens()?.accessToken
    }

    disconnect(): void {
        this.setTokens(null)
        localStorage.removeItem(this.verifierKey)
    }

    protected setVerifier(verifier: string): void {
        localStorage.setItem(this.verifierKey, verifier)
    }

    protected getVerifier(): string | null {
        return localStorage.getItem(this.verifierKey)
    }

    abstract getAuthUrl(): Promise<string>
    abstract fetchPlans(): Promise<ExternalPlan[]>

    async handleCallback(code: string): Promise<boolean> {
        const verifier = this.getVerifier()
        if (!verifier) return false

        try {
            const res = await fetch("/api/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: this.id,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    code,
                    code_verifier: verifier,
                    redirect_uri: this.redirectUri
                })
            })

            if (!res.ok) return false
            const data = await res.json()

            this.setTokens({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
            })
            localStorage.removeItem(this.verifierKey)
            return true
        } catch {
            return false
        }
    }

    protected async fetchApi(path: string, accept = "application/json"): Promise<any> {
        const tokens = this.getTokens()
        if (!tokens?.accessToken) throw new Error("Not authenticated")

        const proxyUrl = `/api/oauth/proxy?url=${encodeURIComponent(`${this.apiBase}${path}`)}`
        const res = await fetch(proxyUrl, {
            headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: accept }
        })
        if (!res.ok) throw new Error(`API error ${res.status}`)
        return res.json()
    }
}

// PKCE generators
export async function generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return base64Url(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    return base64Url(new Uint8Array(digest))
}

function base64Url(buf: Uint8Array): string {
    return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
