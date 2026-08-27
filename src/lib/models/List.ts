import storage from "../storage/StorageManager.svelte"
import { getId, type NonFunctionProperties } from "../utils/common"
import { t } from "../state/i18n.svelte"
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

    static duplicate(listId: string): List | null {
        const list = storage.getListById(listId)
        if (!list) return null

        let parentFolder = storage.folders.find((f) => f.lists.includes(listId))
        if (!parentFolder || parentFolder.type === "shared") {
            parentFolder = storage.folders.find((f) => f.type !== "shared") ?? parentFolder ?? storage.folders[0]
        }
        if (!parentFolder) return null

        const copySuffix = t("common", "copy")
        const newList = new List({
            name: `${list.name} (${copySuffix})`,
            songs: list.songs.map((s) => ({ ...s }))
        })

        parentFolder.addList(newList.id)
        storage.addList(newList)
        return newList
    }
}

export type ListSongItem = {
    id?: string
    songId?: string
    name?: string
    isSection?: boolean
    lastKnownName?: string
    transposed?: string
}

export type ListSongDisplayItem = {
    id: string
    songId?: string
    name: string
    isSection?: boolean
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
    lastUsedAt?: number

    constructor(data: Partial<ListKeys> = {}) {
        this.id = data.id ?? getId("list")
        this.name = data.name ?? "Untitled"
        this.songs = data.songs ? [...data.songs] : []
        this.createdAt = data.createdAt ?? Date.now()
        this.lastUsedAt = data.lastUsedAt ?? this.createdAt
    }

    touch() {
        this.lastUsedAt = Date.now()
        storage.updateList(this)
    }

    getSongs(allSongs: Song[]) {
        const songs = this.songs.map((item) => {
            if (item.isSection || !item.songId) return null
            return allSongs.find((s) => s.id === item.songId)
        })
        return songs.filter((s): s is Song => s !== undefined && s !== null)
    }

    getListItems(allSongs: Song[]): ListSongDisplayItem[] {
        return this.songs.map((item, index) => {
            if (item.isSection) {
                return {
                    id: item.id ?? `section-${index}-${item.name ?? ""}`,
                    name: item.name ?? item.lastKnownName ?? "Section",
                    isSection: true,
                    isDeleted: false
                }
            }
            const song = allSongs.find((s) => s.id === item.songId)
            if (song && song.name && item.lastKnownName !== song.name) {
                item.lastKnownName = song.name
            }
            return {
                id: item.id ?? item.songId ?? `song-${index}`,
                songId: item.songId,
                name: song?.name ?? item.lastKnownName ?? "Deleted Song",
                isSection: false,
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

    addSection(name: string) {
        this.songs = [...this.songs, { id: getId("section"), name, isSection: true }]
        storage.updateList(this)
    }

    renameSection(index: number, name: string) {
        if (index < 0 || index >= this.songs.length) return
        const updated = [...this.songs]
        updated[index] = { ...updated[index], name }
        this.songs = updated
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
