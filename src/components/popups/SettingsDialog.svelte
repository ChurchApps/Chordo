<script lang="ts">
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { getLocale, setLocale, type SupportedLocale } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let currentLanguage = $state<SupportedLocale>(getLocale())
    let fileInputRef = $state<HTMLInputElement | null>(null)
    let importStatus = $state<string | null>(null)

    function closeDialog() {
        setActivePopup(null)
    }

    function selectLanguage(locale: SupportedLocale) {
        currentLanguage = locale
        setLocale(locale)
        storage.settings = { ...storage.settings, locale }
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

            if (!parsed || (typeof parsed !== "object")) {
                importStatus = "Invalid backup file."
                return
            }

            openConfirm({
                title: "Import Backup?",
                message: `This will import ${parsed.songs?.length || 0} songs, ${parsed.lists?.length || 0} lists, and ${parsed.folders?.length || 0} folders.`,
                confirmLabel: "Import",
                onConfirm: () => {
                    storage.importData(parsed)
                    importStatus = "Data imported successfully!"
                    if (target) target.value = ""
                }
            })
        } catch (err) {
            console.error("Failed to import file:", err)
            importStatus = "Error parsing backup file."
        }
    }

    function confirmReset() {
        openConfirm({
            title: "Reset All Data?",
            message: "This will permanently delete all songs, folders, and lists. This action cannot be undone.",
            confirmLabel: "Reset",
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
        Settings
    </div>

    <div slot="content" class="settings-content">
        <!-- Language Section -->
        <div class="settings-section">
            <div class="section-title">
                <span class="material-symbols-outlined section-icon">language</span>
                Language
            </div>
            <div class="language-options">
                <button
                    type="button"
                    class="lang-chip"
                    class:active={currentLanguage === "en"}
                    onclick={() => selectLanguage("en")}
                >
                    English
                </button>
                <button
                    type="button"
                    class="lang-chip"
                    class:active={currentLanguage === "no"}
                    onclick={() => selectLanguage("no")}
                >
                    Norsk
                </button>
            </div>
        </div>

        <hr class="section-divider" />

        <!-- Data Management Section -->
        <div class="settings-section">
            <div class="section-title">
                <span class="material-symbols-outlined section-icon">database</span>
                Data Management
            </div>

            <input
                bind:this={fileInputRef}
                type="file"
                accept=".json,application/json"
                style="display: none;"
                onchange={handleFileImport}
            />

            <div class="settings-actions">
                <md-outlined-button onclick={exportBackup}>
                    <span class="material-symbols-outlined" slot="icon">download</span>
                    Export All Data
                </md-outlined-button>

                <md-outlined-button onclick={triggerImport}>
                    <span class="material-symbols-outlined" slot="icon">upload</span>
                    Import All Data
                </md-outlined-button>

                {#if importStatus}
                    <div class="status-msg">{importStatus}</div>
                {/if}

                <md-text-button class="danger-btn" onclick={confirmReset}>
                    <span class="material-symbols-outlined" slot="icon">delete_forever</span>
                    Reset All Data
                </md-text-button>
            </div>
        </div>
    </div>

    <div slot="actions">
        <md-filled-button role="button" tabindex="0" onclick={closeDialog}>Done</md-filled-button>
    </div>
</md-dialog>

<style>
    .settings-headline {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .settings-icon {
        color: var(--md-sys-color-primary, #67b6b6);
        font-size: 28px;
    }

    .settings-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: var(--md-sys-color-on-primary, #044444);
        min-width: 280px;
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
        opacity: 0.85;
    }

    .section-icon {
        font-size: 20px;
        color: var(--md-sys-color-primary, #67b6b6);
    }

    .section-divider {
        border: none;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        margin: 2px 0;
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
        background: transparent;
        color: inherit;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .lang-chip.active {
        background: var(--md-sys-color-primary, #67b6b6);
        color: var(--md-sys-color-on-primary, #ffffff);
        border-color: var(--md-sys-color-primary, #67b6b6);
    }

    .settings-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
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
