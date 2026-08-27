<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"

    function closeDialog() {
        setActivePopup(null)
    }

    const appVersion = __APP_VERSION__
</script>

<md-dialog open onclosed={closeDialog}>
    <div slot="headline" class="about-headline">
        <span class="material-symbols-outlined about-icon">library_music</span>
        Chordo: {t("about", "tagline")}
    </div>

    <div slot="content" class="about-content">
        <p class="about-version">{t("about", "version")} {appVersion}</p>
        <p class="about-desc">
            {t("about", "desc")}
        </p>

        <div class="about-links">
            <a href="https://github.com/ChurchApps/Chordo" target="_blank" rel="noopener noreferrer" class="about-link-btn outline">
                <svg class="icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path
                        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                    />
                </svg>
                <span>{t("about", "source_code")}</span>
                <span class="material-symbols-outlined open-icon">open_in_new</span>
            </a>

            <a href="https://churchapps.org/partner#give" target="_blank" rel="noopener noreferrer" class="about-link-btn outline">
                <span class="material-symbols-outlined btn-icon">volunteer_activism</span>
                <span>{t("about", "support_donate")}</span>
                <span class="material-symbols-outlined open-icon">open_in_new</span>
            </a>
        </div>

        <div class="about-author">
            <span class="material-symbols-outlined author-icon">favorite</span>
            Made in Norway by Kristoffer Vassbø for ChurchApps
        </div>
    </div>

    <div slot="actions">
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("about", "close")}</md-text-button>
    </div>
</md-dialog>

<style>
    .about-headline {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .about-icon {
        color: var(--md-sys-color-primary);
        font-size: 28px;
    }

    .about-content {
        display: flex;
        flex-direction: column;
        gap: 14px;
        color: var(--md-sys-color-on-surface, #1d1b20);
        min-width: 280px;
    }

    .about-version {
        font-weight: bold;
        font-size: 0.85rem;
        opacity: 0.7;
        margin: 0;
    }

    .about-desc {
        font-size: 0.95rem;
        line-height: 1.4;
        margin: 0;
    }

    .about-author {
        display: flex;
        align-items: center;
        justify-content: center;

        gap: 6px;
        font-size: 0.7rem;
        opacity: 0.6;
        font-weight: 500;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        padding-top: 4px;
    }

    .author-icon {
        font-size: 18px;
        color: #e91e63;
    }

    .about-links {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 4px;
    }

    .about-link-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 10px;
        text-decoration: none;
        font-size: 0.92rem;
        font-weight: 500;
        box-sizing: border-box;
        transition:
            background-color 0.15s ease,
            transform 0.1s ease;
    }

    .about-link-btn.outline {
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        color: var(--md-sys-color-on-surface, #1d1b20);
        background: transparent;
    }

    .about-link-btn.outline:hover {
        background-color: var(--md-sys-color-surface-container-high, rgba(0, 0, 0, 0.05));
    }

    .open-icon {
        margin-left: auto;
        font-size: 16px;
        opacity: 0.6;
    }

    .btn-icon {
        font-size: 20px;
    }

    .icon-svg {
        flex-shrink: 0;
    }
</style>
