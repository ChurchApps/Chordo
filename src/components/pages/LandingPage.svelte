<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePage } from "$lib/state/menu.svelte"
    import LandingTryItOut from "../landing/LandingTryItOut.svelte"

    const FEATURES = [
        { icon: "format_list_bulleted", titleKey: "feature_setlists_title", descKey: "feature_setlists_desc" },
        { icon: "description", titleKey: "feature_chordpro_title", descKey: "feature_chordpro_desc" },
        { icon: "fullscreen", titleKey: "feature_fullscreen_title", descKey: "feature_fullscreen_desc" },
        { icon: "draw", titleKey: "feature_draw_title", descKey: "feature_draw_desc" },
        { icon: "swap_vert", titleKey: "feature_transpose_title", descKey: "feature_transpose_desc" },
        { icon: "timer", titleKey: "feature_metronome_title", descKey: "feature_metronome_desc" },
        { icon: "play_circle", titleKey: "feature_playback_title", descKey: "feature_playback_desc" },
        { icon: "share", titleKey: "feature_share_title", descKey: "feature_share_desc" },
        { icon: "offline_pin", titleKey: "feature_offline_title", descKey: "feature_offline_desc" }
    ] as const

    function goToMainPage() {
        setActivePage("home")
    }
</script>

<main class="landing-main">
    <div class="landing-container">
        <!-- Hero Section -->
        <header class="hero-section">
            <div class="hero-badge">
                <span class="material-symbols-outlined badge-icon">verified</span>
                <span>{t("landing", "badge")}</span>
            </div>

            <div class="hero-brand">
                <div class="hero-icon-wrapper">
                    <span class="material-symbols-outlined hero-logo-icon">library_music</span>
                </div>
                <h1 class="hero-title">Chordo</h1>
            </div>

            <p class="hero-tagline">{t("landing", "tagline")}</p>
            <p class="hero-subtitle">{t("landing", "subtitle")}</p>

            <div class="hero-actions">
                <md-filled-button class="cta-btn primary-cta large-cta" onclick={goToMainPage}>
                    <span class="material-symbols-outlined" slot="icon">rocket_launch</span>
                    {t("landing", "get_started")}
                </md-filled-button>
            </div>
        </header>

        <!-- Interactive "Try it out" Demo Widget -->
        <LandingTryItOut />

        <!-- Feature Grid -->
        <section class="features-section">
            <h2 class="section-heading">{t("landing", "features_title")}</h2>

            <div class="features-grid">
                {#each FEATURES as feature}
                    <div class="feature-card">
                        <div class="feature-icon-wrapper">
                            <span class="material-symbols-outlined">{feature.icon}</span>
                        </div>
                        <div class="feature-content">
                            <h3>{t("landing", feature.titleKey)}</h3>
                            <p>{t("landing", feature.descKey)}</p>
                        </div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Integration Section: Works with FreeShow -->
        <section class="banner-card">
            <div class="banner-left">
                <div class="banner-icon-wrapper">
                    <span class="material-symbols-outlined">slideshow</span>
                </div>
                <div class="banner-content">
                    <h3>{t("landing", "feature_freeshow_title")}</h3>
                    <p>{t("landing", "feature_freeshow_desc")}</p>
                </div>
            </div>
            <a href="https://freeshow.app" target="_blank" rel="noopener noreferrer" class="integration-btn">
                <span>freeshow.app</span>
                <span class="material-symbols-outlined link-icon">open_in_new</span>
            </a>
        </section>
    </div>

    <!-- Footer Section -->
    <footer class="landing-footer">
        <div class="footer-inner">
            <div class="banner-card footer-cta">
                <div class="banner-left">
                    <div class="banner-icon-wrapper">
                        <span class="material-symbols-outlined">library_music</span>
                    </div>
                    <div class="banner-content">
                        <h3>Chordo</h3>
                        <p>{t("landing", "tagline")}</p>
                    </div>
                </div>
                <md-filled-button class="cta-btn primary-cta" onclick={goToMainPage}>
                    <span class="material-symbols-outlined" slot="icon">rocket_launch</span>
                    {t("landing", "get_started")}
                </md-filled-button>
            </div>

            <div class="footer-bottom">
                <div class="footer-links">
                    <a href="https://github.com/ChurchApps/Chordo" target="_blank" rel="noopener noreferrer" class="footer-link">
                        <span class="material-symbols-outlined">code</span>
                        <span>GitHub</span>
                    </a>
                    <span class="link-divider">•</span>
                    <a href="https://churchapps.org/partner#give" target="_blank" rel="noopener noreferrer" class="footer-link">
                        <span class="material-symbols-outlined">volunteer_activism</span>
                        <span>{t("about", "support_donate")}</span>
                    </a>
                </div>

                <div class="footer-credits">
                    <span>&copy; {new Date().getFullYear()}</span>
                    <a href="https://churchapps.org" target="_blank" rel="noopener noreferrer" class="churchapps-link">
                        <span>ChurchApps</span>
                        <span class="material-symbols-outlined open-icon">open_in_new</span>
                    </a>
                </div>
            </div>
        </div>
    </footer>
</main>

<style>
    .landing-main {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        height: 100%;
        margin: 0;
        border-radius: 0;
        background: var(--md-sys-color-primary-container);
        overflow-y: auto;
        overflow-x: hidden;
    }

    .landing-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 36px;
        padding: 40px 20px 48px;
        max-width: 860px;
        width: 100%;
        box-sizing: border-box;
    }

    /* Hero */
    .hero-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        padding: 16px 8px 8px;
        width: 100%;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 20px;
        background-color: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.06));
        color: var(--md-sys-color-on-secondary-container, inherit);
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    .badge-icon {
        font-size: 16px;
        color: var(--md-sys-color-primary);
    }

    .hero-brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 16px 0 12px;
    }

    .hero-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary, #ffffff);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .hero-logo-icon {
        font-size: 32px;
    }

    .hero-title {
        font-size: clamp(2.2rem, 5vw, 3.2rem);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--md-sys-color-on-primary-container);
        line-height: 1;
        margin: 0;
    }

    .hero-tagline {
        font-size: clamp(1.2rem, 2.5vw, 1.5rem);
        font-weight: 700;
        color: var(--md-sys-color-primary);
        max-width: 600px;
        margin: 0;
    }

    .hero-subtitle {
        font-size: clamp(0.95rem, 2vw, 1.1rem);
        line-height: 1.5;
        color: var(--md-sys-color-on-primary-container);
        opacity: 0.8;
        max-width: 560px;
        margin: 0;
    }

    .hero-actions {
        display: flex;
        justify-content: center;
        margin-top: 12px;
        width: 100%;
    }

    .cta-btn {
        min-width: 140px;
    }

    .large-cta {
        min-width: 180px;
        --md-filled-button-container-height: 48px;
        font-size: 1.05rem;
    }

    .primary-cta {
        --md-filled-button-container-color: var(--md-sys-color-primary);
        --md-filled-button-label-text-color: var(--md-sys-color-on-primary);
    }

    /* Features Grid */
    .features-section {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 20px;
    }

    .section-heading {
        font-size: 1.35rem;
        font-weight: 700;
        text-align: center;
        color: var(--md-sys-color-on-primary-container);
        margin: 0;
    }

    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        width: 100%;
    }

    /* Shared Card Styles */
    .feature-card,
    .banner-card {
        background: var(--md-sys-color-surface, #ffffff);
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.1));
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        box-sizing: border-box;
    }

    .feature-card {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 18px;
    }

    .feature-icon-wrapper,
    .banner-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-primary);
        flex-shrink: 0;
    }

    .feature-icon-wrapper .material-symbols-outlined,
    .banner-icon-wrapper .material-symbols-outlined {
        font-size: 24px;
    }

    .feature-content,
    .banner-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .feature-content h3,
    .banner-content h3 {
        font-size: 1rem;
        font-weight: 700;
        color: var(--md-sys-color-on-surface, inherit);
        margin: 0;
    }

    .feature-content p,
    .banner-content p {
        font-size: 0.88rem;
        line-height: 1.45;
        color: var(--md-sys-color-on-surface, inherit);
        opacity: 0.75;
        margin: 0;
    }

    /* Banner Cards (Integration & Footer CTA) */
    .banner-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        width: 100%;
        gap: 16px;
    }

    .banner-left {
        display: flex;
        align-items: center;
        gap: 16px;
        text-align: left;
    }

    .integration-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 10px;
        background: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.05));
        color: var(--md-sys-color-primary, #5498be);
        font-size: 0.85rem;
        font-weight: 600;
        text-decoration: none;
        flex-shrink: 0;
        transition: all 0.15s ease;
    }

    .integration-btn .link-icon {
        font-size: 16px;
    }

    .integration-btn:hover {
        background: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary, #ffffff);
    }

    /* Footer */
    .landing-footer {
        display: flex;
        justify-content: center;
        width: 100%;
        background: var(--md-sys-color-primary-background);
        border-top: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.12));
        box-sizing: border-box;
    }

    .footer-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 28px;
        padding: 40px 20px 48px;
        max-width: 860px;
        width: 100%;
        box-sizing: border-box;
    }

    .footer-bottom {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }

    .footer-links {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: center;
    }

    .footer-link,
    .churchapps-link {
        display: inline-flex;
        align-items: center;
        color: var(--md-sys-color-on-primary-container);
        text-decoration: none;
        font-weight: 600;
        transition: opacity 0.15s ease;
    }

    .footer-link {
        gap: 6px;
        font-size: 0.88rem;
        opacity: 0.8;
    }

    .footer-link:hover,
    .churchapps-link:hover {
        opacity: 1;
        text-decoration: underline;
    }

    .footer-link .material-symbols-outlined {
        font-size: 18px;
    }

    .link-divider {
        opacity: 0.4;
    }

    .footer-credits {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.82rem;
        font-weight: 500;
        opacity: 0.75;
        color: var(--md-sys-color-on-primary-container);
        margin-top: 4px;
    }

    .churchapps-link {
        gap: 3px;
        font-size: 0.82rem;
        letter-spacing: 0.02em;
    }

    .churchapps-link .open-icon {
        font-size: 14px;
    }

    @media (max-width: 600px) {
        .landing-container {
            padding: 24px 12px 32px;
            gap: 24px;
        }

        .footer-inner {
            padding: 28px 12px 36px;
            gap: 20px;
        }

        .banner-card {
            flex-direction: column;
            text-align: center;
            padding: 20px 16px;
        }

        .banner-left {
            flex-direction: column;
            text-align: center;
        }

        .integration-btn {
            width: 100%;
            justify-content: center;
            box-sizing: border-box;
        }
    }
</style>
