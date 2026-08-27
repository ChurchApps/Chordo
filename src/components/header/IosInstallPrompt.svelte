<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { dismissIosPrompt, isIosPromptDismissed, isIosSafariNonStandalone } from "$lib/utils/iosPwa"
    import { onMount } from "svelte"

    let showPrompt = $state(false)

    onMount(() => {
        if (isIosSafariNonStandalone() && !isIosPromptDismissed()) {
            // Slight delay so the UI doesn't pop aggressively immediately on page load
            const timer = setTimeout(() => {
                showPrompt = true
            }, 1200)
            return () => clearTimeout(timer)
        }
    })

    function handleDismiss() {
        showPrompt = false
        dismissIosPrompt()
    }
</script>

{#if showPrompt}
    <div class="ios-prompt-container" role="dialog" aria-modal="true" aria-label={t("pwa", "install_ios_title")}>
        <div class="ios-prompt-card">
            <div class="header">
                <div class="app-icon-wrap">
                    <img src="/icons/icon.svg" alt="App icon" class="app-icon" />
                </div>
                <div class="title-wrap">
                    <span class="title">{t("pwa", "install_ios_title")}</span>
                </div>
                <button type="button" class="close-icon-btn" onclick={handleDismiss} aria-label={t("pwa", "dismiss")}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div class="instructions">
                <div class="step">
                    <span class="step-num">1</span>
                    <span class="step-text">{t("pwa", "install_ios_step1")}</span>
                    <span class="inline-icon share-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                    </span>
                </div>
                <div class="step">
                    <span class="step-num">2</span>
                    <span class="step-text">{t("pwa", "install_ios_step2")}</span>
                    <span class="inline-icon add-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                    </span>
                </div>
            </div>

            <div class="actions">
                <button type="button" class="dismiss-btn" onclick={handleDismiss}>
                    {t("pwa", "dismiss")}
                </button>
            </div>

            <!-- Pointer pointing toward Safari toolbar at bottom of iPhone -->
            <div class="pointer-arrow" aria-hidden="true"></div>
        </div>
    </div>
{/if}

<style>
    .ios-prompt-container {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        justify-content: center;
        padding: 0 16px env(safe-area-inset-bottom, 16px) 16px;
        pointer-events: none;
        animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
        from {
            transform: translateY(30px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .ios-prompt-card {
        position: relative;
        pointer-events: auto;
        width: 100%;
        max-width: 400px;
        background-color: var(--md-sys-color-surface-container-high, #fff4eb);
        color: var(--md-sys-color-on-surface, #2e1500);
        border: 1px solid var(--md-sys-color-outline-variant, rgba(74, 34, 0, 0.15));
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .app-icon-wrap {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--md-sys-color-primary, #f5aa67);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .app-icon {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .title-wrap {
        flex: 1;
    }

    .title {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
    }

    .close-icon-btn {
        background: transparent;
        border: none;
        padding: 6px;
        margin: -6px;
        cursor: pointer;
        color: var(--md-sys-color-on-surface-variant, #5c4333);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .instructions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: var(--md-sys-color-surface, #fffdfb);
        padding: 12px;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .step {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13.5px;
        line-height: 1.3;
    }

    .step-num {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: var(--md-sys-color-primary, #f5aa67);
        color: var(--md-sys-color-on-primary, #4a2200);
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
    }

    .step-text {
        flex: 1;
    }

    .inline-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 6px;
        color: var(--md-sys-color-primary, #d97706);
        flex-shrink: 0;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
    }

    .dismiss-btn {
        background: transparent;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(74, 34, 0, 0.2));
        color: inherit;
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }

    .pointer-arrow {
        position: absolute;
        bottom: -7px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        width: 14px;
        height: 14px;
        background-color: var(--md-sys-color-surface-container-high, #fff4eb);
        border-right: 1px solid var(--md-sys-color-outline-variant, rgba(74, 34, 0, 0.15));
        border-bottom: 1px solid var(--md-sys-color-outline-variant, rgba(74, 34, 0, 0.15));
    }
</style>
