import storage from "../storage/StorageManager.svelte"
import { FileSystem } from "../storage/FileSystem"
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
    images: string[]

    constructor(data: Partial<SongKeys> = {}) {
        this.id = data.id ?? getId("song")
        this.name = data.name ?? "Untitled"
        this.artist = data.artist ?? ""
        this.key = data.key ?? ""
        this.tempo = data.tempo ?? ""
        this.content = data.content ?? ""
        this.createdAt = data.createdAt ?? Date.now()
        this.drawings = data.drawings ?? []
        this.images = data.images ?? []
    }

    getTitle(): string {
        return this.name || "Untitled"
    }

    // Images

    async addImage(dataUrl: string): Promise<string> {
        if (!this.images) this.images = []
        const filename = `${this.id}_${Date.now()}_${getId("img")}.png`
        await FileSystem.saveMedia(filename, dataUrl)
        this.images.push(filename)
        return filename
    }

    async rotateImage(index: number, degrees: number = 90): Promise<void> {
        if (!this.images || index < 0 || index >= this.images.length) return
        const filename = this.images[index]
        if (!filename) return

        const webUrl = await FileSystem.resolveImageUrl(filename)
        if (!webUrl) return

        const rotatedDataUrl = await new Promise<string>((resolve) => {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                const canvas = document.createElement("canvas")
                canvas.width = img.height
                canvas.height = img.width
                const ctx = canvas.getContext("2d")
                if (!ctx) return resolve(webUrl)

                ctx.translate(canvas.width / 2, canvas.height / 2)
                ctx.rotate((degrees * Math.PI) / 180)
                ctx.drawImage(img, -img.width / 2, -img.height / 2)

                resolve(canvas.toDataURL("image/png"))
            }
            img.onerror = () => resolve(webUrl)
            img.src = webUrl
        })

        await FileSystem.saveMedia(filename, rotatedDataUrl)
    }

    moveImage(fromIndex: number, toIndex: number): void {
        if (!this.images || fromIndex < 0 || fromIndex >= this.images.length) return
        if (toIndex < 0 || toIndex >= this.images.length) return

        const [movedImage] = this.images.splice(fromIndex, 1)
        this.images.splice(toIndex, 0, movedImage)

        if (this.drawings && this.drawings.length > 0) {
            const [movedDrawing] = this.drawings.splice(fromIndex, 1)
            this.drawings.splice(toIndex, 0, movedDrawing)
        }
    }

    async removeImage(index: number): Promise<void> {
        if (!this.images || index < 0 || index >= this.images.length) return
        const [filename] = this.images.splice(index, 1)
        if (filename) {
            await FileSystem.deleteMedia(filename)
        }
        if (this.drawings && this.drawings.length > index) {
            this.drawings.splice(index, 1)
        }
    }
}
