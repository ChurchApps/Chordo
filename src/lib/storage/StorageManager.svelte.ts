import { Folder } from "../models/Folder"
import { List } from "../models/List"
import { Song } from "../models/Song"
import { Settings } from "../models/Settings"
import type { NonFunctionProperties } from "../utils/common"
import { FileSystem } from "./FileSystem"

type NonFunctionKeys<T> = {
    [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]
type PureData<T> = T extends Function ? never : T extends Array<infer U> ? Array<PureData<U>> : T extends object ? { [K in NonFunctionKeys<T>]: PureData<T[K]> } : T
type PureAppData = PureData<AppData>

type AppData = NonFunctionProperties<InstanceType<typeof StorageManager>>
class StorageManager {
    settings = $state<Settings>(new Settings())
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
        settings: new Settings(),
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

        this.settings = new Settings(parsed.settings || {})
        this.settings.apply()
        this.folders = folders
        this.lists = lists
        this.songs = songs
    }

    importData(data: Partial<AppData>) {
        if (data.folders && Array.isArray(data.folders)) {
            this.folders = data.folders.map((f) => new Folder(f as any))
        }
        if (data.lists && Array.isArray(data.lists)) {
            this.lists = data.lists.map((l) => new List(l as any))
        }
        if (data.songs && Array.isArray(data.songs)) {
            this.songs = data.songs.map((s) => new Song(s as any))
        }
        if (data.settings) {
            this.settings = new Settings({ ...this.settings, ...data.settings })
            this.settings.apply()
        }
        this.refreshSongs()
        this.refreshLists()
        this.refreshFolders()
        this.save()
    }

    // DEBUG
    resetAll() {
        Object.assign(this, this.DEFAULT_DATA)
        this.refreshSongs()
        this.refreshLists()
        this.refreshFolders()
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
        const song = this.songs.find((s) => s.id === songId) || null
        if (song && !(song instanceof Song)) {
            return new Song(song as any)
        }
        return song
    }

    ///

    addFolder(folder: Folder) {
        this.folders.push(folder instanceof Folder ? folder : new Folder(folder as any))
        this.save()
    }

    addList(list: List) {
        this.lists.push(list instanceof List ? list : new List(list as any))
        this.save()
    }

    addSong(song: Song) {
        this.songs.push(song instanceof Song ? song : new Song(song as any))
        this.save()
    }

    updateSong(song: Song) {
        const nextSong = new Song(song)
        this.songs = this.songs.map((s) => (s.id === song.id ? nextSong : s))
        this.save()
    }

    updateList(list: List) {
        const nextList = new List(list)
        this.lists = this.lists.map((l) => (l.id === list.id ? nextList : l))
        this.save()
    }

    updateFolder(folder: Folder) {
        const nextFolder = new Folder(folder)
        this.folders = this.folders.map((f) => (f.id === folder.id ? nextFolder : f))
        this.save()
    }

    async deleteSong(songId: string) {
        const song = this.getSongById(songId)
        if (song && song.images && song.images.length > 0) {
            for (const img of song.images) {
                await FileSystem.deleteMedia(img)
            }
        }

        // Remove from songs array
        this.songs = this.songs.filter((s) => s.id !== songId)
        this.save()
    }

    deleteList(listId: string) {
        this.lists = this.lists.filter((l) => l.id !== listId)

        // Remove from parent folders
        for (const folder of this.folders) {
            folder.lists = folder.lists.filter((id) => id !== listId)
        }
        this.folders = [...this.folders]

        this.save()
    }

    deleteFolder(folderId: string) {
        this.folders = this.folders.filter((f) => f.id !== folderId)
        this.save()
    }

    refreshSongs() {
        this.songs = this.songs.map((s) => new Song(s as any))
    }

    refreshLists() {
        this.lists = this.lists.map((l) => new List(l as any))
    }

    refreshFolders() {
        this.folders = this.folders.map((f) => new Folder(f as any))
    }
}

export const storage = new StorageManager()

export default storage
