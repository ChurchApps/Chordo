<script lang="ts">
    import { useRegisterSW } from "virtual:pwa-register/svelte"
    import { t } from "$lib/state/i18n.svelte"

    const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({
        onRegistered(r) {
            console.log("Service Worker registered:", r)
        },
        onRegisterError(error) {
            console.error("Service Worker registration error:", error)
        }
    })

    function close() {
        offlineReady.set(false)
        needRefresh.set(false)
    }
</script>

{#if $offlineReady || $needRefresh}
    <div class="pwa-toast" role="alert">
        <div class="message">
            {#if $offlineReady}
                <span>{t("pwa", "offline_ready")}</span>
            {:else}
                <span>{t("pwa", "update_available")}</span>
            {/if}
        </div>
        <div class="actions">
            {#if $needRefresh}
                <button class="reload-btn" onclick={() => updateServiceWorker(true)}>
                    {t("pwa", "reload")}
                </button>
            {/if}
            <button class="close-btn" onclick={close}>
                {t("pwa", "dismiss")}
            </button>
        </div>
    </div>
{/if}

<style>
    .pwa-toast {
        position: fixed;
        right: 16px;
        bottom: 16px;
        margin: 16px;
        padding: 12px 18px;
        border-radius: 12px;
        z-index: 9999;
        text-align: left;
        box-shadow: 0 4px 16px rgba(74, 34, 0, 0.2);
        background-color: var(--md-sys-color-primary-container, #fff0e2);
        color: var(--md-sys-color-on-primary-container, #2e1500);
        display: flex;
        align-items: center;
        gap: 16px;
        font-family: inherit;
        font-size: 14px;
        animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .message {
        font-weight: 500;
    }

    .actions {
        display: flex;
        gap: 8px;
    }

    .reload-btn {
        background-color: var(--md-sys-color-primary, #f5aa67);
        color: var(--md-sys-color-on-primary, #4a2200);
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
    }

    .close-btn {
        background: transparent;
        border: 1px solid rgba(74, 34, 0, 0.2);
        color: inherit;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
    }
</style>
