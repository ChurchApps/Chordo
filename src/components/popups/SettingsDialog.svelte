<script lang="ts">
    import { importSetlistFile } from "$lib/export/exportHelper"
    import { Settings, type PageSwitchAnimation } from "$lib/models/Settings"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { getLocale, SUPPORTED_LANGUAGES, t, type SupportedLocale } from "$lib/state/i18n.svelte"
    import { menuState, popupState, setActivePopup } from "$lib/state/menu.svelte"
    import { getTheme, SUPPORTED_THEMES, type SupportedTheme } from "$lib/state/theme.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import "@material/web/iconbutton/filled-tonal-icon-button.js"
    import "@material/web/select/outlined-select.js"
    import "@material/web/select/select-option.js"
    import "@material/web/slider/slider.js"

    let currentLanguage = $derived<SupportedLocale>(getLocale())
    let currentTheme = $derived<SupportedTheme>(getTheme())
    let fileInputRef = $state<HTMLInputElement | null>(null)
    let importStatus = $state<string | null>(null)

    // Paper options state
    const isSongSettings = $derived(
        popupState.popupId === "settings" && (menuState.activePage === "song_live" || menuState.activePage === "song_draw" || menuState.activePage === "song")
    )

    const BACKGROUND_PRESETS = [
        { id: "white", color: "#ffffff", border: "#cac4d0", label: "White" },
        { id: "cream", color: "#f8f5ee", border: "#ded7c8", label: "Cream / Warm" },
        { id: "sepia", color: "#f2ebd9", border: "#d4c8ad", label: "Sepia" },
        { id: "dark", color: "#222222", border: "#444444", label: "Dark Gray" },
        { id: "black", color: "#000000", border: "#333333", label: "Black" }
    ]

    let currentBg = $state(storage.settings.paperOptions?.background || "#ffffff")
    let currentFontSize = $state(storage.settings.paperOptions?.fontSize ?? 100)
    let currentPageAnimation = $state<PageSwitchAnimation>(storage.settings.paperOptions?.pageAnimation || "fast")

    function selectBackground(color: string) {
        currentBg = color
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                background: color
            }
        })
        storage.persist()
    }

    function handleFontSizeInput(e: Event) {
        const val = Number((e.target as HTMLInputElement).value)
        if (!isNaN(val)) {
            setFontSize(val)
        }
    }

    function stepFontSize(delta: number) {
        const next = Math.max(70, Math.min(150, currentFontSize + delta))
        setFontSize(next)
    }

    function setFontSize(val: number) {
        currentFontSize = val
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                fontSize: val
            }
        })
        storage.persist()
    }

    function selectPageAnimation(animation: PageSwitchAnimation) {
        currentPageAnimation = animation
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                pageAnimation: animation
            }
        })
        storage.persist()
    }

    function resetPaperDefaults() {
        selectBackground("#ffffff")
        setFontSize(100)
        selectPageAnimation("fast")
    }

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

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline" class="settings-headline">
        <span class="material-symbols-outlined settings-icon">{isSongSettings ? "tune" : "settings"}</span>
        {isSongSettings ? t("song_fullscreen", "settings_title") : t("settings", "title")}
    </div>

    <div slot="content" class="settings-content">
        {#if isSongSettings}
            <!-- Background Color Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">palette</span>
                    {t("song_fullscreen", "page_background")}
                </div>
                <div class="color-options">
                    {#each BACKGROUND_PRESETS as preset}
                        {@const isSelected = currentBg.toLowerCase() === preset.color.toLowerCase()}
                        {@const isDarkPreset = preset.color === "#222222" || preset.color === "#000000"}
                        <button
                            type="button"
                            class="color-circle"
                            class:active={isSelected}
                            style="background-color: {preset.color}; border-color: {preset.border};"
                            aria-label={preset.label}
                            title={preset.label}
                            onclick={() => selectBackground(preset.color)}
                        >
                            {#if isSelected}
                                <span class="material-symbols-outlined check-icon" class:light-check={isDarkPreset} class:dark-check={!isDarkPreset}>
                                    check
                                </span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Font / Text Size Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">format_size</span>
                    {t("song_fullscreen", "text_size")}
                </div>

                <div class="font-size-row">
                    <md-filled-tonal-icon-button onclick={() => stepFontSize(-5)} disabled={currentFontSize <= 70} aria-label="Decrease text size">
                        <span class="material-symbols-outlined">remove</span>
                    </md-filled-tonal-icon-button>

                    <div class="font-size-slider-wrapper">
                        <md-slider
                            min="70"
                            max="150"
                            value={currentFontSize}
                            step="5"
                            labeled
                            oninput={handleFontSizeInput}
                            class="font-slider"
                        ></md-slider>
                        <span class="font-size-label">{currentFontSize}%</span>
                    </div>

                    <md-filled-tonal-icon-button onclick={() => stepFontSize(5)} disabled={currentFontSize >= 150} aria-label="Increase text size">
                        <span class="material-symbols-outlined">add</span>
                    </md-filled-tonal-icon-button>
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Page Switch Animation Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">animation</span>
                    {t("song_fullscreen", "page_animation")}
                </div>

                <md-outlined-select
                    value={currentPageAnimation}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLSelectElement
                        if (target?.value) {
                            selectPageAnimation(target.value as PageSwitchAnimation)
                        }
                    }}
                    class="animation-select"
                >
                    <md-select-option value="none" selected={currentPageAnimation === "none"}>
                        <div slot="headline">{t("song_fullscreen", "animation_none")}</div>
                    </md-select-option>
                    <md-select-option value="fast" selected={currentPageAnimation === "fast"}>
                        <div slot="headline">{t("song_fullscreen", "animation_fast")}</div>
                    </md-select-option>
                    <md-select-option value="slow" selected={currentPageAnimation === "slow"}>
                        <div slot="headline">{t("song_fullscreen", "animation_slow")}</div>
                    </md-select-option>
                </md-outlined-select>
            </div>
        {:else}
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
        {/if}
    </div>

    <div slot="actions">
        {#if isSongSettings}
            <md-text-button onclick={resetPaperDefaults}>{t("common", "reset")}</md-text-button>
        {/if}
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

    .color-options {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        padding: 4px 0;
    }

    .check-icon.dark-check {
        color: #1d1b20;
    }

    .check-icon.light-check {
        color: #ffffff;
    }

    .font-size-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .font-size-slider-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .font-slider {
        width: 100%;
        --md-slider-active-track-color: var(--md-sys-color-primary, #6750a4);
        --md-slider-handle-color: var(--md-sys-color-primary, #6750a4);
    }

    .font-size-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--md-sys-color-primary);
    }

    .animation-select {
        width: 100%;
        --md-menu-item-selected-container-color: var(--md-sys-color-secondary-container);
        --md-menu-item-selected-label-text-color: var(--md-sys-color-on-secondary-container);
        --md-outlined-select-text-field-focus-outline-color: var(--md-sys-color-primary);
        --md-outlined-select-text-field-focus-label-text-color: var(--md-sys-color-primary);
        --md-outlined-select-text-field-focus-trailing-icon-color: var(--md-sys-color-primary);
    }
</style>
