export interface IndexedItem<T> {
    item: T
    originalIdx: number
}

export interface ReorderState {
    draggedIdx: number | null
    draggedIndices: number[]
    dragOverIdx: number | null
}

function reorderArray<T>(items: T[], fromIndices: number[], targetIdx: number) {
    const indicesToMove = [...fromIndices].sort((a, b) => a - b)
    const remaining = items.filter((_, idx) => !indicesToMove.includes(idx))
    const moved = items.filter((_, idx) => indicesToMove.includes(idx))

    let insertAt = 0
    for (let i = 0; i < items.length; i++) {
        if (i === targetIdx) break
        if (!indicesToMove.includes(i)) insertAt++
    }

    const result = [...remaining]
    result.splice(insertAt, 0, ...moved)
    return { items: result, insertAt, count: moved.length }
}

/**
 * Derives a live preview of the list while dragging, preserving each item's
 * original index to accurately target ghost states across duplicate items.
 */
export function getDisplayList<T>(list: T[], state: ReorderState): IndexedItem<T>[] {
    const indexed = list.map((item, originalIdx) => ({ item, originalIdx }))
    const { draggedIdx, draggedIndices, dragOverIdx } = state
    if (draggedIdx === null || dragOverIdx === null || draggedIdx === dragOverIdx) {
        return indexed
    }
    const move = draggedIndices.length > 0 && draggedIndices.includes(draggedIdx) ? draggedIndices : [draggedIdx]
    return reorderArray(indexed, move, dragOverIdx).items
}

/**
 * Resets the reorder state back to nulls.
 */
export function resetDragState(state: ReorderState): void {
    state.draggedIdx = null
    state.draggedIndices = []
    state.dragOverIdx = null
}

/**
 * Handles `dragstart` on an item wrapper.
 */
export function handleItemDragStart(e: DragEvent, originalIdx: number, selectedIndices: number[], state: ReorderState): void {
    state.draggedIdx = originalIdx
    state.draggedIndices = selectedIndices.includes(originalIdx) ? [...selectedIndices] : [originalIdx]
    state.dragOverIdx = originalIdx
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", originalIdx.toString())
    }
}

function autoScrollElement(el: HTMLElement | null, clientY: number): void {
    if (!el) return
    const scrollParent = (el.closest(".scroll-list") || el) as HTMLElement
    if (!scrollParent || scrollParent.scrollHeight <= scrollParent.clientHeight) return
    const rect = scrollParent.getBoundingClientRect()
    const edge = 50
    if (clientY < rect.top + edge) {
        scrollParent.scrollTop -= 8
    } else if (clientY > rect.bottom - edge) {
        scrollParent.scrollTop += 8
    }
}

/**
 * Handles `dragover` when hovering over a specific item target.
 */
export function handleItemDragOver(e: DragEvent, currentVisualIdx: number, state: ReorderState): void {
    e.preventDefault()
    e.stopPropagation()
    if (state.draggedIdx !== null && state.dragOverIdx !== currentVisualIdx) {
        state.dragOverIdx = currentVisualIdx
    }
    autoScrollElement(e.currentTarget as HTMLElement, e.clientY)
}

/**
 * Handles `drop` on a specific item target.
 */
export function handleItemDrop(
    e: DragEvent,
    targetIdx: number,
    state: ReorderState,
    onMoveBatch: (fromIndices: number[], targetIdx: number) => void
): void {
    e.preventDefault()
    e.stopPropagation()
    if (state.draggedIdx !== null) {
        const indices = state.draggedIndices.length > 0 ? state.draggedIndices : [state.draggedIdx]
        const target = state.dragOverIdx !== null ? state.dragOverIdx : targetIdx
        onMoveBatch(indices, target)
    }
    resetDragState(state)
}

/**
 * Handles `dragover` on the outer container (moves drag preview to bottom).
 */
export function handleContainerDragOver(e: DragEvent, totalItemsCount: number, state: ReorderState): void {
    e.preventDefault()
    if (state.draggedIdx !== null && state.dragOverIdx !== totalItemsCount) {
        state.dragOverIdx = totalItemsCount
    }
    autoScrollElement(e.currentTarget as HTMLElement, e.clientY)
}

/**
 * Handles `drop` on the empty container area (moves item to the end).
 */
export function handleContainerDrop(
    e: DragEvent,
    totalItemsCount: number,
    state: ReorderState,
    onMoveBatch: (fromIndices: number[], targetIdx: number) => void
): void {
    e.preventDefault()
    if (state.draggedIdx !== null) {
        const indices = state.draggedIndices.length > 0 ? state.draggedIndices : [state.draggedIdx]
        onMoveBatch(indices, totalItemsCount)
    }
    resetDragState(state)
}

/**
 * Applies a batch move of multiple item indices to a target position in an array.
 * Returns a new array with the items moved, along with updated selected indices.
 */
