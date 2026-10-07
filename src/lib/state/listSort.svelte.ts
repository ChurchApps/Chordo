import type { List } from "../models/List"

export type ListSortOption = "title_asc" | "title_desc" | "date_desc" | "date_asc"

const STORAGE_KEY = "chordo_list_sort"

function getInitialSort(): ListSortOption {
    try {
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem(STORAGE_KEY) as ListSortOption
            if (saved && ["title_asc", "title_desc", "date_desc", "date_asc"].includes(saved)) {
                return saved
            }
        }
    } catch {
        // ignore localStorage errors
    }
    return "date_desc"
}

export const listSortState = $state<{
    sortBy: ListSortOption
}>({
    sortBy: getInitialSort()
})

export function setListSort(option: ListSortOption): void {
    listSortState.sortBy = option
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, option)
        }
    } catch {
        // ignore localStorage errors
    }
}

export function sortLists(lists: List[], sortBy: ListSortOption = "date_desc"): List[] {
    const list = [...lists]
    return list.sort((a, b) => {
        const nameA = (a.name || "").trim()
        const nameB = (b.name || "").trim()
        const dateA = a.createdAt || 0
        const dateB = b.createdAt || 0

        switch (sortBy) {
            case "title_asc":
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            case "title_desc":
                return nameB.localeCompare(nameA, undefined, { sensitivity: "base", numeric: true })
            case "date_desc": {
                if (dateB !== dateA) return dateB - dateA
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            }
            case "date_asc": {
                if (dateA !== dateB) return dateA - dateB
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            }
            default:
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
        }
    })
}
