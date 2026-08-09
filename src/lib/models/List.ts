import storage from "../storage/StorageManager.svelte"
import { getId, type NonFunctionProperties } from "../utils/common"
import type { Song } from "./Song"

export class Lists {
    static get(lists: List[], folderId: string | null): List[] {
        if (!folderId) {
            console.log("No folderId provided when trying to get lists.")
            return []
        }

        const folder = storage.getFolderById(folderId)
        if (!folder) return []

        return folder.getLists(lists)
    }

    static create(data: Partial<ListKeys> = {}, folderId: string): List | null {
        const folder = storage.getFolderById(folderId)
        if (!folder) {
            console.error(`Parent folder with id "${folderId}" not found`)
            return null
        }

        const list = new List(data)
        folder.addList(list.id)
        storage.addList(list)
        return list
    }
}

type ListKeys = NonFunctionProperties<List>
export class List {
    id: string
    name: string
    songs: string[]
    createdAt: number

    constructor(data: Partial<ListKeys> = {}) {
        this.id = data.id ?? getId("list")
        this.name = data.name ?? "Untitled"
        this.songs = data.songs ?? []
        this.createdAt = data.createdAt ?? Date.now()
    }

    getSongs(allSongs: Song[]) {
        const songs = this.songs.map((songId) => allSongs.find((s) => s.id === songId))
        return songs.filter((s): s is Song => s !== undefined)
    }

    addSong(songId: string) {
        this.songs.push(songId)
    }

    addSongs(songIds: string[]) {
        this.songs.push(...songIds)
    }
}
