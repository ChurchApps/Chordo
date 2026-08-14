<script lang="ts">
    import type { SongKeys } from "../../lib/models/Song"
    import { goBack, menuState, updatePageTitle } from "../../lib/state/menu.svelte"
    import { FileSystem } from "../../lib/storage/FileSystem"
    import storage from "../../lib/storage/StorageManager.svelte"
    import { importMediaFilesToSong, moveSongImage, removeSongImage, rotateSongImage } from "../../lib/utils/mediaManager"
    import ProgressDialog from "../popups/ProgressDialog.svelte"

    let song = $derived(storage.getSongById(menuState.contentId, storage.songs))
    let name = $derived(song?.name || "")

    let currentSongName = ""
    let fileInputEl = $state<HTMLInputElement | null>(null)
    let imageWebUrls = $state<string[]>([])

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

    function updateValue(e: Event, key: keyof SongKeys) {
        const value = (e.target as HTMLInputElement).value
        if (!song) return

        if (key === "name" && !value.trim()) return
        if (key === "createdAt" || key === "drawings" || key === "images") return

        song[key] = value

        storage.persist()

        if (key === "name") {
            if (currentSongName !== value) updatePageTitle(value)
            currentSongName = value
        }
    }

    async function handleAddMedia(e: Event) {
        const input = e.target as HTMLInputElement
        if (!input.files || input.files.length === 0 || !song) return

        const files = Array.from(input.files)
        const hasPdf = files.some((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))

        if (hasPdf) {
            isConvertingPdf = true
            conversionMessage = "Preparing PDF..."
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
</script>

<main>
    <div style="display: flex;flex-direction: column;flex: 1;padding: 30px;padding-bottom: 93px;">
        {#if song}
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <!-- Title -->
                <md-outlined-text-field id="song-name-input" label="Title" placeholder="e.g. Amazing Grace" value={name} oninput={(e: Event) => updateValue(e, "name")} style="flex: 1;"> </md-outlined-text-field>
                <!-- Artist (dropdown) -->
                <md-outlined-text-field id="song-artist-input" label="Artist" placeholder="e.g. John Newton" value={song.artist} oninput={(e: Event) => updateValue(e, "artist")} style="flex: 1;"> </md-outlined-text-field>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <!-- Key (dropdown) -->
                <md-outlined-text-field id="song-key-input" label="Key" placeholder="e.g. G" value={song.key} oninput={(e: Event) => updateValue(e, "key")} style="flex: 1;"> </md-outlined-text-field>
                <!-- Tempo -->
                <md-outlined-text-field id="song-tempo-input" label="Tempo" placeholder="e.g. 120" value={song.tempo} oninput={(e: Event) => updateValue(e, "tempo")} style="flex: 1;"> </md-outlined-text-field>
            </div>

            <md-outlined-text-field
                type="textarea"
                label="Content"
                placeholder={"[G]Amazing [G7]grace\nHow [C]sweet the [G]sound\n..."}
                rows={8}
                value={song.content}
                oninput={(e: Event) => updateValue(e, "content")}
                style="width: 100%;margin-top: 10px;{song.images ? '' : 'flex: 1;'}"
            >
            </md-outlined-text-field>

            <input type="file" accept="image/*,application/pdf,.pdf" multiple bind:this={fileInputEl} onchange={handleAddMedia} style="display: none;" />

            {#if song.images && song.images.length > 0}
                <div class="images-section-header">
                    <span class="section-title">Media Pages ({song.images.length})</span>
                    <md-outlined-button type="button" onclick={() => fileInputEl?.click()}>
                        <md-icon slot="icon">add_photo_alternate</md-icon>
                        Add Media / PDF
                    </md-outlined-button>
                </div>

                <div class="images-grid">
                    {#each imageWebUrls as imageSrc, idx}
                        <div class="image-edit-card">
                            <div class="card-header">
                                <span class="page-badge">Page {idx + 1}</span>
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
                                <img src={imageSrc} alt={"Page " + (idx + 1)} />
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div style="margin-top: 10px;">
                    <md-outlined-button type="button" onclick={() => fileInputEl?.click()}>
                        <md-icon slot="icon">add_photo_alternate</md-icon>
                        Add Media / PDF Pages
                    </md-outlined-button>
                </div>
            {/if}
        {/if}
    </div>
</main>

<ProgressDialog
    open={isConvertingPdf}
    title="Converting PDF"
    icon="picture_as_pdf"
    detail={conversionFileName}
    message={conversionMessage}
    progress={conversionProgress}
    indeterminate={isIndeterminate}
/>

<div class="fab-container">
    <md-fab aria-label="Done" onclick={goBack}>
        <span class="material-symbols-outlined" slot="icon">check</span>
    </md-fab>
</div>

<style>
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
