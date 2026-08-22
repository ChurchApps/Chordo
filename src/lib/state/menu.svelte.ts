import type { pages } from "$components/pages/pages"
import type { popups } from "$components/popups/popups"
import storage from "$lib/storage/StorageManager.svelte"
import { clone } from "$lib/utils/common"
import { closeSearch, searchState } from "./search.svelte"

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

    const addToHistory = menu !== "home" && menuState.previousPages.at(-1)?.activePage !== menu

    function doSet() {
        listEditingState.isEditing = false
        searchState.isOpen = false
        searchState.query = ""

        menuState.activePage = menu
        menuState.contentId = contentId ?? null
        menuState.customPageTitle = customTitle ?? null

        if (currentState.activePage === "share_preview") {
            if (menuState.previousPages.length === 0) {
                menuState.previousPages = [{ activePage: "home", contentId: null, customPageTitle: null }]
            }
            if (typeof window !== "undefined") {
                history.replaceState({ type: "page", activePage: "home", contentId: null, customPageTitle: null }, "")
                if (menu !== "home") {
                    history.pushState({ type: "page", activePage: menu, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "")
                }
            }
        } else if (action !== "replace" && addToHistory) {
            menuState.previousPages.push(currentState)
            if (typeof window !== "undefined") {
                if (action === "append" && appendData) {
                    history.pushState({ type: "page", activePage: appendData.activePage, contentId: appendData.contentId ?? null, customPageTitle: appendData.customPageTitle ?? null }, "")
                }
                history.pushState({ type: "page", activePage: menu, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "")
            }
        } else if (action === "replace") {
            if (typeof window !== "undefined") {
                history.replaceState({ type: "page", activePage: menu, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "")
            }
        }
        if (action === "append" && appendData) menuState.previousPages.push(clone(appendData))
    }

    if (typeof document !== "undefined" && (document as any).startViewTransition) {
        document.documentElement.dataset.vtDirection = isFullscreenPage(menu) ? "enter_fullscreen" : "forward"
        ;(document as any).startViewTransition(doSet)
    } else {
        doSet()
    }
}

let isInternalHistoryNavigating = false

export function internalGoBack(): void {
    if (menuState.previousPages.length === 0) return

    const previousState = menuState.previousPages.pop()!

    function doSet() {
        searchState.isOpen = false
        searchState.query = ""
        listEditingState.isEditing = false
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

export function goBack(): void {
    if (popupState.popupId !== null) {
        setActivePopup(null)
        return
    }

    if (searchState.isOpen) {
        closeSearch()
        return
    }

    if (listEditingState.isEditing) {
        listEditingState.isEditing = false
        return
    }

    if (menuState.previousPages.length > 0) {
        internalGoBack()
        if (typeof window !== "undefined") {
            isInternalHistoryNavigating = true
            history.back()
        }
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

const initialLyricsOnly = typeof sessionStorage !== "undefined" && sessionStorage.getItem("chordo_lyrics_only") === "true"
export const fullscreenState = $state<{ lyricsOnly: boolean }>({ lyricsOnly: initialLyricsOnly })

export function setFullscreenLyricsOnly(lyricsOnly: boolean): void {
    fullscreenState.lyricsOnly = lyricsOnly
    if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("chordo_lyrics_only", String(lyricsOnly))
    }
}

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

/// BROWSER / ANDROID BACK BUTTON LISTENER ///

if (typeof window !== "undefined") {
    // Initialize current history state
    history.replaceState({ type: "page", activePage: menuState.activePage, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "")

    window.addEventListener("popstate", () => {
        if (isInternalHistoryNavigating) {
            isInternalHistoryNavigating = false
            return
        }

        // 1. If popup is open, close it
        if (popupState.popupId !== null) {
            popupState.popupId = null
            return
        }

        // 2. If search is open, close it
        if (searchState.isOpen) {
            searchState.isOpen = false
            searchState.query = ""
            return
        }

        // 3. If list editing is active, exit editing mode
        if (listEditingState.isEditing) {
            listEditingState.isEditing = false
            return
        }

        // 4. If there are previous pages, navigate back
        if (menuState.previousPages.length > 0) {
            internalGoBack()
        }
    })
}
