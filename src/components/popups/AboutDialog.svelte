<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"

    function closeDialog() {
        setActivePopup(null)
    }
</script>

<md-dialog open onclosed={closeDialog}>
    <div slot="headline" class="about-headline">
        <span class="material-symbols-outlined about-icon">library_music</span>
        {t("about", "title")}
    </div>

    <div slot="content" class="about-content">
        <p class="about-version">{t("about", "version")}</p>
        <p class="about-desc">
            {t("about", "desc")}
        </p>
        <div class="features-list">
            <div class="feature-item">
                <span class="material-symbols-outlined feature-icon">offline_bolt</span>
                <span>{t("about", "feature_offline")}</span>
            </div>
            <div class="feature-item">
                <span class="material-symbols-outlined feature-icon">swap_vert</span>
                <span>{t("about", "feature_transpose")}</span>
            </div>
            <div class="feature-item">
                <span class="material-symbols-outlined feature-icon">draw</span>
                <span>{t("about", "feature_draw")}</span>
            </div>
        </div>
    </div>

    <div slot="actions">
        <md-filled-button role="button" tabindex="0" onclick={closeDialog}>{t("about", "close")}</md-filled-button>
    </div>
</md-dialog>

<style>
    .about-headline {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .about-icon {
        color: var(--md-sys-color-primary, #67b6b6);
        font-size: 28px;
    }

    .about-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--md-sys-color-on-primary, #044444);
    }

    .about-version {
        font-weight: bold;
        font-size: 0.85rem;
        opacity: 0.7;
    }

    .about-desc {
        font-size: 0.95rem;
        line-height: 1.4;
    }

    .features-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }

    .feature-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
    }

    .feature-icon {
        font-size: 20px;
        color: var(--md-sys-color-primary, #67b6b6);
    }
</style>
