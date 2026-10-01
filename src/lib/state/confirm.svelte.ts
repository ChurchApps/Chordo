export type ConfirmConfig = {
    title: string
    message: string
    confirmLabel?: string
    secondaryLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    onConfirm: () => void | Promise<void>
    onSecondary?: () => void | Promise<void>
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
    secondaryLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
}): Promise<boolean | null> {
    return new Promise((resolve) => {
        openConfirm({
            ...config,
            onConfirm: () => resolve(true),
            onSecondary: () => resolve(false),
            onCancel: () => resolve(null)
        })
    })
}

export function closeConfirm() {
    confirmState.isOpen = false
    confirmState.config = null
}
