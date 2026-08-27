<script lang="ts">
    import { importSetlistFile } from "$lib/export/exportHelper"
    import { Settings } from "$lib/models/Settings"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { getLocale, SUPPORTED_LANGUAGES, t, type SupportedLocale } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"
    import { getTheme, SUPPORTED_THEMES, type SupportedTheme } from "$lib/state/theme.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let currentLanguage = $derived<SupportedLocale>(getLocale())
    let currentTheme = $derived<SupportedTheme>(getTheme())
    let fileInputRef = $state<HTMLInputElement | null>(null)
    let importStatus = $state<string | null>(null)

    function closeDialog() {
        setActivePopup(null)
    }

    function selectLanguage(locale: SupportedLocale) {
        storage.settings = new Settings({ ...storage.settings, locale })
        storage.settings.apply()
        storage.persist()
    }

    function selectTheme(theme: SupportedTheme) {
        storage.settings = new Settings({ ...storage.settings, theme })
        storage.settings.apply()
        storage.persist()
    }

    function exportBackup() {
        const data = {
            folders: storage.folders,
            lists: storage.lists,
            songs: storage.songs,
            settings: storage.settings,
            exportedAt: new Date().toISOString()
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `sheet-manager-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    function triggerImport() {
        if (fileInputRef) {
            fileInputRef.click()
        }
    }

    async function handleFileImport(e: Event) {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0]
        if (!file) return

        try {
            const text = await file.text()
            const parsed = JSON.parse(text)

            if (!parsed || typeof parsed !== "object") {
                importStatus = t("settings", "import_invalid")
                return
            }

            if ((parsed.type === "list" && parsed.list) || (parsed.type === "song" && parsed.song)) {
                closeDialog()
                await importSetlistFile(file)
                if (target) target.value = ""
                return
            }

            openConfirm({
                title: t("settings", "import_confirm_title"),
                message: `This will import ${parsed.songs?.length || 0} songs, ${parsed.lists?.length || 0} lists, and ${parsed.folders?.length || 0} folders.`,
                confirmLabel: t("settings", "import_confirm_btn"),
                onConfirm: () => {
                    storage.importData(parsed)
                    importStatus = t("settings", "import_success")
                    if (target) target.value = ""
                }
            })
        } catch (err) {
            console.error("Failed to import file:", err)
            importStatus = t("settings", "import_error")
        }
    }

    function confirmReset() {
        openConfirm({
            title: t("settings", "reset_confirm_title"),
            message: t("settings", "reset_confirm_msg"),
            confirmLabel: t("settings", "reset_confirm_btn"),
            isDestructive: true,
            onConfirm: () => {
                storage.resetAll()
                closeDialog()
            }
        })
    }
</script>

<md-dialog open onclosed={closeDialog}>
    <div slot="headline" class="settings-headline">
        <span class="material-symbols-outlined settings-icon">settings</span>
        {t("settings", "title")}
    </div>

    <div slot="content" class="settings-content">
        <!-- Theme Color Section -->
        <div class="settings-section">
            <div class="section-title">
                <span class="material-symbols-outlined section-icon">palette</span>
                {t("settings", "theme")}
            </div>
            <div class="theme-circles">
                {#each SUPPORTED_THEMES as themeOption}
                    <button
                        type="button"
                        class="color-circle"
                        class:active={currentTheme === themeOption.id}
                        style="background-color: {themeOption.color};"
                        aria-label={themeOption.labelKey}
                        title={themeOption.labelKey}
                        onclick={() => selectTheme(themeOption.id)}
                    >
                        {#if currentTheme === themeOption.id}
                            <span class="material-symbols-outlined check-icon">check</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <hr class="section-divider" />

        <!-- Language Section -->
        <div class="settings-section">
            <div class="section-title">
                <span class="material-symbols-outlined section-icon">language</span>
                {t("settings", "language")}
            </div>
            <div class="language-options">
                {#each SUPPORTED_LANGUAGES as lang}
                    <button type="button" class="lang-chip" class:active={currentLanguage === lang.code} onclick={() => selectLanguage(lang.code)}>
                        {lang.label}
                    </button>
                {/each}
            </div>
        </div>

        <hr class="section-divider" />

        <!-- Data Management Section -->
        <div class="settings-section">
            <div class="section-title">
                <span class="material-symbols-outlined section-icon">database</span>
                {t("settings", "data_management")}
            </div>

            <input bind:this={fileInputRef} type="file" accept=".json,application/json" style="display: none;" onchange={handleFileImport} />

            <div class="settings-actions">
                <div class="data-actions-row">
                    <md-outlined-button onclick={exportBackup}>
                        <span class="material-symbols-outlined" slot="icon">download</span>
                        {t("settings", "export_data")}
                    </md-outlined-button>

                    <md-outlined-button onclick={triggerImport}>
                        <span class="material-symbols-outlined" slot="icon">upload</span>
                        {t("settings", "import_data")}
                    </md-outlined-button>
                </div>

                {#if importStatus}
                    <div class="status-msg">{importStatus}</div>
                {/if}

                <md-text-button class="danger-btn" onclick={confirmReset}>
                    <span class="material-symbols-outlined" slot="icon">delete_forever</span>
                    {t("settings", "reset_data")}
                </md-text-button>
            </div>
        </div>
    </div>

    <div slot="actions">
        <md-filled-button role="button" tabindex="0" onclick={closeDialog}>{t("settings", "done")}</md-filled-button>
    </div>
</md-dialog>

<style>
    .settings-headline {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .settings-icon {
        color: var(--md-sys-color-primary);
        font-size: 28px;
    }

    .settings-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: var(--md-sys-color-on-surface, #1d1b20);
        min-width: 280px;
        max-height: 70vh;
        overflow-y: auto;
    }

    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--md-sys-color-on-surface, #1d1b20);
        opacity: 0.85;
    }

    .section-icon {
        font-size: 20px;
        color: var(--md-sys-color-primary);
    }

    .section-divider {
        border: none;
        border-top: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.08));
        margin: 2px 0;
    }

    .theme-circles {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        padding: 4px 0;
    }

    .color-circle {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
            transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
        padding: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .color-circle:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    .color-circle.active {
        transform: scale(1.08);
        box-shadow:
            0 0 0 2.5px var(--md-sys-color-surface, #ffffff),
            0 0 0 4.5px var(--md-sys-color-primary);
    }

    .color-circle .check-icon {
        font-size: 20px;
        color: var(--md-sys-color-on-primary, #044444);
        font-weight: bold;
    }

    .language-options {
        display: flex;
        gap: 8px;
    }

    .lang-chip {
        flex: 1;
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-low, transparent);
        color: var(--md-sys-color-on-surface, inherit);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .lang-chip:hover {
        background: var(--md-sys-color-surface-container-high, rgba(0, 0, 0, 0.04));
    }

    .lang-chip.active {
        background: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary);
        border-color: var(--md-sys-color-primary);
    }

    .settings-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .data-actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .data-actions-row > :global(md-outlined-button) {
        flex: 1 1 0;
    }

    .status-msg {
        font-size: 0.85rem;
        text-align: center;
        opacity: 0.8;
    }

    .danger-btn {
        color: var(--md-sys-color-error, #ba1a1a);
    }
</style>
