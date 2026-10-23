<script lang="ts">
    import { importChordoFile, parseChordoJson } from "$lib/export/exportHelper"
    import { extractSharePayloadFromUrl, resolveSharePayload } from "$lib/share/share"
    import { setSharePayload } from "$lib/share/share.svelte"
    import { t } from "$lib/state/i18n.svelte"
    import { menuState, popupState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { Songs } from "$lib/models/Song"
    import { extractAndCleanSongMetadata } from "$lib/chords/chordproConverter"
    import { tick } from "svelte"

    import "@material/web/button/text-button.js"
    import "@material/web/dialog/dialog.js"
    import "@material/web/iconbutton/icon-button.js"
    import "@material/web/progress/linear-progress.js"
    import BaseDialog from "./BaseDialog.svelte"

    const isSong = $derived(popupState.popupId === "import_song")
    const isList = $derived(popupState.popupId === "import_list")

    type ImportMode = "menu" | "share" | "url"
    let currentMode = $state<ImportMode>("menu")

    let shareInput = $state("")
    let isResolvingShare = $state(false)
    let shareError = $state<string | null>(null)
    let shareInputEl = $state<HTMLInputElement>()

    let urlInput = $state("")
    let isFetchingUrl = $state(false)
    let urlError = $state<string | null>(null)
    let urlInputEl = $state<HTMLInputElement>()

    let jsonFileInput = $state<HTMLInputElement>()
    let txtFileInput = $state<HTMLInputElement>()

    function closeDialog() {
        setActivePopup(null)
    }

    async function selectMode(mode: ImportMode) {
        currentMode = mode
        if (mode === "share") {
            shareError = null
            await tick()
            shareInputEl?.focus()
        } else if (mode === "url") {
            urlError = null
            await tick()
            urlInputEl?.focus()
        }
    }

    function backToMenu() {
        currentMode = "menu"
        shareError = null
        urlError = null
    }

    async function handleFileSelected(e: Event) {
        const input = e.target as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return

        const success = await importChordoFile(file)
        if (success) {
            closeDialog()
        }
        input.value = ""
    }

    async function handleShareSubmit() {
        const query = shareInput.trim()
        if (!query) {
            shareError = t("share", "paste_no_link")
            return
        }

        shareError = null
        isResolvingShare = true

        try {
            const rawPayload = extractSharePayloadFromUrl(query) || query
            const decoded = await resolveSharePayload(rawPayload)
            if (decoded) {
                setSharePayload(decoded, rawPayload)
                const title = decoded.type === "list" ? decoded.list.name : decoded.song.name
                closeDialog()
                setActivePage("share_preview", null, title)
            } else {
                shareError = t("share", "generate_failed")
            }
        } catch (err) {
            console.error("Error resolving share link/ID:", err)
            shareError = t("share", "generate_failed")
        } finally {
            isResolvingShare = false
        }
    }

    async function handlePasteShareClipboard() {
        if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
            try {
                const text = await navigator.clipboard.readText()
                if (text && text.trim()) {
                    shareInput = text.trim()
                    handleShareSubmit()
                    return
                }
            } catch {
                // Ignore clipboard read error, user can paste into input manually
            }
        }
    }

    async function handleTxtFilesSelected(e: Event) {
        const input = e.target as HTMLInputElement
        const files = Array.from(input.files || [])
        if (!files.length) return

        let importedCount = 0
        let lastCreatedSongId: string | null = null
        let lastCreatedSongName: string | null = null

        const targetListId = menuState.activePage === "list" ? menuState.contentId : null

        for (const file of files) {
            try {
                const rawText = await file.text()
                if (!rawText.trim()) continue

                const { cleanContent, metadata } = extractAndCleanSongMetadata(rawText)
                const defaultName = file.name.replace(/\.[^/.]+$/, "").trim()
                const songTitle = (metadata.title && metadata.title.trim()) || defaultName || "Untitled"

                const existingSong = storage.songs.find((s) => s.name.trim().toLowerCase() === songTitle.toLowerCase())
                if (existingSong) {
                    showToast(t("new", "song_exists").replace("{name}", existingSong.name), "warning")
                }

                const song = Songs.create(
                    {
                        name: songTitle,
                        content: cleanContent || rawText
                    },
                    targetListId
                )

                for (const [k, v] of Object.entries(metadata)) {
                    if (v && k !== "title") {
                        song.setMetadata(k, v)
                    }
                }
                storage.updateSong(song)

                importedCount++
                lastCreatedSongId = song.id
                lastCreatedSongName = song.name
            } catch (err) {
                console.error("Error importing chordpro/txt file:", file.name, err)
            }
        }

        input.value = ""

        if (importedCount > 0) {
            showToast(`${importedCount} ${importedCount === 1 ? t("pages", "song") || "song" : t("search", "category_songs") || "songs"} ${t("common", "import").toLowerCase()}`, "success")
            closeDialog()
            if (importedCount === 1 && lastCreatedSongId) {
                setActivePage("song", lastCreatedSongId, lastCreatedSongName)
            }
        } else {
            showToast(t("settings", "import_invalid"), "error")
        }
    }

    async function fetchRawJsonUrl(targetUrl: string): Promise<string> {
        let url = targetUrl.trim()
        if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url
        }

        const headers = { Accept: "application/json, text/plain, */*" }

        try {
            const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
            if (res.ok) {
                const text = await res.text()
                if (text.trim()) return text
            }
        } catch {}

        if (typeof window !== "undefined") {
            try {
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) })
                if (res.ok) {
                    const text = await res.text()
                    if (text.trim() && !text.startsWith("Proxy error:")) return text
                }
            } catch {}
        }

        const corsProxies = [`https://corsproxy.org/?url=${encodeURIComponent(url)}`, `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`]

        for (const proxy of corsProxies) {
            try {
                const res = await fetch(proxy, { signal: AbortSignal.timeout(6000) })
                if (res.ok) {
                    const text = await res.text()
                    if (text.trim() && !text.includes("403 Forbidden") && !text.includes("Access Denied")) {
                        return text
                    }
                }
            } catch {}
        }

        throw new Error("Failed to fetch raw JSON from URL")
    }

    async function handleUrlSubmit() {
        const url = urlInput.trim()
        if (!url) {
            urlError = t("share", "paste_no_link")
            return
        }

        urlError = null
        isFetchingUrl = true

        try {
            const text = await fetchRawJsonUrl(url)
            const payload = parseChordoJson(text)
            if (!payload) {
                urlError = t("settings", "import_invalid")
                return
            }

            setSharePayload(payload)
            const title = payload.type === "list" ? payload.list.name : payload.song.name
            closeDialog()
            setActivePage("share_preview", null, title)
        } catch (err) {
            console.error("Error fetching raw JSON:", err)
            urlError = t("settings", "import_error")
        } finally {
            isFetchingUrl = false
        }
    }
