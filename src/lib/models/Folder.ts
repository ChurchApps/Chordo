import storage from "../storage/StorageManager.svelte"
import { getId, sortByName, type NonFunctionProperties } from "../utils/common"
import type { List } from "./List"

export class Folders {
    static get(folders: Folder[]): Folder[] {
        const shared = folders.filter((f) => f.type === "shared")
        const others = folders.filter((f) => f.type !== "shared")
        return [...shared, ...sortByName(others)]
    }

    static create(data: Partial<FolderKeys> = {}): Folder | null {
        if (!data.name) return null // just for null return

        const folder = new Folder(data)
        storage.addFolder(folder)
        return folder
    }
}

type FolderKeys = NonFunctionProperties<Folder>
export class Folder {
    id: string
    name: string
    lists: string[]
    createdAt: number
    type: "default" | "shared"

    constructor(data: Partial<FolderKeys> = {}) {
        this.id = data.id ?? getId("folder")
        this.name = data.name ?? "Untitled"
        this.lists = data.lists || []
        this.createdAt = data.createdAt ?? Date.now()
        this.type = data.type ?? "default"
    }

    getLists(allLists: List[]) {
        const lists = allLists.filter((l) => this.lists.includes(l.id))
        return sortByName(lists)
    }

    addList(listId: string) {
        if (!this.lists.includes(listId)) this.lists.push(listId)
        storage.updateFolder(this)
    }
}
