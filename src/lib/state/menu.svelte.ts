import { tick } from "svelte"
import type { pages } from "../../components/pages/pages"
import type { popups } from "../../components/popups/popups"
import { clone } from "../utils/common"

/// PAGES ///

type Pages = keyof typeof pages

type MenuState = {
    activePage: Pages
    contentId: string | null
    customPageTitle: string | null
}

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
    menuState.customPageTitle = newTitle

    const id = menuState.contentId
    menuState.previousPages = menuState.previousPages.map((page) => {
        if (page.contentId === id) {
            return { ...page, customPageTitle: newTitle }
        }
        return page
    })
}

export function setActivePage(menu: Pages, contentId?: string | null, customTitle?: string | null): void {
    const currentState = getCurrentState()

    const addToHistory = menu !== "home" && menuState.previousPages.at(-1)?.activePage !== menu // && (!contentId || menuState.previousPages.at(-1)?.contentId !== contentId)

    function doSet() {
        menuState.activePage = menu
        menuState.contentId = contentId ?? null
        menuState.customPageTitle = customTitle ?? null

        if (addToHistory) menuState.previousPages.push(currentState)
    }

    if (typeof document !== "undefined" && (document as any).startViewTransition) {
        document.documentElement.dataset.vtDirection = menu === "song_live" ? "enter_fullscreen" : "forward"
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
        document.documentElement.dataset.vtDirection = menuState.activePage === "song_live" ? "exit_fullscreen" : "back"
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
