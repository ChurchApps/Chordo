<script lang="ts">
    import { exportSetlistAsJson, exportSongAsJson } from "$lib/export/exportHelper"
    import { exportAsFreeShowProject } from "$lib/export/freeshowProject"
    import { buildListSharePayload, buildSongSharePayload } from "$lib/share/shareCodec"
    import { copyUrlToClipboard, createShare, getCachedShareUrl } from "$lib/share/share"
    import { t } from "$lib/state/i18n.svelte"
    import { getCurrentSong, menuState, popupState, setActivePopup } from "$lib/state/menu.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    import "@material/web/button/filled-button.js"
    import "@material/web/button/outlined-button.js"
    import "@material/web/button/text-button.js"
    import "@material/web/dialog/dialog.js"
    import "@material/web/progress/linear-progress.js"
    import "@material/web/switch/switch.js"

    const isSong = $derived(popupState.popupId === "share_song")
    const isList = $derived(popupState.popupId === "share_list")

    const song = $derived.by(() => {
        if (!isSong) return null
        if (menuState.contentId) {
            return storage.getSongById(menuState.contentId) ?? getCurrentSong()?.song ?? null
        }
        return getCurrentSong()?.song ?? null
    })

    const list = $derived.by(() => {
        if (!isList) return null
        return menuState.contentId ? storage.getListById(menuState.contentId) : null
    })

    const title = $derived(isSong ? song?.name ?? "" : list?.name ?? "")

    let includeMedia = $state(false)
    let includeDrawings = $state(false)

    const hasDrawings = $derived(
        Boolean(isSong && song?.drawings && song.drawings.some((d) => Boolean(d && d.trim())))
    )

    const hasMedia = $derived.by(() => {
        if (isSong && song) {
            return Boolean(song.images && song.images.some((img) => Boolean(img && img.trim())))
        }
        if (isList && list) {
            return list.songs.some((item) => {
                if (!item.id) return false
                const s = storage.getSongById(item.id)
                return Boolean(s?.images && s.images.some((img) => Boolean(img && img.trim())))
            })
        }
        return false
    })

    let shareUrl = $state<string | null>(null)
    let isGenerating = $state(false)
    let generateError = $state<string | null>(null)
    let copied = $state(false)

    const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

    $effect(() => {
        if (popupState.popupId === "share_song" || popupState.popupId === "share_list") {
            if (!shareUrl && !isGenerating && (song || list)) {
                checkCachedUrl()
            }
        }
    })

    async function checkCachedUrl() {
        try {
            if (isSong && song) {
                const payload = await buildSongSharePayload(song, { includeDrawings })
                const cached = await getCachedShareUrl(payload)
                if (cached) shareUrl = cached
            } else if (isList && list) {
                const payload = await buildListSharePayload(list, storage.songs, { includeMedia })
                const cached = await getCachedShareUrl(payload)
                if (cached) shareUrl = cached
            }
        } catch {
            // Ignore cache check errors
        }
    }

    async function generateUrl(): Promise<string | null> {
        if (shareUrl) return shareUrl
        if (isGenerating) return null
        isGenerating = true
        generateError = null
        try {
            let url: string | null = null
            if (isSong && song) {
                const payload = await buildSongSharePayload(song, { includeDrawings })
                url = await createShare(payload)
            } else if (isList && list) {
                const payload = await buildListSharePayload(list, storage.songs, { includeMedia })
                url = await createShare(payload)
            }
            shareUrl = url
            return url
        } catch (err) {
            console.error("Failed to generate share URL:", err)
            generateError = t("share", "generate_failed")
            return null
        } finally {
            isGenerating = false
        }
    }

    function closeDialog() {
        setActivePopup(null)
    }

    async function handleCopyUrl() {
        const url = shareUrl || (await generateUrl())
        if (!url) return

        let success = false
        if (navigator?.clipboard) {
            try {
                await navigator.clipboard.writeText(url)
                success = true
            } catch (e) {
                console.error("Clipboard write error:", e)
            }
        }
        if (!success) {
            success = await copyUrlToClipboard(url, title)
        }

        if (success) {
            copied = true
            showToast(t("share", "link_copied"), "success")
            setTimeout(() => {
                copied = false
            }, 2500)
        }
    }

    async function handleNativeShare() {
        const url = shareUrl || (await generateUrl())
        if (!url) return

        try {
            await navigator.share({
                title: title || "Chord Sheet",
                url
            })
            showToast(t("share", "shared_success"), "success")
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                console.error("Native share failed:", err)
            }
        }
    }

    function handleExportJson() {
        if (isSong && song) {
            exportSongAsJson(song, { includeDrawings })
        } else if (isList && list) {
            exportSetlistAsJson(list, storage.songs, { includeMedia })
        }
    }

    function handleExportFreeShow() {
        if (list) {
            exportAsFreeShowProject(list, storage.songs)
        }
    }
</script>

