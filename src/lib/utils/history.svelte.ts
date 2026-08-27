export interface HistoryOptions<T> {
    /** Maximum number of undo states to keep. Defaults to 50. */
    maxDepth?: number
    /** Debounce interval in ms for continuous changes (e.g. typing). Defaults to 400. */
    debounceMs?: number
    /** Optional custom equality comparator. Defaults to strict equality (===). */
    isEqual?: (a: T, b: T) => boolean
    /** Callback triggered whenever undo or redo updates the value. */
    onApply?: (value: T) => void
}

/**
 * Universal reactive History Manager powered by Svelte 5 Runes.
 * Supports undo, redo, debounced typing snapshots, discrete commits,
 * max depth limits, and standard keyboard shortcut interception.
 */
export class HistoryManager<T> {
    private undoStack = $state<T[]>([])
    private redoStack = $state<T[]>([])
    private currentValue = $state<T>()
    private lastCommittedValue = $state<T>()
    private debounceTimer: ReturnType<typeof setTimeout> | null = null

    private maxDepth: number
    private debounceMs: number
    private isEqual: (a: T, b: T) => boolean
    private onApply?: (value: T) => void

    constructor(initialValue: T, options: HistoryOptions<T> = {}) {
        this.maxDepth = options.maxDepth ?? 50
        this.debounceMs = options.debounceMs ?? 400
        this.isEqual = options.isEqual ?? ((a, b) => a === b)
        this.onApply = options.onApply

        this.currentValue = initialValue
        this.lastCommittedValue = initialValue
    }

    /** The current value in history */
    get value(): T {
        return this.currentValue as T
    }

    /** Whether an undo action is available */
    get canUndo(): boolean {
        return this.undoStack.length > 0
    }

    /** Whether a redo action is available */
    get canRedo(): boolean {
        return this.redoStack.length > 0
    }

    /** Total number of items in undo stack */
    get undoCount(): number {
        return this.undoStack.length
    }

    /** Total number of items in redo stack */
    get redoCount(): number {
        return this.redoStack.length
    }

    /**
     * Clear any pending debounce timer and immediately commit current value to history.
     */
    private flushDebounce() {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }
    }

    /**
     * Commit a snapshot to undo stack if different from last committed.
     */
    private commitSnapshot(snapshot: T) {
        if (this.lastCommittedValue !== undefined && this.isEqual(snapshot, this.lastCommittedValue)) {
            return
        }

        const newStack = [...this.undoStack, this.lastCommittedValue as T]
        if (newStack.length > this.maxDepth) {
            newStack.splice(0, newStack.length - this.maxDepth)
        }
        this.undoStack = newStack
        this.redoStack = []
        this.lastCommittedValue = snapshot
    }

    /**
     * Record a new value.
     * @param newValue The new value.
     * @param immediate If true, commits immediately without debouncing. If false (default), debounces commit.
     */
    set(newValue: T, immediate = false) {
        this.currentValue = newValue

        if (immediate || this.debounceMs <= 0) {
            this.flushDebounce()
            this.commitSnapshot(newValue)
        } else {
            if (this.debounceTimer !== null) {
                clearTimeout(this.debounceTimer)
            }
            this.debounceTimer = setTimeout(() => {
                this.commitSnapshot(newValue)
                this.debounceTimer = null
            }, this.debounceMs)
        }
    }

    /**
     * Explicitly push a discrete snapshot (e.g. reordering sections, applying preset).
     */
    push(newValue: T) {
        this.set(newValue, true)
    }

    /**
     * Undo to the previous snapshot.
     */
    undo(): T | undefined {
        this.flushDebounce()
        if (this.undoStack.length === 0) return undefined

        const previousValue = this.undoStack[this.undoStack.length - 1]
        this.undoStack = this.undoStack.slice(0, -1)

        if (this.currentValue !== undefined) {
            this.redoStack = [...this.redoStack, this.currentValue]
        }

        this.currentValue = previousValue
        this.lastCommittedValue = previousValue

        if (this.onApply) {
            this.onApply(previousValue)
        }

        return previousValue
    }

    /**
     * Redo to the next undone snapshot.
     */
    redo(): T | undefined {
        this.flushDebounce()
        if (this.redoStack.length === 0) return undefined

        const nextValue = this.redoStack[this.redoStack.length - 1]
        this.redoStack = this.redoStack.slice(0, -1)

        if (this.currentValue !== undefined) {
            this.undoStack = [...this.undoStack, this.currentValue]
        }

        this.currentValue = nextValue
        this.lastCommittedValue = nextValue

        if (this.onApply) {
            this.onApply(nextValue)
        }

        return nextValue
    }

    /**
     * Reset history with a new base value.
     */
    reset(initialValue: T) {
        this.flushDebounce()
        this.undoStack = []
        this.redoStack = []
        this.currentValue = initialValue
        this.lastCommittedValue = initialValue
    }

    /**
     * Helper to handle keyboard shortcuts for undo / redo.
     * Supports Ctrl+Z, Cmd+Z, Ctrl+Y, Ctrl+Shift+Z, Cmd+Shift+Z.
     * Returns true if a shortcut was intercepted.
     */
    handleKeyDown = (e: KeyboardEvent): boolean => {
        const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
        const isModifier = isMac ? e.metaKey : e.ctrlKey

        if (isModifier && !e.altKey) {
            if (e.key === "z" && !e.shiftKey) {
                if (this.canUndo) {
                    e.preventDefault()
                    this.undo()
                    return true
                }
            } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
                if (this.canRedo) {
                    e.preventDefault()
                    this.redo()
                    return true
                }
            }
        }
        return false
    }

    /**
     * Destroy any active timers.
     */
    destroy() {
        this.flushDebounce()
    }
}

/**
 * Factory helper for creating a HistoryManager instance.
 */
export function createHistory<T>(initialValue: T, options?: HistoryOptions<T>): HistoryManager<T> {
    return new HistoryManager(initialValue, options)
}
