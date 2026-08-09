import storage from "../storage/StorageManager.svelte"
import { getId, sortByName, type NonFunctionProperties } from "../utils/common"

export class Songs {
    static get(songs: Song[], listId?: string | null): Song[] {
        if (!listId) return sortByName(songs) // get all songs

        const list = storage.getListById(listId)
        if (!list) return []

        return list.getSongs(songs)
    }

    static create(data: Partial<SongKeys> = {}, listId: string | null): Song {
        const song = new Song(data)

        const list = storage.getListById(listId)
        if (list) list.addSong(song.id)

        storage.addSong(song)
        return song
    }
}

export type SongKeys = NonFunctionProperties<Song>
export class Song {
    id: string
    name: string // title
    artist: string
    key: string
    tempo: string
    content: string
    createdAt: number
    drawings: string[]

    constructor(data: Partial<SongKeys> = {}) {
        this.id = data.id ?? getId("song")
        this.name = data.name ?? "Untitled"
        this.artist = data.artist ?? ""
        this.key = data.key ?? ""
        this.tempo = data.tempo ?? ""
        this.content = data.content ?? ""
        this.createdAt = data.createdAt ?? Date.now()
        this.drawings = data.drawings ?? []
    }

    getTitle(): string {
        return this.name || "Untitled"
    }
}
