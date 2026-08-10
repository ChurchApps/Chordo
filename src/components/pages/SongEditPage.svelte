<script lang="ts">
    import type { SongKeys } from "../../lib/models/Song"
    import { Song } from "../../lib/models/Song"
    import { goBack, menuState, updatePageTitle } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"

    let song = $derived(storage.getSongById(menuState.contentId, storage.songs))
    let name = $derived(song?.name || "")

    let currentSongName = ""
    let fileInputEl = $state<HTMLInputElement | null>(null)

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

    async function handleRotateImage(index: number) {
        if (!song) return
        await song.rotateImage(index)
        storage.persist()
        storage.songs = storage.songs.map((s) => (s.id === song.id ? new Song(s as any) : s))
    }

    function handleMoveImage(fromIndex: number, toIndex: number) {
        if (!song) return
        song.moveImage(fromIndex, toIndex)
        storage.persist()
        storage.songs = storage.songs.map((s) => (s.id === song.id ? new Song(s as any) : s))
    }

    function handleRemoveImage(index: number) {
        if (!song) return
        song.removeImage(index)
        storage.persist()
        storage.songs = storage.songs.map((s) => (s.id === song.id ? new Song(s as any) : s))
    }

    function readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    async function handleAddImages(e: Event) {
        const input = e.target as HTMLInputElement
        if (!input.files || input.files.length === 0 || !song) return

        const files = Array.from(input.files)
        try {
            const dataUrls = await Promise.all(files.map((file) => readFileAsDataURL(file)))
            dataUrls.forEach((url) => song.addImage(url))

            storage.persist()
            storage.songs = storage.songs.map((s) => (s.id === song.id ? new Song(s as any) : s))
        } catch (err) {
            console.error("Failed to add image files:", err)
        }

        input.value = ""
    }

    // const options = [
    //     { type: "text", label: "Text (ChordPro)", description: "Any text should work, but ChordPro formatted text works best." },
    //     { type: "media", label: "Media / Images", description: "JPG, PNG, WEBP, GIF, SVG, etc." },
    //     { type: "web", label: "Website", description: "Link to any website with the song." }
    // ] as const
    // type OptionType = (typeof options)[number]["type"]
    // let chosenType = $state<OptionType | null>(null)

    // function chooseType(type: OptionType) {
    //     chosenType = type

    //     if (type === "text") {
    //         setTimeout(() => {
    //             const inputField = document.getElementById("song-name-input")
    //             if (inputField) inputField.focus()
    //         }, 0)
    //     }
    // }
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

            <!-- {#if !song.content && !song.images.length}
                <div class="list" style="margin-top: 10px;">
                    {#each options as option}
                        <md-list-item type="button" onclick={() => chooseType(option.type)}>
                            <div slot="headline">{option.label}</div>
                            <div slot="supporting-text">{option.description}</div>
                            <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                        </md-list-item>
                    {/each}
                </div>
            {:else} -->
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

            <input type="file" accept="image/*" multiple bind:this={fileInputEl} onchange={handleAddImages} style="display: none;" />

            {#if song.images && song.images.length > 0}
                <div class="images-section-header">
                    <span class="section-title">Image Pages ({song.images.length})</span>
                    <md-outlined-button type="button" onclick={() => fileInputEl?.click()}>
                        <md-icon slot="icon">add_photo_alternate</md-icon>
                        Add Images
                    </md-outlined-button>
                </div>

                <div class="images-grid">
                    {#each song.images as imageSrc, idx}
                        <div class="image-edit-card">
                            <div class="card-header">
                                <span class="page-badge">Page {idx + 1}</span>
                                <div class="card-actions">
                                    <md-icon-button type="button" onclick={() => handleRotateImage(idx)}>
                                        <md-icon>rotate_right</md-icon>
                                    </md-icon-button>
                                    <md-icon-button type="button" disabled={idx === 0} onclick={() => handleMoveImage(idx, idx - 1)}>
                                        <md-icon>arrow_upward</md-icon>
                                    </md-icon-button>
                                    <md-icon-button type="button" disabled={idx === song.images.length - 1} onclick={() => handleMoveImage(idx, idx + 1)}>
                                        <md-icon>arrow_downward</md-icon>
                                    </md-icon-button>
                                    <md-icon-button type="button" onclick={() => handleRemoveImage(idx)}>
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
                        Add Image Pages
                    </md-outlined-button>
                </div>
            {/if}
        {/if}
    </div>
</main>

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