<md-dialog open onclosed={closeDialog} class="share-dialog">
    <div slot="headline" class="share-headline">
        <span class="material-symbols-outlined headline-icon">share</span>
        <span>{isSong ? t("menu", "share_song") : t("menu", "share_list")}</span>
    </div>

    <div slot="content" class="share-dialog-content">
        <!-- Options Section -->
        {#if isList && hasMedia}
            <div class="section-container">
                <div class="section-title">{t("share", "options")}</div>
                <label class="option-toggle-row">
                    <div class="toggle-text">
                        <div class="toggle-title">{t("share", "include_media")}</div>
                        <div class="toggle-desc">{t("share", "include_media_desc")}</div>
                    </div>
                    <md-switch
                        selected={includeMedia}
                        onchange={(e: Event) => {
                            includeMedia = (e.target as any).selected ?? (e.target as any).checked
                            shareUrl = null
                            copied = false
                            checkCachedUrl()
                        }}
                    ></md-switch>
                </label>
            </div>
        {:else if isSong && hasDrawings}
            <div class="section-container">
                <div class="section-title">{t("share", "options")}</div>
                <label class="option-toggle-row">
                    <div class="toggle-text">
                        <div class="toggle-title">{t("share", "include_drawings")}</div>
                        <div class="toggle-desc">{t("share", "include_drawings_desc")}</div>
                    </div>
                    <md-switch
                        selected={includeDrawings}
                        onchange={(e: Event) => {
                            includeDrawings = (e.target as any).selected ?? (e.target as any).checked
                            shareUrl = null
                            copied = false
                            checkCachedUrl()
                        }}
                    ></md-switch>
                </label>
            </div>
        {/if}

        <!-- Share URL Section -->
        <div class="section-container">
            <div class="section-title">{t("share", "share_link")}</div>

            {#if shareUrl}
                <div class="url-input-row">
                    <input
                        type="text"
                        readonly
                        value={shareUrl}
                        class="share-url-input"
                        onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
                    />
                </div>
            {/if}

            {#if isGenerating}
                <div class="loading-state">
                    <md-linear-progress indeterminate></md-linear-progress>
                    <span class="loading-text">{t("share", "generating_link")}</span>
                </div>
            {:else if generateError}
                <div class="error-state">
                    <span>{generateError}</span>
                    <md-text-button onclick={generateUrl}>{t("common", "redo")}</md-text-button>
                </div>
            {/if}

            <div class="share-actions-row">
                <md-filled-button class="copy-button" onclick={handleCopyUrl} disabled={isGenerating}>
                    <span class="material-symbols-outlined" slot="icon">{copied ? "check" : "content_copy"}</span>
                    {copied ? t("share", "copied") : t("share", "copy_share_url")}
                </md-filled-button>

                {#if canNativeShare}
                    <md-outlined-button onclick={handleNativeShare} disabled={isGenerating}>
                        <span class="material-symbols-outlined" slot="icon">share</span>
                        {t("share", "share_via")}
                    </md-outlined-button>
                {/if}
            </div>

            {#if (isSong && hasMedia) || (isList && includeMedia && hasMedia)}
                <div class="media-notice">
                    <span class="material-symbols-outlined notice-icon">info</span>
                    <span>{t("share", "media_note")}</span>
                </div>
            {/if}
        </div>

        <!-- Export Files Section -->
        <div class="section-container">
            <div class="section-title">{t("menu", "export_as")}</div>

            <div class="export-options-list">
                <!-- Export as JSON -->
                <button type="button" class="export-option-card" onclick={handleExportJson}>
                    <div class="option-icon-container">
                        <span class="material-symbols-outlined option-icon">data_object</span>
                    </div>
                    <div class="option-text">
                        <div class="option-title">{t("menu", "export_as")} JSON</div>
                        <div class="option-desc">{t("share", "export_json_desc")}</div>
                    </div>
                    <span class="material-symbols-outlined download-icon">download</span>
                </button>

                <!-- Export as FreeShow Project (for setlist) -->
                {#if isList}
                    <button type="button" class="export-option-card" onclick={handleExportFreeShow}>
                        <div class="option-icon-container">
                            <span class="material-symbols-outlined option-icon">slideshow</span>
                        </div>
                        <div class="option-text">
                            <div class="option-title">{t("menu", "export_as")} FreeShow Project</div>
                            <div class="option-desc">{t("share", "export_freeshow_desc")}</div>
                        </div>
                        <span class="material-symbols-outlined download-icon">download</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>

    <div slot="actions">
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>{t("common", "close")}</md-text-button>
    </div>
</md-dialog>

<style>
    .share-headline {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .headline-icon {
        color: var(--md-sys-color-primary, #6750a4);
        font-size: 26px;
    }

    .share-dialog-content {
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-width: 280px;
        max-width: 480px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .section-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
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
        font-size: 0.9rem;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .toggle-desc {
        font-size: 0.75rem;
        color: var(--md-sys-color-on-surface-variant, #49454f);
    }

    .loading-state {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 0;
    }

    .loading-text {
        font-size: 0.85rem;
        color: var(--md-sys-color-on-surface-variant, #49454f);
    }

    .error-state {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background-color: var(--md-sys-color-error-container, #ffdad6);
        color: var(--md-sys-color-on-error-container, #410002);
        border-radius: 8px;
        font-size: 0.85rem;
    }

    .url-input-row {
        width: 100%;
    }

    .share-url-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        font-size: 0.85rem;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 8px;
        background-color: var(--md-sys-color-surface-container-highest, #e6e0e9);
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-family: inherit;
        outline: none;
    }

    .share-url-input:focus {
        border-color: var(--md-sys-color-primary, #6750a4);
    }

    .share-actions-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .copy-button {
        flex: 1;
        min-width: 150px;
    }

    .media-notice {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        background-color: var(--md-sys-color-surface-container, #f3edf7);
        color: var(--md-sys-color-on-surface-variant, #49454f);
        font-size: 0.8rem;
        line-height: 1.35;
    }

    .notice-icon {
        font-size: 18px;
        color: var(--md-sys-color-primary, #6750a4);
        flex-shrink: 0;
        margin-top: 1px;
    }

    .export-options-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .export-option-card {
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
        transition: background-color 0.15s ease;
    }

    .export-option-card:hover {
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

    .download-icon {
        font-size: 20px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        opacity: 0.7;
    }
</style>
