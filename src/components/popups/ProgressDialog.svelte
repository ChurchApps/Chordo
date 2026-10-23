<script lang="ts">
    import "@material/web/dialog/dialog.js"
    import "@material/web/progress/circular-progress.js"
    import "@material/web/progress/linear-progress.js"
    import BaseDialog from "./BaseDialog.svelte"

    interface Props {
        open?: boolean
        title?: string
        icon?: string
        message?: string
        detail?: string
        progress?: number
        indeterminate?: boolean
    }

    let { open = false, title = "Processing...", icon = "sync", message = "", detail = "", progress = 0, indeterminate = true }: Props = $props()
</script>

{#if open}
    <BaseDialog {open} {title} {icon} maxWidth="min(440px, calc(100vw - 32px))">
        <div class="dialog-content">
            <div class="progress-card">
                <div class="spinner-container">
                    {#if indeterminate}
                        <md-circular-progress indeterminate style="--md-circular-progress-size: 48px;"></md-circular-progress>
                    {:else}
                        <md-circular-progress value={progress} style="--md-circular-progress-size: 48px;"></md-circular-progress>
                    {/if}
                </div>

                <div class="progress-details">
                    {#if message}
                        <div class="message-text">{message}</div>
                    {/if}

                    {#if detail}
                        <div class="detail-container">
                            <span class="material-symbols-outlined detail-icon">link</span>
                            <span class="detail-text" title={detail}>{detail}</span>
                        </div>
                    {/if}
                </div>

                {#if !indeterminate}
                    <div class="linear-bar">
                        <md-linear-progress value={progress}></md-linear-progress>
                        <span class="progress-percentage">{Math.round(progress * 100)}%</span>
                    </div>
                {/if}
            </div>
        </div>
    </BaseDialog>
{/if}

<style>
    .dialog-content {
        display: flex;
        flex-direction: column;
        padding: 4px 0 8px 0;
        width: 100%;
        box-sizing: border-box;
    }

    .progress-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 16px;
        padding: 20px 16px;
        border-radius: 16px;
        background: var(--md-sys-color-surface-container-high, #f7f2fa);
        border: 1px solid var(--md-sys-color-outline-variant, #e7e0ec);
        box-sizing: border-box;
        width: 100%;
    }

    .spinner-container {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .progress-details {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        width: 100%;
    }

    .message-text {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--md-sys-color-on-surface, #1d1b20);
        line-height: 1.4;
    }

    .detail-container {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        padding: 4px 10px;
        background: var(--md-sys-color-surface-container-highest, #e6e0e9);
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 8px;
        box-sizing: border-box;
    }

    .detail-icon {
        font-size: 16px;
        color: var(--md-sys-color-primary, #6750a4);
        flex-shrink: 0;
    }

    .detail-text {
        font-family: inherit;
        font-size: 0.8rem;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        direction: ltr;
        word-break: break-all;
    }

    .linear-bar {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 4px;
    }

    .linear-bar md-linear-progress {
        flex: 1;
    }

    .progress-percentage {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--md-sys-color-primary, #6750a4);
        min-width: 36px;
        text-align: right;
    }
</style>
