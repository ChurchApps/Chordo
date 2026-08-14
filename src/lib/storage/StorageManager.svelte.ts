import { Folder } from "../models/Folder"
import { List } from "../models/List"
import { Song } from "../models/Song"
import type { NonFunctionProperties } from "../utils/common"
import { FileSystem } from "./FileSystem"

type NonFunctionKeys<T> = {
    [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]
type PureData<T> = T extends Function ? never : T extends Array<infer U> ? Array<PureData<U>> : T extends object ? { [K in NonFunctionKeys<T>]: PureData<T[K]> } : T
type PureAppData = PureData<AppData>

type AppData = NonFunctionProperties<InstanceType<typeof StorageManager>>
class StorageManager {
    settings = $state<{}>({})
    folders = $state<Folder[]>([])
    lists = $state<List[]>([])
    songs = $state<Song[]>([])

    constructor() {
        this.load()
    }

    private getData(): AppData {
        return {
            settings: this.settings,
            folders: this.folders,
            lists: this.lists,
            songs: this.songs
        }
    }

    private DEFAULT_DATA: AppData = {
        settings: {},
        folders: [],
        lists: [],
        songs: []
    }

    ///

    persist() {
        this.save()
    }

    private hasChanges = false
    private isSaving: ReturnType<typeof setTimeout> | null = null
    private async save() {
        if (this.isSaving) {
            this.hasChanges = true
            return
        }

        // save max once every three seconds to avoid excessive writes
        this.isSaving = setTimeout(() => {
            this.isSaving = null
            if (this.hasChanges) {
                this.hasChanges = false
                this.save()
            }
        }, 3000)

        const wasSaved = await FileSystem.saveConfig<AppData>("data", this.getData())
        if (!wasSaved) console.error("Failed to persist data")
    }

    private async load() {
        const parsed = await FileSystem.loadConfig<PureAppData>("data")
        if (!parsed) {
            console.warn("No saved data found!")
            return
        }

        const songs = (parsed.songs || []).map((a) => new Song(a))
        const folders = (parsed.folders || []).map((a) => new Folder(a))
        const lists = (parsed.lists || []).map((a) => new List(a))

        this.settings = parsed.settings || {}
        this.folders = folders
        this.lists = lists
        this.songs = songs
    }

    // DEBUG
    resetAll() {
        Object.assign(this, this.DEFAULT_DATA)
        this.save()
    }

    ///

    getFolderById(folderId: string | null): Folder | null {
        if (!folderId) return null
        return this.folders.find((f) => f.id === folderId) || null
    }

    getListById(listId: string | null, _updater: any = null): List | null {
        if (!listId) return null
        return this.lists.find((l) => l.id === listId) || null
    }

    getSongById(songId: string | null, _updater: any = null): Song | null {
        if (!songId) return null
        return this.songs.find((s) => s.id === songId) || null
    }

    ///

    addFolder(folder: Folder) {
        this.folders.push(folder)
        this.save()
    }

    addList(list: List) {
        this.lists.push(list)
        this.save()
    }

    addSong(song: Song) {
        this.songs.push(song)
        this.save()
    }

    updateSong(song: Song) {
        this.songs = this.songs.map((s) => (s.id === song.id ? new Song(s as any) : s))
        this.save()
    }

    refreshSongs() {
        this.songs = [...this.songs]
    }

    refreshLists() {
        this.lists = [...this.lists]
    }

    refreshFolders() {
        this.folders = [...this.folders]
    }
}

export const storage = new StorageManager()

export default storage
