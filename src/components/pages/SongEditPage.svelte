<script lang="ts">
    import { extractAndCleanSongMetadata } from "$lib/chords/chordproConverter"
    import { METADATA_CONFIGS } from "$lib/chords/metadata"
    import { extractBaseKey, isValidKey } from "$lib/chords/transpose"
    import type { SongKeys } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import { goBack, menuState, updatePageTitle } from "$lib/state/menu.svelte"
    import { FileSystem } from "$lib/storage/FileSystem"
    import storage from "$lib/storage/StorageManager.svelte"
    import { importMediaFilesToSong, moveSongImage, removeSongImage, rotateSongImage } from "$lib/utils/mediaManager"
    import { cleanPlaybackUrl, openExternalPlayback, parsePlaybackUrl } from "$lib/utils/playback"
    import { pullAndConvertUrl } from "$lib/utils/webPuller"
    import ProgressDialog from "../popups/ProgressDialog.svelte"

    let song = $derived(storage.getSongById(menuState.contentId, storage.songs))
    let playbackUrlValue = $derived(song?.playbackUrl || song?.spotify || song?.getMetadata("playback") || song?.getMetadata("spotify") || "")
    let playbackInfo = $derived(parsePlaybackUrl(playbackUrlValue))

    let currentSongName = ""
    let fileInputEl = $state<HTMLInputElement | null>(null)
    let imageWebUrls = $state<string[]>([])

    // URL Pull State
    let urlInput = $state("")
    let isPulling = $state(false)
    let pullError = $state("")

    // PDF Conversion Progress State
    let isConvertingPdf = $state(false)
    let conversionMessage = $state("Converting PDF...")
    let conversionFileName = $state("")
    let conversionProgress = $state(0)
    let isIndeterminate = $state(true)

    $effect(() => {
        if (song?.images && song.images.length > 0) {
            Promise.all(song.images.map((img) => FileSystem.resolveImageUrl(img))).then((urls) => {
                imageWebUrls = urls
            })
        } else {
            imageWebUrls = []
        }
    })

    function syncMetadataFromText(rawText: string) {
        if (!song || !rawText.trim()) return
        const { cleanContent, metadata } = extractAndCleanSongMetadata(rawText)

        if (cleanContent && cleanContent !== song.content) {
            song.content = cleanContent
        }

        if (metadata.title && (!song.name || song.name === "Untitled")) {
            song.name = metadata.title
            if (currentSongName !== metadata.title) updatePageTitle(metadata.title)
            currentSongName = metadata.title
        }

        for (const cfg of METADATA_CONFIGS) {
            const val = metadata[cfg.key]
            if (val && !song.getMetadata(cfg.key)) {
                song.setMetadata(cfg.key, val)
            }
        }

        const rawPlayback = metadata.playback || metadata.spotify || metadata.youtube
        if (rawPlayback && !song.playbackUrl) {
            const cleaned = cleanPlaybackUrl(rawPlayback)
            song.playbackUrl = cleaned
            song.spotify = cleaned
            song.setMetadata("playback", cleaned)
        }

        if (!song.getMetadata("key") || !isValidKey(song.getMetadata("key"))) {
            const detectedKey = extractBaseKey(rawText, metadata.key)
            if (detectedKey) song.setMetadata("key", detectedKey)
        }
    }

    function updateValue(e: Event, key: keyof SongKeys) {
        const value = (e.target as HTMLInputElement).value
        if (!song || !key) return

        if (key === "name" && !value.trim()) return
        if (key === "createdAt" || key === "drawings" || key === "images" || key === "metadata" || key === "lastTransposed") return

        song[key] = value

        if (key === "content" && value.trim()) {
            syncMetadataFromText(value)
        }

        storage.persist()

        if (key === "name") {
            if (currentSongName !== value) updatePageTitle(value)
            currentSongName = value
        }
    }

    function updateMetadataValue(e: Event, metaKey: string) {
        const value = (e.target as HTMLInputElement).value
        if (!song) return
        const cleaned = metaKey === "playback" || metaKey === "spotify" ? cleanPlaybackUrl(value) : value
        song.setMetadata(metaKey, cleaned)
        if (metaKey === "playback" || metaKey === "spotify") {
            song.playbackUrl = cleaned
            song.spotify = cleaned
        }
        storage.persist()
    }

    function updatePlaybackValue(e: Event) {
        const input = e.target as HTMLInputElement
        const value = input.value
        if (!song) return
        const cleaned = cleanPlaybackUrl(value)
        if (cleaned && cleaned !== value && parsePlaybackUrl(value)) {
            input.value = cleaned
        }
        song.playbackUrl = cleaned
        song.spotify = cleaned
        song.setMetadata("playback", cleaned)
        storage.persist()
    }

    async function pullWebpageContent() {
        const targetUrl = urlInput.trim()
        if (!targetUrl || !song) return
        isPulling = true
        pullError = ""

        try {
            const result = await pullAndConvertUrl(targetUrl)
            song.content = result.content
            song.url = targetUrl

            if (result.title && (!song.name || song.name === "Untitled")) {
                song.name = result.title
                updatePageTitle(result.title)
            }

            for (const cfg of METADATA_CONFIGS) {
                const val = (result as any)[cfg.key]
                if (val && !song.getMetadata(cfg.key)) {
                    song.setMetadata(cfg.key, val)
                }
            }

            const rawPlayback = (result as any).playback || (result as any).spotify
            if (rawPlayback && !song.playbackUrl) {
                const cleaned = cleanPlaybackUrl(rawPlayback)
                song.playbackUrl = cleaned
                song.spotify = cleaned
                song.setMetadata("playback", cleaned)
            }

            storage.updateSong(song)
            storage.persist()
            urlInput = ""
        } catch (err: any) {
            console.error("Failed to pull webpage content:", err)
            pullError = err?.message || t("song_edit", "pull_error_default")
        } finally {
            isPulling = false
        }
    }

    async function handleAddMedia(e: Event) {
        const input = e.target as HTMLInputElement
        if (!input.files || input.files.length === 0 || !song) return

        const files = Array.from(input.files)
        const hasPdf = files.some((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))

        if (hasPdf) {
            isConvertingPdf = true
            conversionMessage = t("song_edit", "preparing_pdf")
            conversionFileName = files[0].name
            conversionProgress = 0
            isIndeterminate = true
        }

        try {
            await importMediaFilesToSong(song, files, (status) => {
                isConvertingPdf = true
                conversionFileName = status.fileName
                conversionMessage = status.message
                if (status.totalPages > 0) {
                    conversionProgress = status.currentPage / status.totalPages
                    isIndeterminate = false
                } else {
                    isIndeterminate = true
                }
            })
        } catch (err) {
            console.error("Failed to import media files:", err)
        } finally {
            isConvertingPdf = false
            input.value = ""
        }
    }

    function trimUrl(url: string): string {
        try {
            const parsedUrl = new URL(url)
            const hostname = parsedUrl.hostname.replace(/^www\./, "")
            return hostname + parsedUrl.pathname
        } catch {
            return url
        }
    }
