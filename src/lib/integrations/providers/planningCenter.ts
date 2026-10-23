import { getKey } from "../keys"
import { BaseOAuthClient, generateCodeChallenge, generateCodeVerifier, type ExternalPlan } from "../oauthHelper"

export class PlanningCenterClient extends BaseOAuthClient {
    id = "planning_center" as const
    name = "Planning Center"
    icon = "event_available"
    protected apiBase = "https://api.planningcenteronline.com"

    protected get clientId(): string {
        return (typeof window !== "undefined" && (window as any).__PCO_CLIENT_ID__) || getKey("pco_id")
    }

    async getAuthUrl(): Promise<string> {
        const verifier = await generateCodeVerifier()
        const challenge = await generateCodeChallenge(verifier)
        this.setVerifier(verifier)

        const state = btoa(JSON.stringify({ provider: this.id, nonce: Math.random() }))
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: "code",
            scope: "services",
            code_challenge: challenge,
            code_challenge_method: "S256",
            state
        })
        return `https://api.planningcenteronline.com/oauth/authorize?${params.toString()}`
    }

    async fetchPlans(): Promise<ExternalPlan[]> {
        const plans: ExternalPlan[] = []
        const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
        const serviceTypes = (await this.fetchApi("/services/v2/service_types", "application/vnd.api+json"))?.data || []

        for (const st of serviceTypes) {
            const [futureRes, pastRes] = await Promise.all([
                this.fetchApi(`/services/v2/service_types/${st.id}/plans?filter=future&order=sort_date&per_page=15`, "application/vnd.api+json"),
                this.fetchApi(`/services/v2/service_types/${st.id}/plans?filter=past&order=-sort_date&per_page=10`, "application/vnd.api+json")
            ])

            const futurePlans = futureRes?.data || []
            const pastPlans = (pastRes?.data || []).filter((rp: any) => {
                const sortDate = rp.attributes?.sort_date ? new Date(rp.attributes.sort_date).getTime() : 0
                return sortDate >= oneMonthAgo
            })

            // Combine and deduplicate plans by id
            const planMap = new Map<string, any>()
            for (const rp of [...pastPlans, ...futurePlans]) {
                planMap.set(rp.id, rp)
            }
            const rawPlans = Array.from(planMap.values())

            for (const rp of rawPlans) {
                const planTitle = rp.attributes?.dates || rp.attributes?.title || `Plan ${rp.id}`
                const itemsData = await this.fetchApi(`/services/v2/service_types/${st.id}/plans/${rp.id}/items?include=arrangement,song`, "application/vnd.api+json")
                const included = itemsData?.included || []

                const items = (itemsData?.data || []).map((item: any) => {
                    const itemType = item.attributes?.item_type
                    const title = item.attributes?.title || "Untitled"

                    if (itemType === "song") {
                        const arr = included.find((inc: any) => inc.type === "Arrangement" && inc.id === item.relationships?.arrangement?.data?.id)
                        const song = included.find((inc: any) => inc.type === "Song" && inc.id === item.relationships?.song?.data?.id)
                        return {
                            id: `pco_item_${item.id}`,
                            title: song?.attributes?.title || title,
                            type: "song" as const,
                            song: {
                                id: `pco_song_${item.id}`,
                                name: song?.attributes?.title || title,
                                content: arr?.attributes?.chord_chart || item.attributes?.description || "",
                                artist: song?.attributes?.author || "",
                                bpm: arr?.attributes?.bpm ? Number(arr.attributes.bpm) : undefined,
                                key: item.attributes?.key_name || arr?.attributes?.chord_chart_key || ""
                            }
                        }
                    }

                    return {
                        id: `pco_${item.id}`,
                        title,
                        type: "header" as const
                    }
                })

                plans.push({
                    id: `pco_plan_${rp.id}`,
                    name: st.attributes?.name ? `${st.attributes.name} - ${planTitle}` : planTitle,
                    date: rp.attributes?.dates,
                    sortDate: rp.attributes?.sort_date ? new Date(rp.attributes.sort_date).getTime() : Date.now(),
                    items
                })
            }
        }

        return plans.sort((a, b) => a.sortDate - b.sortDate)
    }
}

export const planningCenter = new PlanningCenterClient()
