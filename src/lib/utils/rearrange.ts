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

/**
 * Handles `dragover` when hovering over a specific item target.
 */
export function handleItemDragOver(e: DragEvent, currentVisualIdx: number, state: ReorderState): void {
    e.preventDefault()
    e.stopPropagation()
    if (state.draggedIdx !== null && state.dragOverIdx !== currentVisualIdx) {
        state.dragOverIdx = currentVisualIdx
    }
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
    itemSelector: string = "[data-reorder-idx]"
): void {
    if (e.button !== 0 && e.pointerType === "mouse") return
    e.stopPropagation()

    state.draggedIdx = originalIdx
    state.draggedIndices = selectedIndices.includes(originalIdx) ? [...selectedIndices] : [originalIdx]
    state.dragOverIdx = originalIdx

    let scrollParent: HTMLElement | null = null
    const target = e.currentTarget as HTMLElement | null
    if (target) {
        scrollParent = target.closest(".scroll-list")
    }

    let scrollRaf: number | null = null
    let latestClientY = e.clientY

    const checkAutoScroll = () => {
        if (state.draggedIdx === null) return
        if (scrollParent) {
            const rect = scrollParent.getBoundingClientRect()
            const edge = 50
            if (latestClientY < rect.top + edge) {
                scrollParent.scrollTop -= 8
            } else if (latestClientY > rect.bottom - edge) {
                scrollParent.scrollTop += 8
            }
        } else {
            const edge = 50
            if (latestClientY < edge) {
                window.scrollBy(0, -8)
            } else if (latestClientY > window.innerHeight - edge) {
                window.scrollBy(0, 8)
            }
        }
        scrollRaf = requestAnimationFrame(checkAutoScroll)
    }
    scrollRaf = requestAnimationFrame(checkAutoScroll)

    const onPointerMove = (moveEvent: PointerEvent) => {
        latestClientY = moveEvent.clientY
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
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
        }
    }

    const onPointerUp = () => {
        if (scrollRaf !== null) {
            cancelAnimationFrame(scrollRaf)
            scrollRaf = null
        }
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
        window.removeEventListener("pointercancel", onPointerUp)

        if (state.draggedIdx !== null) {
            const indices = state.draggedIndices.length > 0 ? state.draggedIndices : [state.draggedIdx]
            const target = state.dragOverIdx !== null ? state.dragOverIdx : originalIdx
            if (state.dragOverIdx !== null && state.dragOverIdx !== state.draggedIdx) {
                onMoveBatch(indices, target)
            }
        }
        resetDragState(state)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
}

