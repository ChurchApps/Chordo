export type ToastType = "info" | "success" | "error"

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

export function showToast(text: string, type: ToastType = "info", duration = 3000): void {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: ToastMessage = { id, text, type, duration }

    toastState.toasts = [...toastState.toasts, toast]

    setTimeout(() => {
        removeToast(id)
    }, duration)
}

export function removeToast(id: string): void {
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id)
}
