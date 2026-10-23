/**
 * Utility to keep modals/popups centered when the virtual on-screen keyboard appears.
 */

function getDeepActiveElement(): Element | null {
    let el = document.activeElement
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
        el = el.shadowRoot.activeElement
    }
    return el
}

export function isVirtualKeyboardOpen(): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") return false

    // Check if an input or textarea element is actively focused anywhere in the DOM or Shadow DOM
    const activeEl = getDeepActiveElement() as HTMLElement | null
    const hasFocusableInput =
        !!activeEl &&
        (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.isContentEditable ||
            activeEl.getAttribute?.("contenteditable") === "true" ||
            activeEl.closest?.("md-outlined-text-field") !== null ||
            activeEl.closest?.("md-filled-text-field") !== null ||
            activeEl.closest?.("md-dialog") !== null)

    if (hasFocusableInput) return true

    // Also check if visualViewport height has noticeably compressed relative to window.innerHeight
    const vv = window.visualViewport
    if (vv && window.innerHeight > 0) {
        const heightRatio = vv.height / window.innerHeight
        if (heightRatio < 0.85) return true
    }

    return false
}

function updateSingleDialog(dialogEl: HTMLElement, offset: number, maxHeight: string) {
    const internalDialog = dialogEl.shadowRoot?.querySelector<HTMLDialogElement>("dialog")
    const internalContainer = dialogEl.shadowRoot?.querySelector<HTMLElement>(".container")

    if (internalDialog) {
        internalDialog.style.transition = "translate 0.2s cubic-bezier(0.1, 0.9, 0.2, 1), max-height 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)"
        internalDialog.style.translate = `0 ${offset}px`
        if (maxHeight) {
            internalDialog.style.maxHeight = maxHeight
        } else {
            internalDialog.style.maxHeight = ""
        }
    } else if (internalContainer) {
        internalContainer.style.transition = "translate 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)"
        internalContainer.style.translate = `0 ${offset}px`
    } else if ("updateComplete" in dialogEl) {
        ;(dialogEl as unknown as { updateComplete?: Promise<unknown> }).updateComplete?.then(() => {
            updateSingleDialog(dialogEl, offset, maxHeight)
        })
    }
}

export function updateDialogPositions() {
    if (typeof window === "undefined") return

    const vv = window.visualViewport
    // Calculate difference between visual viewport center and layout viewport center
    const offset = vv ? Math.round(vv.offsetTop + vv.height / 2 - window.innerHeight / 2) : 0
    const maxHeight = vv ? `${Math.max(140, Math.floor(vv.height - 32))}px` : ""

    const dialogs = document.querySelectorAll<HTMLElement>("md-dialog")
    dialogs.forEach((dialogEl) => {
        updateSingleDialog(dialogEl, offset, maxHeight)
    })
}

export function initDialogKeyboardCentering(): () => void {
    if (typeof window === "undefined") return () => {}

    const vv = window.visualViewport

    const onViewportChange = () => {
        updateDialogPositions()
    }

    if (vv) {
        vv.addEventListener("resize", onViewportChange)
        vv.addEventListener("scroll", onViewportChange)
    }
    window.addEventListener("resize", onViewportChange)

    const observer = new MutationObserver(() => {
        updateDialogPositions()
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["open"]
    })

    // Initial positioning check
    updateDialogPositions()

    return () => {
        if (vv) {
            vv.removeEventListener("resize", onViewportChange)
            vv.removeEventListener("scroll", onViewportChange)
        }
        window.removeEventListener("resize", onViewportChange)
        observer.disconnect()
    }
}
