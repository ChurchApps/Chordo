import { listEditingState } from "$lib/state/menu.svelte"

export interface LongPressSelectionOptions<T> {
    onSelect?: (item: T) => void
    disabled?: () => boolean
    duration?: number
}

/**
 * Encapsulates the hold-to-select and context menu selection logic
 * shared across HomePage, FolderPage, ListPage, and AllSongsPage.
 */
export function createHoldToSelect<T>(
    getSelected: () => T[],
    setSelected: (items: T[]) => void,
    options: LongPressSelectionOptions<T> = {}
) {
    let timer: ReturnType<typeof setTimeout> | null = null
    let longPressed = false
    const duration = options.duration ?? 500

    function selectItem(item: T) {
        listEditingState.isEditing = true
        const selected = getSelected()
        if (!selected.includes(item)) {
            setSelected([...selected, item])
        }
        options.onSelect?.(item)
    }

    function startPress(e: PointerEvent, item: T) {
        if (options.disabled?.() || e.button !== 0) return
        longPressed = false
        timer = setTimeout(() => {
            longPressed = true
            selectItem(item)
            if (navigator.vibrate) navigator.vibrate(50)
        }, duration)
    }

    function endPress() {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
    }

    function handleContextMenu(e: MouseEvent, item: T) {
        if (options.disabled?.()) return
        e.preventDefault()
        selectItem(item)
    }

    /**
     * Handles item clicks during edit mode: toggles selection or exits edit mode if none remain.
     * Returns true if handled (in edit mode or consumed by long-press), false if normal click should proceed.
     */
    function handleClick(item: T, autoExitWhenEmpty: boolean = true): boolean {
        if (longPressed) {
            longPressed = false
            return true
        }
        if (listEditingState.isEditing) {
            const selected = getSelected()
            if (selected.includes(item)) {
                const next = selected.filter((i) => i !== item)
                setSelected(next)
                if (autoExitWhenEmpty && next.length === 0) {
                    listEditingState.isEditing = false
                }
            } else {
                setSelected([...selected, item])
            }
            return true
        }
        return false
    }

    return {
        startPress,
        endPress,
        handleContextMenu,
        handleClick,
        get isLongPressed() {
            return longPressed
        },
        clearTimer: endPress
    }
}
