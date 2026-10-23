import { Folder } from "../models/Folder"
import { List } from "../models/List"
import { Song } from "../models/Song"
import { showToast } from "../state/toast.svelte"
import storage from "../storage/StorageManager.svelte"
import type { BaseOAuthClient, ExternalPlan } from "./oauthHelper"
import { churchApps } from "./providers/churchApps"
import { planningCenter } from "./providers/planningCenter"

export type ConnectedProviderId = "churchapps" | "planning_center" | null

export function planToList(plan: ExternalPlan): List {
    const songs = plan.items.map((item, idx) => {
        if (item.type === "header") {
            return {
                id: item.id || `section_${idx}`,
                name: item.title,
                type: "section" as const
            }
        }
        if (item.song) {
            return {
                id: item.song.id,
                lastKnownName: item.song.name,
                transposed: item.song.key,
                type: "song" as const
            }
        }
        return {
            id: item.id || `item_${idx}`,
            name: item.title,
            type: "section" as const
        }
    })

    return new List({
        id: plan.id,
        name: plan.name,
        songs: songs as any,
        createdAt: plan.sortDate || Date.now()
    })
}

export function getPlanAsList(planId: string | null): List | null {
    if (!planId) return null
    const plan = integrationState.cachedPlans.find((p) => p.id === planId)
    return plan ? planToList(plan) : null
}

export function getCachedPlansAsLists(): List[] {
    return integrationState.cachedPlans.map(planToList)
}

export function getExternalSong(songId: string | null): Song | null {
    if (!songId) return null
    for (const plan of integrationState.cachedPlans) {
        for (const item of plan.items) {
            if (item.song && item.song.id === songId) {
                return new Song({
                    id: item.song.id,
                    name: item.song.name,
                    content: item.song.content || "",
                    metadata: {
                        artist: item.song.artist,
                        key: item.song.key,
                        tempo: item.song.bpm != null ? String(item.song.bpm) : undefined,
                        timeSignature: item.song.timeSignature
                    }
                })
            }
        }
    }
    return null
}

const KEY_PROVIDER = "chordo_connected_provider"
const KEY_PLANS = "chordo_cached_external_plans"
const KEY_SEEN_PLANS = "chordo_seen_external_plans"

export type PlanStatus = "new" | "changed"

class IntegrationStateManager {
    activeProviderId = $state<ConnectedProviderId>(this.initProvider())
    cachedPlans = $state<ExternalPlan[]>(this.initCachedPlans())
    seenPlanHashes = $state<Record<string, string>>(this.initSeenPlans())
    isLoading = $state<boolean>(false)
    hasFetchedThisSession = false

    private initProvider(): ConnectedProviderId {
        if (typeof window === "undefined") return null
        const val = localStorage.getItem(KEY_PROVIDER) as ConnectedProviderId
        if (val === "churchapps" && churchApps.isConnected()) return "churchapps"
        if (val === "planning_center" && planningCenter.isConnected()) return "planning_center"
        return null
    }

