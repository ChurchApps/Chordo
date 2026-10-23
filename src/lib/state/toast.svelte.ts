export type ToastType = "info" | "success" | "error" | "warning"

export type ToastMessage = {
    id: string
    text: string
    type?: ToastType
    duration?: number
}

export const toastState = $state<{
    toasts: ToastMessage[]
}>({
    toasts: []
})

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function showToast(text: string, type: ToastType = "info", duration = 3000): void {
    const existing = toastState.toasts.find((t) => t.text === text && (t.type || "info") === type)
    if (existing) {
        // Reset timeout for existing identical toast so it stays visible without duplicating
        const existingTimer = toastTimers.get(existing.id)
        if (existingTimer) clearTimeout(existingTimer)

        const timer = setTimeout(() => {
            removeToast(existing.id)
        }, duration)
        toastTimers.set(existing.id, timer)
        return
    }

    const id = Math.random().toString(36).substring(2, 9)
    const toast: ToastMessage = { id, text, type, duration }

    toastState.toasts = [...toastState.toasts, toast]

    const timer = setTimeout(() => {
        removeToast(id)
    }, duration)
    toastTimers.set(id, timer)
}

export function removeToast(id: string): void {
    const timer = toastTimers.get(id)
    if (timer) {
        clearTimeout(timer)
        toastTimers.delete(id)
    }
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id)
}
