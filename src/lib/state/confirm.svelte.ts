export type ConfirmConfig = {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    onConfirm: () => void | Promise<void>
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

export function closeConfirm() {
    confirmState.isOpen = false
    confirmState.config = null
}