export function applyBatchMove<T>(list: T[], fromIndices: number[], dragOverIdx: number): { updatedList: T[]; newSelectedIndices: number[] } {
    if (fromIndices.length === 0) return { updatedList: [...list], newSelectedIndices: [] }
    const { items, insertAt, count } = reorderArray(list, fromIndices, dragOverIdx)
    return {
        updatedList: items,
        newSelectedIndices: Array.from({ length: count }, (_, i) => insertAt + i)
    }
}

/**
 * Handles touch and pointer-based drag reordering for mobile and pointer devices.
 */
export function handlePointerDragStart(
    e: PointerEvent,
    originalIdx: number,
    selectedIndices: number[],
    state: ReorderState,
    onMoveBatch: (fromIndices: number[], targetIdx: number) => void,
    onDragEnd?: () => void,
    itemSelector: string = "[data-reorder-idx]"
): void {
    if (e.button !== 0) return
    e.stopPropagation()
    if (e.cancelable) {
        e.preventDefault()
    }

    state.draggedIdx = originalIdx
    state.draggedIndices = selectedIndices.includes(originalIdx) ? [...selectedIndices] : [originalIdx]
    state.dragOverIdx = originalIdx

    let scrollParent: HTMLElement | null = null
    const target = e.currentTarget as HTMLElement | null
    if (target) {
        scrollParent = target.closest(".scroll-list")
    }

    let scrollRaf: number | null = null
    let latestClientX = e.clientX
    let latestClientY = e.clientY

    const updateDragOver = (clientX: number, clientY: number) => {
        const el = document.elementFromPoint(clientX, clientY)
        if (!el) return
        const targetWrapper = el.closest(itemSelector)
        if (targetWrapper) {
            const rawIdx = targetWrapper.getAttribute(itemSelector.replace(/[\[\]]/g, ""))
            if (rawIdx !== null) {
                const targetVisualIdx = parseInt(rawIdx, 10)
                if (!isNaN(targetVisualIdx) && state.dragOverIdx !== targetVisualIdx) {
                    state.dragOverIdx = targetVisualIdx
                }
            }
        } else if (el.closest(".add-section-area")) {
            const allItems = document.querySelectorAll(itemSelector)
            state.dragOverIdx = allItems.length
        } else if (scrollParent) {
            const rect = scrollParent.getBoundingClientRect()
            if (clientX >= rect.left && clientX <= rect.right) {
                if (clientY <= rect.top + 30) {
                    state.dragOverIdx = 0
                } else if (clientY >= rect.bottom - 30 || clientY > rect.bottom) {
                    const allItems = scrollParent.querySelectorAll(itemSelector)
                    state.dragOverIdx = allItems.length
                }
            }
        }
    }

    const checkAutoScroll = () => {
        if (state.draggedIdx === null) return
        if (scrollParent) {
            const rect = scrollParent.getBoundingClientRect()
            const edge = 60
            if (latestClientY < rect.top + edge) {
                const speed = Math.max(2, Math.min(14, ((rect.top + edge) - latestClientY) / 3))
                scrollParent.scrollTop -= speed
                updateDragOver(latestClientX, latestClientY)
            } else if (latestClientY > rect.bottom - edge) {
                const speed = Math.max(2, Math.min(14, (latestClientY - (rect.bottom - edge)) / 3))
                scrollParent.scrollTop += speed
                updateDragOver(latestClientX, latestClientY)
            }
        } else {
            const edge = 60
            if (latestClientY < edge) {
                window.scrollBy(0, -8)
                updateDragOver(latestClientX, latestClientY)
            } else if (latestClientY > window.innerHeight - edge) {
                window.scrollBy(0, 8)
                updateDragOver(latestClientX, latestClientY)
            }
        }
        scrollRaf = requestAnimationFrame(checkAutoScroll)
    }
    scrollRaf = requestAnimationFrame(checkAutoScroll)

    const onPointerMove = (moveEvent: PointerEvent) => {
        latestClientX = moveEvent.clientX
        latestClientY = moveEvent.clientY
        updateDragOver(moveEvent.clientX, moveEvent.clientY)
    }

    const cleanup = () => {
        if (scrollRaf !== null) {
            cancelAnimationFrame(scrollRaf)
            scrollRaf = null
        }
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
        window.removeEventListener("pointercancel", onPointerCancel)
    }

    const onPointerCancel = () => {
        cleanup()
        resetDragState(state)
        if (onDragEnd) {
            onDragEnd()
        }
    }

    const onPointerUp = () => {
        cleanup()

        if (state.draggedIdx !== null) {
            const indices = state.draggedIndices.length > 0 ? state.draggedIndices : [state.draggedIdx]
            const target = state.dragOverIdx !== null ? state.dragOverIdx : originalIdx
            if (state.dragOverIdx !== null && state.dragOverIdx !== state.draggedIdx) {
                onMoveBatch(indices, target)
            }
        }
        resetDragState(state)
        if (onDragEnd) {
            onDragEnd()
        }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerCancel)
}

