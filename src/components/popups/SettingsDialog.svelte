<script lang="ts">
    import { importSetlistFile } from "$lib/export/exportHelper"
    import { Settings, type PageSwitchAnimation } from "$lib/models/Settings"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { getLocale, SUPPORTED_LANGUAGES, t, type SupportedLocale } from "$lib/state/i18n.svelte"
    import { fullscreenState, menuState, popupState, setActivePopup, setFullscreenLyricsOnly } from "$lib/state/menu.svelte"
    import { getTheme, SUPPORTED_THEMES, type SupportedTheme } from "$lib/state/theme.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { integrationState } from "$lib/integrations/integrationState.svelte"
    import "@material/web/iconbutton/filled-tonal-icon-button.js"
    import "@material/web/select/outlined-select.js"
    import "@material/web/select/select-option.js"
    import "@material/web/slider/slider.js"
    import "@material/web/switch/switch.js"
    import BaseDialog from "./BaseDialog.svelte"

    let currentLanguage = $derived<SupportedLocale>(getLocale())
    let currentTheme = $derived<SupportedTheme>(getTheme())
    const sortedLanguages = [...SUPPORTED_LANGUAGES].sort((a, b) => a.label.localeCompare(b.label))
    let fileInputRef = $state<HTMLInputElement | null>(null)
    let importStatus = $state<string | null>(null)

    // Paper options state
    const isSongSettings = $derived(popupState.popupId === "settings" && (menuState.activePage === "song_live" || menuState.activePage === "song" || menuState.activePage === "all_songs"))
    const isFullscreen = $derived(menuState.activePage === "song_live")

    const BACKGROUND_PRESETS = [
        { id: "white", color: "#ffffff", border: "#cac4d0", label: "White" },
        { id: "cream", color: "#f8f5ee", border: "#ded7c8", label: "Cream / Warm" },
        { id: "sepia", color: "#f2ebd9", border: "#d4c8ad", label: "Sepia" },
        { id: "dark", color: "#222222", border: "#444444", label: "Dark Gray" },
        { id: "black", color: "#000000", border: "#333333", label: "Black" }
    ]

    export const DEFAULT_CHORD_COLOR = "#5498be"

    let currentBg = $state(storage.settings.paperOptions?.background || "#ffffff")
    let currentChordColor = $state(storage.settings.paperOptions?.chordColor || DEFAULT_CHORD_COLOR)
    let currentFontSize = $state(storage.settings.paperOptions?.fontSize ?? 100)
    let currentPageAnimation = $state<PageSwitchAnimation>(storage.settings.paperOptions?.pageAnimation || "fast")
    let chordColorInputRef = $state<HTMLInputElement | null>(null)

    let isDarkBg = $derived.by(() => {
        if (!currentBg) return false
        const bg = currentBg.toLowerCase().trim()
        if (bg === "black" || bg === "#000000" || bg === "#000" || bg === "#222222" || bg === "#1e1e1e" || bg === "#242424") return true
        return !isLightColor(bg)
    })

    let chordColorPresets = $derived([
        { id: "default", color: "#5498be", label: "Blue (Default)" },
        { id: "green", color: "#16a34a", label: "Green" },
        { id: "orange", color: "#ea580c", label: "Orange" },
        { id: "red", color: "#dc2626", label: "Red" },
        { id: "purple", color: "#9333ea", label: "Purple" },
        { id: "pink", color: "#db2777", label: "Pink" },
        isDarkBg ? { id: "white", color: "#f5f5f5", label: "Light" } : { id: "charcoal", color: "#212121", label: "Charcoal" }
    ])

    let isCustomChordColor = $derived(!chordColorPresets.some((p) => p.color.toLowerCase() === currentChordColor.toLowerCase()))
    let isCustomChordColorLight = $derived(isLightColor(currentChordColor))

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

    function selectChordColor(color: string) {
        currentChordColor = color
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                chordColor: color
            }
        })
        storage.settings.apply()
        storage.persist()
    }

    function handleCustomChordColorInput(e: Event) {
        const val = (e.target as HTMLInputElement).value
        if (val) {
            selectChordColor(val)
        }
    }

    function isLightColor(color: string): boolean {
        if (!color) return true
        const hex = color.replace("#", "")
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16)
            const g = parseInt(hex[1] + hex[1], 16)
            const b = parseInt(hex[2] + hex[2], 16)
            return 0.2126 * r + 0.7152 * g + 0.0722 * b > 160
        }
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16)
            const g = parseInt(hex.substring(2, 4), 16)
            const b = parseInt(hex.substring(4, 6), 16)
            return 0.2126 * r + 0.7152 * g + 0.0722 * b > 160
        }
        return true
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
        selectChordColor(DEFAULT_CHORD_COLOR)
        setFontSize(100)
        selectPageAnimation("fast")
        setFullscreenLyricsOnly(false)
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
        a.download = `chordo-backup-${new Date().toISOString().slice(0, 10)}.json`
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