</script>

<input bind:this={jsonFileInput} type="file" accept=".json,application/json" style="display: none;" onchange={handleFileSelected} />

{#if isSong}
    <input bind:this={txtFileInput} type="file" accept="text/plain,.chordpro,.chpro,.cho,.crd,.pro" multiple style="display: none;" onchange={handleTxtFilesSelected} />
{/if}

<BaseDialog open onclose={closeDialog}>
    {#snippet headline()}
        <div class="dialog-header">
            {#if currentMode !== "menu"}
                <md-icon-button type="button" onclick={backToMenu} class="back-btn">
                    <span class="material-symbols-outlined">arrow_back</span>
                </md-icon-button>
            {:else}
                <span class="material-symbols-outlined headline-icon">download</span>
            {/if}
            <span>
                {#if currentMode === "share"}
                    {t("share", "share_link")}
                {:else if currentMode === "url"}
                    {t("song_edit", "import_url")}
                {:else}
                    {isSong ? t("menu", "import_song") : t("menu", "import_list")}
                {/if}
            </span>
        </div>
    {/snippet}

    <div class="import-dialog-content">
        {#if currentMode === "menu"}
            <div class="import-options-list">
                <!-- Chordo JSON File button -->
                <button type="button" class="import-option-card" onclick={() => jsonFileInput?.click()}>
                    <div class="option-icon-container">
                        <span class="material-symbols-outlined option-icon">data_object</span>
                    </div>
                    <div class="option-text">
                        <div class="option-title">JSON</div>
                        <div class="option-desc">{isSong ? t("share", "export_json_desc") : t("share", "export_json_desc")}</div>
                    </div>
                    <span class="material-symbols-outlined action-icon">upload_file</span>
                </button>

                <!-- Txt / ChordPro file button (Only for Song) -->
                {#if isSong}
                    <button type="button" class="import-option-card" onclick={() => txtFileInput?.click()}>
                        <div class="option-icon-container">
                            <span class="material-symbols-outlined option-icon">description</span>
                        </div>
                        <div class="option-text">
                            <div class="option-title">ChordPro / TXT</div>
                            <div class="option-desc">Plain text files</div>
                        </div>
                        <span class="material-symbols-outlined action-icon">upload_file</span>
                    </button>
                {/if}

                <!-- Share Link / ID option button -->
                <button type="button" class="import-option-card" onclick={() => selectMode("share")}>
                    <div class="option-icon-container">
                        <span class="material-symbols-outlined option-icon">link</span>
                    </div>
                    <div class="option-text">
                        <div class="option-title">{t("share", "share_link")}</div>
                        <div class="option-desc">{t("share", "paste_link_label")}</div>
                    </div>
                    <span class="material-symbols-outlined action-icon">arrow_forward</span>
                </button>

                <!-- Raw JSON URL (Only for Setlist) -->
                {#if isList}
                    <button type="button" class="import-option-card" onclick={() => selectMode("url")}>
                        <div class="option-icon-container">
                            <span class="material-symbols-outlined option-icon">public</span>
                        </div>
                        <div class="option-text">
                            <div class="option-title">{t("song_edit", "import_url")}</div>
                            <div class="option-desc">Raw JSON Data</div>
                        </div>
                        <span class="material-symbols-outlined action-icon">arrow_forward</span>
                    </button>
                {/if}
            </div>
        {:else if currentMode === "share"}
            <div class="input-view-container">
                <form
                    class="input-col-form"
                    onsubmit={(e) => {
                        e.preventDefault()
                        handleShareSubmit()
                    }}
                >
                    <div class="text-input-wrap">
                        <input bind:this={shareInputEl} type="text" class="custom-text-input" placeholder="https://chordo.org/s/..." bind:value={shareInput} disabled={isResolvingShare} />
                        {#if !shareInput}
                            <button type="button" class="inline-paste-btn" title="Paste" onclick={handlePasteShareClipboard}>
                                <span class="material-symbols-outlined" style="font-size: 18px;">content_paste</span>
                            </button>
                        {/if}
                    </div>

                    <button type="submit" class="action-submit-btn" disabled={isResolvingShare || !shareInput.trim()}>
                        {#if isResolvingShare}
                            <span class="material-symbols-outlined rotating">progress_activity</span>
                        {:else}
                            <span class="material-symbols-outlined">arrow_forward</span>
                        {/if}
                        <span>{t("common", "open")}</span>
                    </button>
                </form>

                {#if isResolvingShare}
                    <div class="progress-wrap">
                        <md-linear-progress indeterminate></md-linear-progress>
                    </div>
                {/if}

                {#if shareError}
                    <div class="error-msg">
                        <span class="material-symbols-outlined" style="font-size: 16px;">error</span>
                        <span>{shareError}</span>
                    </div>
                {/if}
            </div>
        {:else if currentMode === "url"}
            <div class="input-view-container">
                <form
                    class="input-col-form"
                    onsubmit={(e) => {
                        e.preventDefault()
                        handleUrlSubmit()
                    }}
                >
                    <div class="text-input-wrap">
                        <input bind:this={urlInputEl} type="text" class="custom-text-input" placeholder="example.com/setlist.json" bind:value={urlInput} disabled={isFetchingUrl} />
                    </div>

                    <button type="submit" class="action-submit-btn" disabled={isFetchingUrl || !urlInput.trim()}>
                        {#if isFetchingUrl}
                            <span class="material-symbols-outlined rotating">progress_activity</span>
                        {:else}
                            <span class="material-symbols-outlined">cloud_download</span>
                        {/if}
                        <span>{t("song_edit", "pull")}</span>
                    </button>
                </form>

                {#if isFetchingUrl}
                    <div class="progress-wrap">
                        <md-linear-progress indeterminate></md-linear-progress>
                    </div>
                {/if}

                {#if urlError}
                    <div class="error-msg">
                        <span class="material-symbols-outlined" style="font-size: 16px;">error</span>
                        <span>{urlError}</span>
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#snippet actions()}
        {#if currentMode !== "menu"}
            <md-text-button role="button" tabindex="0" onclick={backToMenu}>{t("common", "cancel")}</md-text-button>
        {:else}
            <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("common", "close")}</md-text-button>
        {/if}
    {/snippet}
</BaseDialog>

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .headline-icon {
        color: var(--md-sys-color-primary, #6750a4);
        font-size: 26px;
    }

    .back-btn {
        margin-left: -8px;
    }

    .import-dialog-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 280px;
        max-width: 480px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .import-options-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .input-view-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 4px;
    }

    .import-option-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: transparent;
        color: var(--md-sys-color-on-surface, #1d1b20);
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
        transition: background-color 0.15s ease;
    }

    .import-option-card:hover {
        background-color: var(--md-sys-color-surface-container-high, rgba(0, 0, 0, 0.05));
    }

    .option-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background-color: var(--md-sys-color-primary-container, #eaddff);
        color: var(--md-sys-color-on-primary-container, #21005d);
        flex-shrink: 0;
    }

    .option-icon {
        font-size: 20px;
    }

    .option-text {
        flex: 1;
        min-width: 0;
    }

    .option-title {
        font-weight: 500;
        font-size: 0.9rem;
    }

    .option-desc {
        font-size: 0.75rem;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .action-icon {
        font-size: 20px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        opacity: 0.7;
    }

    .input-col-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
    }

    .text-input-wrap {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
    }

    .custom-text-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        padding-right: 36px;
        font-size: 0.85rem;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 8px;
        background: transparent;
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s ease;
    }

    .custom-text-input:focus {
        border-color: var(--md-sys-color-primary, #6750a4);
    }

    .inline-paste-btn {
        position: absolute;
        right: 6px;
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        border-radius: 4px;
        opacity: 0.7;
    }

    .inline-paste-btn:hover {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.05);
    }

    .action-submit-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 16px;
        height: 40px;
        width: 100%;
        box-sizing: border-box;
        border-radius: 8px;
        border: none;
        background-color: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition:
            opacity 0.15s ease,
            filter 0.15s ease;
    }

    .action-submit-btn:hover:not(:disabled) {
        filter: brightness(1.08);
    }

    .action-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .progress-wrap {
        width: 100%;
        margin-top: 4px;
    }

    .error-msg {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--md-sys-color-error, #ba1a1a);
        font-size: 0.75rem;
        margin-top: 4px;
    }

    .rotating {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
