<script lang="ts">
    import { closeConfirm, confirmState } from "$lib/state/confirm.svelte"
    import { t } from "$lib/state/i18n.svelte"

    let isActionTaken = false

    $effect(() => {
        if (confirmState.isOpen) {
            isActionTaken = false
        }
    })

    async function handleConfirm() {
        if (isActionTaken) return
        isActionTaken = true
        const callback = confirmState.config?.onConfirm
        closeConfirm()
        if (callback) {
            await callback()
        }
    }

    async function handleCancel() {
        if (isActionTaken) return
        isActionTaken = true
        const callback = confirmState.config?.onCancel
        closeConfirm()
        if (callback) {
            await callback()
        }
    }
</script>

{#if confirmState.isOpen}
    <md-dialog open onclosed={handleCancel}>
        <div slot="headline">
            {confirmState.config?.title ?? t("common", "confirm")}
        </div>

        <div slot="content">
            {confirmState.config?.message ?? ""}
        </div>

        <div slot="actions">
            <md-text-button role="button" tabindex="0" onclick={handleCancel}>
                {confirmState.config?.cancelLabel ?? t("common", "cancel")}
            </md-text-button>
            <md-filled-button
                role="button"
                tabindex="0"
                class:destructive={confirmState.config?.isDestructive}
                onclick={handleConfirm}
            >
                {confirmState.config?.confirmLabel ?? t("common", "confirm")}
            </md-filled-button>
        </div>
    </md-dialog>
{/if}

<style>
    .destructive {
        --md-filled-button-container-color: var(--md-sys-color-error, #ba1a1a);
        --md-filled-button-label-text-color: #ffffff;
    }
</style>
