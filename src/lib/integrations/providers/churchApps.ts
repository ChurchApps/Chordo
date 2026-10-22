import { getKey } from "../keys"
import { BaseOAuthClient, generateCodeVerifier, type ExternalPlan } from "../oauthHelper"

export class ChurchAppsClient extends BaseOAuthClient {
    id = "churchapps" as const
    name = "ChurchApps"
    icon = "church"
    protected apiBase = "https://api.churchapps.org"

    protected get clientId(): string {
        return (typeof window !== "undefined" && (window as any).__CHURCHAPPS_CLIENT_ID__) || getKey("churchApps_id")
    }

    protected get clientSecret(): string {
        return (typeof window !== "undefined" && (window as any).__CHURCHAPPS_CLIENT_SECRET__) || getKey("churchApps_secret")
    }

    async getAuthUrl(): Promise<string> {
        const verifier = await generateCodeVerifier()
        this.setVerifier(verifier)

        const state = btoa(JSON.stringify({ provider: this.id, nonce: Math.random() }))
        const returnUrl = `/oauth?client_id=${encodeURIComponent(this.clientId)}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=plans&state=${encodeURIComponent(state)}`
        return `https://admin.b1.church/login?returnUrl=${encodeURIComponent(returnUrl)}&forceLogin=1`
    }

    async fetchPlans(): Promise<ExternalPlan[]> {
        const plans: ExternalPlan[] = []
        const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
        const rawPlans = (await this.fetchApi("/doing/plans")) || []

        for (const rp of rawPlans) {
            const planDate = rp.serviceDate || rp.planDate || rp.date
            const sortDate = planDate ? new Date(planDate).getTime() : Date.now()
            if (sortDate < oneMonthAgo) continue
            let rawItems: any[] = []

            try {
                rawItems = (await this.fetchApi(`/doing/planItems?planId=${rp.id}`)) || []
            } catch {}

            const items = await Promise.all(
                rawItems.map(async (item) => {
                    const itemType = (item.itemType || item.type || "").toLowerCase()
                    const title = item.title || item.name || "Untitled"

                    if (itemType === "song" || item.songId) {
                        let content = item.chordChart || item.content || item.lyrics || ""
                        if (!content && item.songId) {
                            try {
                                const song = await this.fetchApi(`/content/songs/${item.songId}`)
                                content = song.chordChart || song.content || song.lyrics || ""
                            } catch {}
                        }
                        return {
                            id: `ca_item_${item.id}`,
                            title,
                            type: "song" as const,
                            song: {
                                id: `ca_song_${item.id}`,
                                name: title,
                                content,
                                artist: item.artist || item.author,
                                bpm: item.bpm,
                                key: item.key
                            }
                        }
                    }

                    return {
                        id: `ca_${item.id}`,
                        title,
                        type: "header" as const
                    }
                })
            )

            plans.push({
                id: `churchapps_plan_${rp.id}`,
                name: rp.name || `Service - ${new Date(sortDate).toLocaleDateString()}`,
                date: planDate,
                sortDate,
                items
            })
        }

        return plans.sort((a, b) => a.sortDate - b.sortDate)
    }
}

export const churchApps = new ChurchAppsClient()
