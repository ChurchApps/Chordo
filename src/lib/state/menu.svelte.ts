import type { pages } from "$components/pages/pages"
import type { popups } from "$components/popups/popups"
import storage from "$lib/storage/StorageManager.svelte"
import { getPlanAsList, getExternalSong } from "$lib/integrations/integrationState.svelte"
import { clone } from "$lib/utils/common"
import { closeConfirm, confirmState } from "./confirm.svelte"
import { closeSearch, searchState } from "./search.svelte"

/// PAGES ///

type Pages = keyof typeof pages

type MenuState = {
    activePage: Pages
    contentId: string | null
    customPageTitle: string | null
}

export const listEditingState = $state<{
    isEditing: boolean
    selectedIndex?: number
    onDeleteSelected?: () => void
    onEditSelected?: () => void
    onDuplicateSelected?: () => void
    editActionType?: "rename" | "edit"
    onMoveSelected?: () => void
    onCancelSelection?: () => boolean
}>({ isEditing: false })

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

const fullscreenPages: Pages[] = ["song_live"]
export function isFullscreenPage(page: Pages): boolean {
    return fullscreenPages.includes(page)
}

const isBrowser = typeof window !== "undefined"

export function setActivePage(menu: Pages, contentId?: string | null, customTitle?: string | null, action: "add" | "replace" | "append" = "add", appendData: any = null): void {
    const currentState = getCurrentState()

    const lastPage = menuState.previousPages[menuState.previousPages.length - 1]
    const addToHistory = menu !== "home" && lastPage?.activePage !== menu

    function doSet() {
        listEditingState.isEditing = false
        searchState.isOpen = false
        searchState.query = ""

        menuState.activePage = menu
        menuState.contentId = contentId ?? null
        menuState.customPageTitle = customTitle ?? null

        if (menu === "home") {
            menuState.previousPages = []
            if (isBrowser) history.replaceState({ type: "page", activePage: "home", contentId: null, customPageTitle: null }, "", "/")
        } else if (currentState.activePage === "share_preview") {
            if (menuState.previousPages.length === 0) {
                menuState.previousPages = [{ activePage: "home", contentId: null, customPageTitle: null }]
            }
            if (isBrowser) {
                history.replaceState({ type: "page", activePage: "home", contentId: null, customPageTitle: null }, "", "/")
                history.pushState({ type: "page", activePage: menu, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "", "/")
            }
        } else if (action !== "replace" && addToHistory) {
            menuState.previousPages.push(currentState)
            if (isBrowser) {
                if (action === "append" && appendData) {
                    history.pushState({ type: "page", activePage: appendData.activePage, contentId: appendData.contentId ?? null, customPageTitle: appendData.customPageTitle ?? null }, "", window.location.href)
                }
                history.pushState({ type: "page", activePage: menu, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "", window.location.href)
            }
        } else if (action === "replace") {
            if (isBrowser) {
                history.replaceState({ type: "page", activePage: menu, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "", window.location.href)
            }
        }
        if (action === "append" && appendData) menuState.previousPages.push(clone(appendData))
    }

    if (isBrowser && (document as any).startViewTransition && !isFullscreenPage(menu) && !isFullscreenPage(currentState.activePage)) {
        document.documentElement.dataset.vtDirection = "forward"
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

        if (previousState.activePage === "home") {
            menuState.previousPages = []
            if (isBrowser) history.replaceState({ type: "page", activePage: "home", contentId: null, customPageTitle: null }, "", "/")
        }
    }

    if (isBrowser && (document as any).startViewTransition && !isFullscreenPage(menuState.activePage) && !isFullscreenPage(previousState.activePage)) {
        document.documentElement.dataset.vtDirection = "back"
        ;(document as any).startViewTransition(doSet)
    } else {
        doSet()
    }
}

/**
 * Dismisses the topmost overlay (confirm, popup, search, selection, or edit mode).
 * Returns true if an overlay was dismissed, false otherwise.
 */
export function dismissActiveOverlay(): boolean {
    if (confirmState.isOpen) {
        closeConfirm()
        return true
    }

    if (popupState.popupId !== null) {
        setActivePopup(null)
        return true
    }

    if (searchState.isOpen) {
        closeSearch()
        return true
    }

    if (listEditingState.onCancelSelection?.()) {
        return true
    }

    if (listEditingState.isEditing) {
        listEditingState.isEditing = false
        return true
    }

    return false
}

export function goBack(forcePage = false): void {
    if (!forcePage && dismissActiveOverlay()) return

    if (forcePage) dismissActiveOverlay()

    if (menuState.previousPages.length > 0) {
        internalGoBack()
        if (isBrowser) {
            isInternalHistoryNavigating = true
            history.back()
        }
    }
}

/// POPUPS ///

type Popups = keyof typeof popups
export const popupState = $state<{ popupId: Popups | null; targetId?: string | null }>({ popupId: null, targetId: null })
export function setActivePopup(popup: Popups | null, targetId?: string | null): void {
    popupState.popupId = popup
    popupState.targetId = targetId ?? null
}

// restore page position when returning from draw
export const savedFullscreenPosition = $state<{ index: number | null; pageIndex: number | null }>({ index: null, pageIndex: null })

function getStoredLyricsOnly(): boolean {
    try {
        return typeof sessionStorage !== "undefined" && sessionStorage.getItem("chordo_lyrics_only") === "true"
    } catch {
        return false
    }
}

export const fullscreenState = $state<{ lyricsOnly: boolean }>({ lyricsOnly: getStoredLyricsOnly() })

export function setFullscreenLyricsOnly(lyricsOnly: boolean): void {
    fullscreenState.lyricsOnly = lyricsOnly
    try {
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("chordo_lyrics_only", String(lyricsOnly))
        }
    } catch {
        // Ignore storage write error in private mode
    }
}

/// HELPERS ///

/**
 * Returns the currently active song and list item context based on menu and scroll position.
 */
export function getCurrentSong() {
    if (menuState.activePage !== "song" && menuState.activePage !== "song_live") return null
    const listId = menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null
    const list = listId ? storage.getListById(listId, storage.lists) || getPlanAsList(listId) : null
    const currentSongIndex = savedFullscreenPosition.index ?? 0

    let songId = menuState.contentId
    let listItem = undefined
    if (list && list.songs.length > 0) {
        listItem = list.songs[currentSongIndex] ?? list.songs[0]
        if (listItem?.type === "section") {
            return { song: null, listItem, list, currentSongIndex }
        }
        songId = listItem?.id ?? null
    }
    const song = storage.getSongById(songId, storage.songs) || getExternalSong(songId)
    return { song, listItem, list, currentSongIndex }
}

/// BROWSER / ANDROID BACK BUTTON LISTENER ///

if (isBrowser) {
    // Initialize current history state
    try {
        history.replaceState({ type: "page", activePage: menuState.activePage, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "", window.location.href)
    } catch {
        // Ignore history initialization errors
    }

    window.addEventListener("popstate", () => {
        if (isInternalHistoryNavigating) {
            isInternalHistoryNavigating = false
            return
        }

        // If an overlay was active, browser back consumed a history slot.
        // Re-push the current page state to restore the stack depth.
        if (dismissActiveOverlay()) {
            try {
                history.pushState({ type: "page", activePage: menuState.activePage, contentId: menuState.contentId, customPageTitle: menuState.customPageTitle }, "", window.location.href)
            } catch {
                // Ignore history push errors
            }
            return
        }

        if (menuState.previousPages.length > 0) {
            internalGoBack()
        }
    })

    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape" && !e.defaultPrevented && dismissActiveOverlay()) {
            e.preventDefault()
        }
    })
}
