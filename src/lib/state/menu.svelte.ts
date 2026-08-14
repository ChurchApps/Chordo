import type { pages } from "../../components/pages/pages"
import type { popups } from "../../components/popups/popups"
import storage from "../storage/StorageManager.svelte"
import { clone } from "../utils/common"

/// PAGES ///

type Pages = keyof typeof pages

type MenuState = {
    activePage: Pages
    contentId: string | null
    customPageTitle: string | null
}

export const listEditingState = $state<{ isEditing: boolean; onDeleteSelected?: () => void }>({ isEditing: false })

export const menuState = $state<MenuState & { previousPages: MenuState[] }>({
    activePage: "home",
    contentId: null,
    customPageTitle: null,
    previousPages: []
})

function getCurrentState(): MenuState {
    const currentState: any = clone(menuState)
    delete currentState.previousPages
    return currentState
}

export function updatePageTitle(newTitle: string | null): void {
    const oldTitle = menuState.customPageTitle
    if (oldTitle === newTitle) return

    menuState.customPageTitle = newTitle

    const id = menuState.contentId
    menuState.previousPages = menuState.previousPages.map((page) => {
        if (page.contentId === id && page.customPageTitle === oldTitle) {
            return { ...page, customPageTitle: newTitle }
        }
        return page
    })
}

const fullscreenPages: Pages[] = ["song_live", "song_draw"]
export function isFullscreenPage(page: Pages): boolean {
    return fullscreenPages.includes(page)
}
export function setActivePage(menu: Pages, contentId?: string | null, customTitle?: string | null, action: "add" | "replace" | "append" = "add", appendData: any = null): void {
    const currentState = getCurrentState()

    const addToHistory = menu !== "home" && menuState.previousPages.at(-1)?.activePage !== menu // && (!contentId || menuState.previousPages.at(-1)?.contentId !== contentId)

    function doSet() {
        listEditingState.isEditing = false

        menuState.activePage = menu
        menuState.contentId = contentId ?? null
        menuState.customPageTitle = customTitle ?? null

        if (action !== "replace" && addToHistory) menuState.previousPages.push(currentState)
        if (action === "append") menuState.previousPages.push(clone(appendData))
    }

    if (typeof document !== "undefined" && (document as any).startViewTransition) {
        document.documentElement.dataset.vtDirection = isFullscreenPage(menu) ? "enter_fullscreen" : "forward"
        ;(document as any).startViewTransition(doSet)
    } else {
        doSet()
    }
}

export function goBack(): void {
    if (menuState.previousPages.length === 0) return

    const previousState = menuState.previousPages.pop()!

    function doSet() {
        menuState.activePage = previousState.activePage
        menuState.contentId = previousState.contentId
        menuState.customPageTitle = previousState.customPageTitle
    }

    if (typeof document !== "undefined" && (document as any).startViewTransition) {
        document.documentElement.dataset.vtDirection = isFullscreenPage(menuState.activePage) ? "exit_fullscreen" : "back"
        ;(document as any).startViewTransition(doSet)
    } else {
        doSet()
    }
}

/// POPUPS ///

type Popups = keyof typeof popups
export const popupState = $state<{ popupId: Popups | null }>({ popupId: null })
export function setActivePopup(popup: Popups | null): void {
    popupState.popupId = popup
}

// restore page position when returning from draw
export const savedFullscreenPosition = $state<{ index: number | null; pageIndex: number | null }>({ index: null, pageIndex: null })

/// HELPERS ///

/**
 * Returns the currently active song and list item context based on menu and scroll position.
 */
export function getCurrentSong() {
    if (menuState.activePage !== "song" && menuState.activePage !== "song_live") return null
    const listId = menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null
    const list = listId ? storage.getListById(listId, storage.lists) : null
    const currentSongIndex = savedFullscreenPosition.index ?? 0

    let songId = menuState.contentId
    let listItem = undefined
    if (list && list.songs.length > 0) {
        listItem = list.songs[currentSongIndex] ?? list.songs[0]
        songId = listItem?.songId
    }
    const song = storage.getSongById(songId, storage.songs)
    return { song, listItem, list, currentSongIndex }
}