    private initCachedPlans(): ExternalPlan[] {
        if (typeof window === "undefined") return []
        try {
            const raw = localStorage.getItem(KEY_PLANS)
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    }

    private initSeenPlans(): Record<string, string> {
        if (typeof window === "undefined") return {}
        try {
            const raw = localStorage.getItem(KEY_SEEN_PLANS)
            return raw ? JSON.parse(raw) : {}
        } catch {
            return {}
        }
    }

    getPlanHash(plan: ExternalPlan): string {
        const repr = {
            id: plan.id,
            name: plan.name,
            items: plan.items.map((i) => ({
                id: i.id,
                title: i.title,
                type: i.type,
                songId: i.song?.id,
                songName: i.song?.name,
                songKey: i.song?.key,
                songBpm: i.song?.bpm
            }))
        }
        return JSON.stringify(repr)
    }

    getPlanStatus(planId: string): PlanStatus | null {
        if (Object.keys(this.seenPlanHashes).length === 0) return null
        const plan = this.cachedPlans.find((p) => p.id === planId)
        if (!plan) return null

        const lastHash = this.seenPlanHashes[planId]
        if (!lastHash) return "new"
        if (lastHash !== this.getPlanHash(plan)) return "changed"
        return null
    }

    markPlanAsSeen(planId: string) {
        const plan = this.cachedPlans.find((p) => p.id === planId)
        if (!plan) return
        const hash = this.getPlanHash(plan)
        if (this.seenPlanHashes[planId] === hash) return

        this.seenPlanHashes = {
            ...this.seenPlanHashes,
            [planId]: hash
        }
        if (typeof window !== "undefined") {
            localStorage.setItem(KEY_SEEN_PLANS, JSON.stringify(this.seenPlanHashes))
        }
    }

    getProvider(id: ConnectedProviderId): BaseOAuthClient | null {
        if (id === "churchapps") return churchApps
        if (id === "planning_center") return planningCenter
        return null
    }

    getActiveProvider(): BaseOAuthClient | null {
        return this.getProvider(this.activeProviderId)
    }

    async connect(id: "churchapps" | "planning_center") {
        if (this.activeProviderId && this.activeProviderId !== id) {
            this.disconnectActive()
        }
        const provider = this.getProvider(id)
        if (!provider) return
        try {
            window.location.href = await provider.getAuthUrl()
        } catch (e: any) {
            showToast(`Could not connect: ${e?.message || e}`, "error")
        }
    }

    disconnectActive() {
        const provider = this.getActiveProvider()
        provider?.disconnect()
        this.activeProviderId = null
        this.cachedPlans = []
        this.seenPlanHashes = {}
        this.hasFetchedThisSession = false
        localStorage.removeItem(KEY_PROVIDER)
        localStorage.removeItem(KEY_PLANS)
        localStorage.removeItem(KEY_SEEN_PLANS)
        showToast("Disconnected", "info")
    }

    setConnected(id: "churchapps" | "planning_center") {
        if (id === "churchapps") planningCenter.disconnect()
        else churchApps.disconnect()

        this.activeProviderId = id
        localStorage.setItem(KEY_PROVIDER, id)
        this.syncPlans(true)
    }

    async syncPlans(force = true): Promise<ExternalPlan[]> {
        const provider = this.getActiveProvider()
        if (!provider) return []
        if (!force && this.hasFetchedThisSession && this.cachedPlans.length > 0) {
            return this.cachedPlans
        }

        const isInitialFetch = Object.keys(this.seenPlanHashes).length === 0

        this.isLoading = true
        try {
            const plans = await provider.fetchPlans()
            this.cachedPlans = plans
            this.hasFetchedThisSession = true
            localStorage.setItem(KEY_PLANS, JSON.stringify(plans))

            if (isInitialFetch) {
                const initialMap: Record<string, string> = {}
                for (const p of plans) {
                    initialMap[p.id] = this.getPlanHash(p)
                }
                this.seenPlanHashes = initialMap
                localStorage.setItem(KEY_SEEN_PLANS, JSON.stringify(initialMap))
            }

            return plans
        } catch (e) {
            console.error("Failed to sync plans", e)
            return this.cachedPlans
        } finally {
            this.isLoading = false
        }
    }

    getPlanAsList(planId: string | null): List | null {
        return getPlanAsList(planId)
    }

    getExternalSong(songId: string | null): Song | null {
        return getExternalSong(songId)
    }

    duplicatePlanToLocal(plan: ExternalPlan) {
        const listSongs = plan.items
            .map((item) => {
                if (item.type === "header") {
                    return { id: item.id, name: item.title, type: "section" as const }
                }
                if (item.song) {
                    let s = storage.songs.find((x) => x.name.trim().toLowerCase() === item.song!.name.trim().toLowerCase())
                    if (!s) {
                        s = new Song({
                            name: item.song.name,
                            content: item.song.content || "",
                            metadata: {
                                artist: item.song.artist,
                                key: item.song.key,
                                tempo: item.song.bpm != null ? String(item.song.bpm) : undefined,
                                timeSignature: item.song.timeSignature
                            }
                        })
                        storage.addSong(s)
                    }
                    return { songId: s.id, type: "song" as const }
                }
                return null
            })
            .filter(Boolean)

        const provider = this.getActiveProvider()
        const folderName = provider?.name || "Services"
        let targetFolder = storage.folders.find((f) => f.type !== "shared" && f.name.trim().toLowerCase() === folderName.trim().toLowerCase())

        if (!targetFolder) {
            targetFolder = new Folder({ name: folderName })
            storage.addFolder(targetFolder)
        }

        const newList = new List({ name: plan.name, songs: listSongs as any })
        targetFolder.addList(newList.id)
        storage.addList(newList)
        showToast(`Imported setlist "${plan.name}"`, "success")
        return { list: newList, folder: targetFolder }
    }
}

export const integrationState = new IntegrationStateManager()
