<script lang="ts">
    import "@material/web/dialog/dialog.js"
    import "@material/web/progress/circular-progress.js"
    import "@material/web/progress/linear-progress.js"

    let {
        open = false,
        title = "Processing...",
        icon = "sync",
        message = "",
        detail = "",
        progress = 0,
        indeterminate = true
    } = $props<{
        open?: boolean
        title?: string
        icon?: string
        message?: string
        detail?: string
        progress?: number
        indeterminate?: boolean
    }>()
</script>

{#if open}
    <md-dialog open style="--md-dialog-container-max-width: 360px;">
        <div slot="headline">
            <div class="dialog-header">
                <span class="material-symbols-outlined headline-icon">{icon}</span>
                <span>{title}</span>
            </div>
        </div>

        <div slot="content" class="dialog-content">
            <div class="spinner-container">
                {#if indeterminate}
                    <md-circular-progress indeterminate style="--md-circular-progress-size: 56px;"></md-circular-progress>
                {:else}
                    <md-circular-progress value={progress} style="--md-circular-progress-size: 56px;"></md-circular-progress>
                {/if}
            </div>

            <div class="progress-details">
                {#if detail}
                    <div class="detail-text">{detail}</div>
                {/if}
                {#if message}
                    <div class="message-text">{message}</div>
                {/if}
            </div>

            {#if !indeterminate}
                <div class="linear-bar">
                    <md-linear-progress value={progress}></md-linear-progress>
                </div>
            {/if}
        </div>
    </md-dialog>
{/if}

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #2b2930;
        font-size: 1.35rem;
    }

    .headline-icon {
        color: #6750a4;
    }

    .dialog-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 16px 0;
        gap: 16px;
        text-align: center;
    }

    .spinner-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
    }

    .progress-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
    }

    .detail-text {
        font-weight: 600;
        font-size: 0.95rem;
        color: #1d1b20;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin: 0 auto;
    }

    .message-text {
        font-size: 0.875rem;
        color: #49454f;
    }

    .linear-bar {
        width: 100%;
        margin-top: 4px;
    }
</style>
