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

type ListSongItem = { songId: string; transposed?: string }

type ListKeys = NonFunctionProperties<List>
export class List {
    id: string
    name: string
    songs: ListSongItem[]
    createdAt: number

    constructor(data: Partial<ListKeys> = {}) {
        this.id = data.id ?? getId("list")
        this.name = data.name ?? "Untitled"
        this.songs = data.songs ?? []
        this.createdAt = data.createdAt ?? Date.now()
    }

    getSongs(allSongs: Song[]) {
        const songs = this.songs.map((item) => {
            return allSongs.find((s) => s.id === item.songId)
        })
        return songs.filter((s): s is Song => s !== undefined)
    }

    getSongItem(index: number): ListSongItem | undefined {
        return this.songs[index]
    }

    getTransposedKey(index: number): string | undefined {
        return this.songs[index]?.transposed
    }

    setSongTransposed(index: number, transposedKey: string) {
        if (index < 0 || index >= this.songs.length) return
        const current = this.songs[index]
        this.songs[index] = { songId: current.songId, transposed: transposedKey }
        storage.persist()
    }

    addSong(songId: string) {
        this.songs.push({ songId })
        storage.persist()
    }

    addSongs(songIds: string[]) {
        this.songs.push(...songIds.map((songId) => ({ songId })))
        storage.persist()
    }

    moveSong(fromIndex: number, toIndex: number): boolean {
        if (fromIndex < 0 || fromIndex >= this.songs.length) return false
        if (toIndex < 0 || toIndex >= this.songs.length) return false
        if (fromIndex === toIndex) return true
        const [moved] = this.songs.splice(fromIndex, 1)
        this.songs.splice(toIndex, 0, moved)
        storage.persist()
        return true
    }

    removeSong(index: number): boolean {
        if (index < 0 || index >= this.songs.length) return false
        this.songs.splice(index, 1)
        storage.persist()
        return true
    }
}
