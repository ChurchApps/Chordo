export interface IndexedItem<T> {
    item: T
    originalIdx: number
}

export interface ReorderState {
    draggedIdx: number | null
    draggedIndices: number[]
    dragOverIdx: number | null
}

/**
 * Derives a live preview of the list while dragging, preserving each item's
 * original index to accurately target ghost states across duplicate items.
 */
export function getDisplayList<T>(list: T[], state: ReorderState): IndexedItem<T>[] {
    const indexed = list.map((item, originalIdx) => ({
        item,
        originalIdx
    }))

    const { draggedIdx, draggedIndices, dragOverIdx } = state

    if (draggedIdx === null || dragOverIdx === null || draggedIdx === dragOverIdx) {
        return indexed
    }

    const indicesToMove = draggedIndices.length > 0 && draggedIndices.includes(draggedIdx)
        ? [...draggedIndices].sort((a, b) => a - b)
        : [draggedIdx]

    const remaining = indexed.filter((_, idx) => !indicesToMove.includes(idx))
    const movedItems = indexed.filter((_, idx) => indicesToMove.includes(idx))

    // Calculate target insert index in remaining list
    let insertAt = 0
    for (let i = 0; i < indexed.length; i++) {
        if (i === dragOverIdx) break
        if (!indicesToMove.includes(i)) {
            insertAt++
        }
    }

    const updated = [...remaining]
    updated.splice(insertAt, 0, ...movedItems)
    return updated
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
        onMoveBatch(indices, targetIdx)
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
export function applyBatchMove<T>(list: T[], fromIndices: number[], targetIdx: number): { updatedList: T[]; newSelectedIndices: number[] } {
    if (fromIndices.length === 0) return { updatedList: [...list], newSelectedIndices: [] }
    const sortedFrom = [...fromIndices].sort((a, b) => a - b)
    const result = [...list]

    // Save items to move
    const movedItems = sortedFrom.map((idx) => result[idx]).filter((item): item is T => item !== undefined)

    // Remove items in descending index order
    for (let i = sortedFrom.length - 1; i >= 0; i--) {
        result.splice(sortedFrom[i], 1)
    }

    // Calculate target insertion index after removal
    let insertIndex = targetIdx
    for (const idx of sortedFrom) {
        if (idx < targetIdx) {
            insertIndex--
        }
    }
    if (insertIndex < 0) insertIndex = 0
    if (insertIndex > result.length) insertIndex = result.length

    // Insert moved items into target position
    result.splice(insertIndex, 0, ...movedItems)

    const newSelectedIndices = movedItems.map((_, i) => insertIndex + i)

    return { updatedList: result, newSelectedIndices }
}
