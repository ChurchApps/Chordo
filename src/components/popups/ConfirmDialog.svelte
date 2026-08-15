<script lang="ts">
    import { closeConfirm, confirmState } from "$lib/state/confirm.svelte"
    import { t } from "$lib/state/i18n.svelte"

    async function handleConfirm() {
        if (confirmState.config?.onConfirm) {
            await confirmState.config.onConfirm()
        }
        closeConfirm()
    }
</script>

{#if confirmState.isOpen}
    <md-dialog open onclosed={closeConfirm}>
        <div slot="headline">
            {confirmState.config?.title ?? t("common", "confirm")}
        </div>

        <div slot="content">
            {confirmState.config?.message ?? ""}
        </div>

        <div slot="actions">
            <md-text-button role="button" tabindex="0" onclick={closeConfirm}>
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
