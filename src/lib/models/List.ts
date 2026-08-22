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

export type ListSongItem = {
    songId: string
    lastKnownName?: string
    transposed?: string
}

export type ListSongDisplayItem = {
    songId: string
    name: string
    isDeleted: boolean
    song?: Song
    transposed?: string
}

type ListKeys = NonFunctionProperties<List>
export class List {
    id: string
    name: string
    songs: ListSongItem[]
    createdAt: number

    constructor(data: Partial<ListKeys> = {}) {
        this.id = data.id ?? getId("list")
        this.name = data.name ?? "Untitled"
        this.songs = data.songs ? [...data.songs] : []
        this.createdAt = data.createdAt ?? Date.now()
    }

    getSongs(allSongs: Song[]) {
        const songs = this.songs.map((item) => {
            return allSongs.find((s) => s.id === item.songId)
        })
        return songs.filter((s): s is Song => s !== undefined)
    }

    getListItems(allSongs: Song[]): ListSongDisplayItem[] {
        return this.songs.map((item) => {
            const song = allSongs.find((s) => s.id === item.songId)
            if (song && song.name && item.lastKnownName !== song.name) {
                item.lastKnownName = song.name
            }
            return {
                songId: item.songId,
                name: song?.name ?? item.lastKnownName ?? "Deleted Song",
                isDeleted: !song,
                song,
                transposed: item.transposed
            }
        })
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
        const updated = [...this.songs]
        updated[index] = { ...current, transposed: transposedKey }
        this.songs = updated
        storage.updateList(this)
    }

    addSong(songId: string, songName?: string) {
        const name = songName ?? storage.getSongById(songId)?.name
        this.songs = [...this.songs, { songId, lastKnownName: name }]
        storage.updateList(this)
    }

    addSongs(songIds: string[]) {
        const newItems = songIds.map((songId) => ({
            songId,
            lastKnownName: storage.getSongById(songId)?.name
        }))
        this.songs = [...this.songs, ...newItems]
        storage.updateList(this)
    }

    moveSong(fromIndex: number, toIndex: number): boolean {
        if (fromIndex < 0 || fromIndex >= this.songs.length) return false
        if (toIndex < 0 || toIndex >= this.songs.length) return false
        if (fromIndex === toIndex) return true
        const next = [...this.songs]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        this.songs = next
        storage.updateList(this)
        return true
    }

    removeSong(index: number): boolean {
        if (index < 0 || index >= this.songs.length) return false
        this.songs = this.songs.filter((_, i) => i !== index)
        storage.updateList(this)
        return true
    }

    setSongs(songs: ListSongItem[]) {
        this.songs = [...songs]
        storage.updateList(this)
    }
}
