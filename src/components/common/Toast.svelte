<script lang="ts">
    import { removeToast, toastState } from "$lib/state/toast.svelte"
</script>

{#if toastState.toasts.length > 0}
    <div class="toast-container" role="status" aria-live="polite">
        {#each toastState.toasts as toast (toast.id)}
            <div class="toast-item {toast.type || 'info'}">
                <span class="material-symbols-outlined icon">
                    {#if toast.type === "success"}
                        check_circle
                    {:else if toast.type === "error"}
                        error
                    {:else}
                        info
                    {/if}
                </span>
                <span class="toast-text">{toast.text}</span>
                <button class="toast-close" onclick={() => removeToast(toast.id)} aria-label="Dismiss">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
        {/each}
    </div>
{/if}

<style>
    .toast-container {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 90vw;
        width: max-content;
    }

    .toast-item {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        border-radius: 28px;
        background-color: var(--md-sys-color-inverse-surface, #2f3033);
        color: var(--md-sys-color-inverse-on-surface, #f1f0f4);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        font-size: 0.95rem;
        font-weight: 500;
        animation: toastIn 0.25s cubic-bezier(0.1, 0.9, 0.2, 1);
    }

    .toast-item.success .icon {
        color: #4caf50;
    }

    .toast-item.error .icon {
        color: #f44336;
    }

    .toast-item.info .icon {
        color: var(--md-sys-color-primary, #f5aa67);
    }

    .icon {
        font-size: 20px;
    }

    /* .toast-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    } */

    .toast-close {
        background: transparent;
        border: none;
        color: inherit;
        opacity: 0.7;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .toast-close:hover {
        opacity: 1;
    }

    .toast-close .material-symbols-outlined {
        font-size: 18px;
    }

    @keyframes toastIn {
        from {
            transform: translateY(16px) scale(0.95);
            opacity: 0;
        }
        to {
            transform: translateY(0) scale(1);
            opacity: 1;
        }
    }
</style>