<BaseDialog open icon={isSongSettings ? "tune" : "settings"} title={isSongSettings ? t("song_fullscreen", "settings_title") : t("settings", "title")} onclose={closeDialog}>
    <div class="settings-content">
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
                                <span class="material-symbols-outlined check-icon" class:light-check={isDarkPreset} class:dark-check={!isDarkPreset}> check </span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Chord Highlight Color Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">format_color_text</span>
                    {t("song_fullscreen", "chord_color")}
                </div>
                <div class="color-options">
                    {#each chordColorPresets as preset}
                        {@const isSelected = currentChordColor.toLowerCase() === preset.color.toLowerCase()}
                        {@const isLightPreset = preset.color === "#ffffff" || preset.color === "#f5f5f5"}
                        <button
                            type="button"
                            class="color-circle"
                            class:active={isSelected}
                            style="background-color: {preset.color}; border-color: {isLightPreset ? '#cac4d0' : 'rgba(0,0,0,0.12)'};"
                            aria-label={preset.label}
                            title={preset.label}
                            onclick={() => selectChordColor(preset.color)}
                        >
                            {#if isSelected}
                                <span class="material-symbols-outlined check-icon" class:dark-check={isLightPreset} class:light-check={!isLightPreset}> check </span>
                            {/if}
                        </button>
                    {/each}

                    <!-- Custom Color Picker -->
                    <button
                        type="button"
                        class="color-circle"
                        class:active={isCustomChordColor}
                        style="background: {isCustomChordColor ? currentChordColor : 'transparent'};"
                        onclick={() => chordColorInputRef?.click()}
                        aria-label="Custom chord color"
                        title="Custom chord color"
                    >
                        {#if isCustomChordColor}
                            <span class="material-symbols-outlined check-icon" class:dark-check={isCustomChordColorLight} class:light-check={!isCustomChordColorLight}> check </span>
                        {:else}
                            <span class="material-symbols-outlined check-icon palette-icon"> palette </span>
                        {/if}
                        <input bind:this={chordColorInputRef} type="color" value={currentChordColor} class="custom-color-input-hidden" oninput={handleCustomChordColorInput} tabindex="-1" aria-hidden="true" />
                    </button>
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
                        <md-slider min="70" max="150" value={currentFontSize} step="5" labeled oninput={handleFontSizeInput} class="font-slider"></md-slider>
                        <span class="font-size-label">{currentFontSize}%</span>
                    </div>

                    <md-filled-tonal-icon-button onclick={() => stepFontSize(5)} disabled={currentFontSize >= 150} aria-label="Increase text size">
                        <span class="material-symbols-outlined">add</span>
                    </md-filled-tonal-icon-button>
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Chords vs Text View Option -->
            <div class="settings-section">
                <label class="option-toggle-row">
                    <div class="toggle-text">
                        <div class="toggle-title">{t("song_fullscreen", "lyrics_only")}</div>
                    </div>
                    <md-switch
                        selected={fullscreenState.lyricsOnly}
                        onchange={(e: Event) => {
                            const val = Boolean((e.target as any).selected ?? (e.target as any).checked)
                            setFullscreenLyricsOnly(val)
                        }}
                    ></md-switch>
                </label>
            </div>

            {#if isFullscreen}
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
            {/if}
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
                            style="background: {themeOption.gradient ?? themeOption.color};"
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
                <md-outlined-select
                    value={currentLanguage}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLSelectElement
                        if (target?.value) {
                            selectLanguage(target.value as SupportedLocale)
                        }
                    }}
                    class="language-select"
                >
                    {#each sortedLanguages as lang}
                        <md-select-option value={lang.code} selected={currentLanguage === lang.code}>
                            <div slot="headline">{lang.label}</div>
                        </md-select-option>
                    {/each}
                </md-outlined-select>
            </div>

            <hr class="section-divider" />

            <!-- Connections Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">cloud_sync</span>
                    {t("settings", "connections")}
                </div>

                <div class="integrations-list">
                    {#each [{ id: "churchapps", name: "ChurchApps (B1.church)" }, { id: "planning_center", name: "Planning Center" }] as const as provider}
                        <div class="integration-item">
                            <span>{provider.name}</span>
                            {#if integrationState.activeProviderId === provider.id}
                                <md-outlined-button onclick={() => integrationState.disconnectActive()}>{t("settings", "disconnect")}</md-outlined-button>
                            {:else}
                                <md-filled-button disabled={!!integrationState.activeProviderId} onclick={() => integrationState.connect(provider.id)}>{t("settings", "connect")}</md-filled-button>
                            {/if}
                        </div>
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

    {#snippet actions()}
        {#if isSongSettings}
            <md-text-button onclick={resetPaperDefaults}>{t("common", "reset")}</md-text-button>
        {/if}
        <md-filled-button role="button" tabindex="0" onclick={closeDialog}>{t("settings", "done")}</md-filled-button>
    {/snippet}
</BaseDialog>

<style>
    .settings-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: var(--md-sys-color-on-surface, #1d1b20);
        min-width: 280px;
    }

    .integrations-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .integration-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 14px;
        border-radius: 12px;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.12));
        background: var(--md-sys-color-surface-container-low, rgba(0, 0, 0, 0.02));
        font-weight: 500;
        font-size: 0.95rem;
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
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
        max-width: calc(7 * 38px + 6 * 12px);
        gap: 12px;
        align-items: center;
        padding: 4px 0;
    }

    .color-circle {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.12);
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

    :global([data-theme="white"]) .color-circle .check-icon {
        color: #111111;
    }

    :global([data-theme="monochrome"]) .color-circle .check-icon {
        color: #ffffff;
    }

    .language-select,
    .animation-select {
        width: 100%;
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

    .custom-color-input-hidden {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
        pointer-events: none;
        margin: 0;
        padding: 0;
        border: none;
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

    .option-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: transparent;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.15s ease;
    }

    .option-toggle-row:hover {
        background-color: var(--md-sys-color-surface-container-high, rgba(0, 0, 0, 0.05));
    }

    .toggle-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .toggle-title {
        font-weight: 500;
        font-size: 0.95rem;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }
</style>