</script>

<main>
    <div style="display: flex;flex-direction: column;flex: 1;padding: 30px;padding-bottom: 93px;">
        {#if song}
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <!-- Title -->
                <md-outlined-text-field id="song-name-input" label={t("song_edit", "title")} placeholder={t("song_edit", "title_placeholder")} value={song.name} oninput={(e: Event) => updateValue(e, "name")} style="flex: 1;"> </md-outlined-text-field>
            </div>

            <!-- Dynamic Metadata Inputs Grid (includes Artist, Key, Tempo, Time, Album, Year, Composer, Copyright, Capo) -->
            <div class="metadata-grid">
                {#each METADATA_CONFIGS as cfg}
                    <md-outlined-text-field id={"song-meta-" + cfg.key} label={cfg.label} placeholder={cfg.placeholder} value={song.getMetadata(cfg.key)} oninput={(e: Event) => updateMetadataValue(e, cfg.key)} style="flex: 1; min-width: 140px;">
                    </md-outlined-text-field>
                {/each}
            </div>

            <!-- Playback URL Section -->
            <div class="playback-section">
                <div class="playback-input-row">
                    <md-outlined-text-field
                        id="song-playback-input"
                        label={t("song_edit", "playback_url")}
                        placeholder={t("song_edit", "playback_url_placeholder")}
                        value={playbackUrlValue}
                        oninput={updatePlaybackValue}
                        style="flex: 1;"
                    >
                        <span slot="leading-icon" style="display: inline-flex; align-items: center; justify-content: center;">
                            {#if playbackInfo?.provider === "spotify"}
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954">
                                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.307c-.216.353-.674.466-1.027.25-2.822-1.724-6.374-2.115-10.559-1.159-.404.093-.807-.16-.9-.564-.092-.404.161-.807.564-.9 4.582-1.047 8.514-.606 11.672 1.346.353.216.466.674.25 1.027zm1.465-3.262c-.272.441-.849.582-1.29.31-3.23-1.986-8.155-2.56-11.977-1.4-4.99.151-.989-.138-1.14-.637-.152-.499.138-.989.637-1.14 4.381-1.33 9.807-.687 13.46 1.577.441.272.582.849.31 1.29zm.126-3.41c-3.874-2.3-10.264-2.512-13.97-1.386-.595.181-1.226-.157-1.407-.752-.181-.595.157-1.226.752-1.407 4.257-1.293 11.31-1.045 15.772 1.603.535.318.708 1.01.39 1.545-.318.535-1.01.708-1.545.39z"/>
                                </svg>
                            {:else if playbackInfo?.provider === "youtube"}
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                            {:else}
                                <md-icon>play_circle</md-icon>
                            {/if}
                        </span>
                    </md-outlined-text-field>

                    {#if playbackUrlValue.trim()}
                        <md-outlined-button type="button" onclick={() => openExternalPlayback(playbackUrlValue)} title={t("song_edit", "open_external")}>
                            <md-icon slot="icon">open_in_new</md-icon>
                            {playbackInfo?.provider === "spotify" ? "Spotify" : playbackInfo?.provider === "youtube" ? "YouTube" : "Link"}
                        </md-outlined-button>
                    {/if}
                </div>
            </div>

            <!-- Existing Source URL Display -->
            {#if song.url}
                <div class="source-url-display">
                    <md-icon style="font-size: 18px; color: #6750a4;">link</md-icon>
                    <span class="url-label">{t("song_edit", "source")}</span>
                    <a href={song.url} target="_blank" rel="noopener noreferrer" class="url-link">
                        {trimUrl(song.url)}
                        <md-icon style="font-size: 14px; margin-left: 2px;">open_in_new</md-icon>
                    </a>
                </div>
            {/if}

            <!-- Import URL Textbox & Pull Button (only shown if content is empty) -->
            {#if !song.content || !song.content.trim()}
                <div class="url-pull-container">
                    <md-outlined-text-field
                        id="song-url-input"
                        label={t("song_edit", "import_url")}
                        placeholder={t("song_edit", "import_url_placeholder")}
                        value={urlInput}
                        oninput={(e: Event) => (urlInput = (e.target as HTMLInputElement).value)}
                        onkeydown={(e: KeyboardEvent) => e.key === "Enter" && pullWebpageContent()}
                        style="flex: 1;"
                    >
                        <md-icon slot="leading-icon">link</md-icon>
                    </md-outlined-text-field>

                    <md-filled-button type="button" onclick={pullWebpageContent} disabled={isPulling || !urlInput.trim()}>
                        <md-icon slot="icon">{isPulling ? "sync" : "download"}</md-icon>
                        {isPulling ? t("song_edit", "pulling") : t("song_edit", "pull")}
                    </md-filled-button>
                </div>

                {#if pullError}
                    <div class="pull-error">{pullError}</div>
                {/if}
            {/if}

            <md-outlined-text-field
                type="textarea"
                label={t("song_edit", "content")}
                placeholder={t("song_edit", "content_placeholder")}
                rows={8}
                value={song.content}
                oninput={(e: Event) => updateValue(e, "content")}
                style="width: 100%;margin-top: 10px;{song.images ? '' : 'flex: 1;'}"
            >
            </md-outlined-text-field>

            <input type="file" accept="image/*,application/pdf,.pdf" multiple bind:this={fileInputEl} onchange={handleAddMedia} style="display: none;" />

            {#if song.images && song.images.length > 0}
                <div class="images-section-header">
                    <span class="section-title">{t("song_edit", "media_pages")} ({song.images.length})</span>
                    <md-outlined-button type="button" onclick={() => fileInputEl?.click()}>
                        <md-icon slot="icon">add_photo_alternate</md-icon>
                        {t("song_edit", "add_media")}
                    </md-outlined-button>
                </div>

                <div class="images-grid">
                    {#each imageWebUrls as imageSrc, idx}
                        <div class="image-edit-card">
                            <div class="card-header">
                                <span class="page-badge">{t("song_edit", "page")} {idx + 1}</span>
                                <div class="card-actions">
                                    <md-icon-button type="button" onclick={() => rotateSongImage(song, idx)}>
                                        <md-icon>rotate_right</md-icon>
                                    </md-icon-button>
                                    <md-icon-button type="button" disabled={idx === 0} onclick={() => moveSongImage(song, idx, idx - 1)}>
                                        <md-icon>arrow_upward</md-icon>
                                    </md-icon-button>
                                    <md-icon-button type="button" disabled={idx === song.images.length - 1} onclick={() => moveSongImage(song, idx, idx + 1)}>
                                        <md-icon>arrow_downward</md-icon>
                                    </md-icon-button>
                                    <md-icon-button type="button" onclick={() => removeSongImage(song, idx)}>
                                        <md-icon>delete</md-icon>
                                    </md-icon-button>
                                </div>
                            </div>
                            <div class="card-preview">
                                <img src={imageSrc} alt={t("song_edit", "page") + " " + (idx + 1)} />
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div style="margin-top: 10px;">
                    <md-outlined-button type="button" onclick={() => fileInputEl?.click()}>
                        <md-icon slot="icon">add_photo_alternate</md-icon>
                        {t("song_edit", "add_media_pages")}
                    </md-outlined-button>
                </div>
            {/if}
        {/if}
    </div>
</main>

<ProgressDialog open={isConvertingPdf} title={t("song_edit", "converting_pdf_title")} icon="picture_as_pdf" detail={conversionFileName} message={conversionMessage} progress={conversionProgress} indeterminate={isIndeterminate} />

<ProgressDialog open={isPulling} title={t("song_edit", "pulling_content_title")} icon="download" detail={urlInput} message={t("song_edit", "fetching_webpage")} progress={0} indeterminate={true} />

<div class="fab-container">
    <md-fab aria-label={t("common", "done")} onclick={goBack}>
        <span class="material-symbols-outlined" slot="icon">check</span>
    </md-fab>
</div>

<style>
    .metadata-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
    }

    .playback-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
    }

    .playback-input-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .source-url-display {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        font-size: 0.85rem;
        color: #49454f;
        padding: 4px 0;
    }

    .url-label {
        font-weight: 600;
        color: #2b2930;
    }

    .url-link {
        display: inline-flex;
        align-items: center;
        color: #6750a4;
        text-decoration: none;
        word-break: break-all;
    }

    .url-link:hover {
        text-decoration: underline;
    }

    .url-pull-container {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
    }

    .pull-error {
        color: #b3261e;
        font-size: 0.85rem;
        margin-top: 4px;
        padding-left: 4px;
    }

    .images-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 24px;
        margin-bottom: 12px;
    }

    .section-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #2b2930;
    }

    .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
        margin-top: 8px;
        max-height: 520px;
        overflow-y: auto;
        padding-right: 4px;
        padding-bottom: 4px;
    }

    .image-edit-card {
        background: #f7f2fa;
        border: 1px solid #e7e0ec;
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .page-badge {
        font-size: 0.8rem;
        font-weight: 700;
        color: #6750a4;
        text-transform: uppercase;
    }

    .card-actions {
        display: flex;
        gap: 2px;

        --md-icon-button-state-layer-width: 32px;
        --md-icon-button-state-layer-height: 32px;
        --md-icon-button-icon-size: 20px;
    }

    .card-preview {
        width: 100%;
        height: 200px;
        background: #ffffff;
        border-radius: 6px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #ddd;
    }

    .card-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
</style>
