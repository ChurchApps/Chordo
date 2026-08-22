export type ConfirmConfig = {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    onConfirm: () => void | Promise<void>
    onCancel?: () => void | Promise<void>
}

export const confirmState = $state<{
    isOpen: boolean
    config: ConfirmConfig | null
}>({
    isOpen: false,
    config: null
})

export function openConfirm(config: ConfirmConfig) {
    confirmState.config = config
    confirmState.isOpen = true
}

export function promptConfirm(config: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
}): Promise<boolean> {
    return new Promise((resolve) => {
        openConfirm({
            ...config,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        })
    })
}

export function closeConfirm() {
    confirmState.isOpen = false
    confirmState.config = null
}
