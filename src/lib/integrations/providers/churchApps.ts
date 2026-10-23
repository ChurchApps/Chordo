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
                rawItems = (await this.fetchApi(`/doing/planItems/plan/${rp.id}`)) || []
            } catch (err) {
                console.error(`[ChurchApps] Failed to fetch items for plan ${rp.id}:`, err)
            }

            const items = await Promise.all(
                rawItems.map(async (item) => {
                    const itemType = (item.itemType || item.type || "").toLowerCase()
                    const title = item.label || item.title || item.name || "Untitled"
                    const isSong = itemType === "song" || itemType === "arrangementkey" || item.songId || (itemType !== "header" && item.relatedId)

                    if (isSong) {
                        let content = item.chordChart || item.content || item.lyrics || ""
                        let key = item.key
                        let bpm = item.bpm
                        let artist = item.artist || item.author
                        let songTitle = title

                        // 1. If it's an arrangementKey, fetch the arrangement key details or presenter data
                        if (itemType === "arrangementkey" && item.relatedId) {
                            try {
                                const ak = await this.fetchApi(`/content/arrangementKeys/${item.relatedId}`)
                                if (ak) {
                                    key = key || ak.key
                                    bpm = bpm || ak.bpm
                                    content = content || ak.lyrics || ak.chordChart || ak.content || ""
                                    // It may have an arrangementId or songId or arrangement object
                                    const arrId = ak.arrangementId || (ak.arrangement && ak.arrangement.id)
                                    if (arrId && !content) {
                                        try {
                                            const arr = await this.fetchApi(`/content/arrangements/${arrId}`)
                                            if (arr) {
                                                content = content || arr.lyrics || arr.chordChart || arr.content || ""
                                                key = key || arr.key
                                                bpm = bpm || arr.bpm
                                            }
                                        } catch (err) {
                                            console.warn(`[ChurchApps] Could not fetch arrangement ${arrId}:`, err)
                                        }
                                    }
                                }
                            } catch (err) {
                                console.warn(`[ChurchApps] Could not fetch arrangementKey ${item.relatedId}:`, err)
                            }

                            // Also try presenter endpoint which returns full song data with arrangement
                            if (!content && item.churchId) {
                                try {
                                    const pres = await this.fetchApi(`/content/arrangementKeys/presenter/${item.churchId}/${item.relatedId}`)
                                    if (pres) {
                                        content = content || pres.lyrics || pres.chordChart || pres.content || ""
                                        key = key || pres.key
                                        bpm = bpm || pres.bpm
                                        artist = artist || pres.artist || pres.author
                                        if (pres.title || pres.name) songTitle = pres.title || pres.name
                                    }
                                } catch (err) {
                                    console.warn(`[ChurchApps] Could not fetch presenter data for arrangementKey ${item.relatedId}:`, err)
                                }
                            }
                        }

                        // 2. Try arrangement directly if available
                        const arrId = item.arrangementId || (itemType === "arrangement" ? item.relatedId : null)
                        if (arrId && (!content || !key || !bpm)) {
                            try {
                                const arr = await this.fetchApi(`/content/arrangements/${arrId}`)
                                if (arr) {
                                    content = content || arr.lyrics || arr.chordChart || arr.content || ""
                                    key = key || arr.key
                                    bpm = bpm || arr.bpm
                                    artist = artist || arr.artist || arr.author
                                    if (arr.title || arr.name) songTitle = arr.title || arr.name
                                }
                            } catch (err) {
                                console.warn(`[ChurchApps] Could not fetch arrangement ${arrId}:`, err)
                            }
                        }

                        // 3. Fall back to song directly
                        const songId = item.songId || (itemType === "song" ? item.relatedId : null)
                        if (songId && (!content || !artist)) {
                            try {
                                const song = await this.fetchApi(`/content/songs/${songId}`)
                                if (song) {
                                    content = content || song.chordChart || song.content || song.lyrics || ""
                                    key = key || song.key
                                    bpm = bpm || song.bpm
                                    artist = artist || song.artist || song.author
                                    if (song.title || song.name) songTitle = song.title || song.name
                                }
                            } catch (err) {
                                console.warn(`[ChurchApps] Could not fetch song ${songId}:`, err)
                            }
                        }

                        return {
                            id: `ca_item_${item.id}`,
                            title: songTitle,
                            type: "song" as const,
                            song: {
                                id: `ca_song_${item.id}`,
                                name: songTitle,
                                content,
                                artist,
                                bpm,
                                key
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
