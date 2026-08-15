<script lang="ts">
    import { extractBaseKey, getNotePitchIndex, getScaleForOriginalKey, transposeNote } from "$lib/chords/transpose"
    import { t } from "$lib/state/i18n.svelte"
    import { getCurrentSong, setActivePopup } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let activeSongContext = $derived(storage.songs && storage.lists ? getCurrentSong() : null)
    let song = $derived(activeSongContext?.song ?? null)
    let list = $derived(activeSongContext?.list ?? null)
    let currentSongIndex = $derived(activeSongContext?.currentSongIndex ?? 0)

    // Base original key of the song
    let originalKey = $derived(extractBaseKey(song?.content, song?.getMetadata("key")) || "C")

    // Determine whether sharp or flat scale should be displayed based on original key
    let displayedScale = $derived(getScaleForOriginalKey(originalKey))
    let preferFlats = $derived(displayedScale.includes("Eb"))

    // Currently selected / effective key
    let selectedKey = $state<string>("")

    // Enharmonic pitch indices for accurate matching
    let selectedPitchIndex = $derived(getNotePitchIndex(selectedKey || originalKey))
    let originalPitchIndex = $derived(getNotePitchIndex(originalKey))

    // Display formatted selected key based on original scale preference
    let displayedSelectedKey = $derived.by(() => {
        if (selectedPitchIndex !== -1 && displayedScale[selectedPitchIndex]) {
            return displayedScale[selectedPitchIndex]
        }
        return selectedKey || originalKey
    })

    $effect(() => {
        const listTransposed = activeSongContext?.listItem?.transposed
        selectedKey = listTransposed || song?.lastTransposed || originalKey
    })

    function closeDialog() {
        setActivePopup(null)
    }

    function applyKey(newKey: string) {
        selectedKey = newKey
        if (!song) return

        song.lastTransposed = newKey

        if (list && list.songs.length > 0) {
            list.setSongTransposed(currentSongIndex, newKey)
        }

        storage.updateSong(song)
        storage.refreshSongs()
        storage.refreshLists()
    }

    function stepSemitone(delta: number) {
        const currentNorm = displayedSelectedKey || originalKey
        const nextKey = transposeNote(currentNorm, delta, preferFlats)
        applyKey(nextKey)
    }

    function resetToOriginal() {
        applyKey(originalKey)
    }
</script>

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline">
        <div class="dialog-header">
            <span class="material-symbols-outlined headline-icon">swap_vert</span>
            <span>{t("transpose", "title")}</span>
        </div>
    </div>

    <div slot="content" class="dialog-content">
        <div class="stepper-row">
            <md-filled-tonal-button onclick={() => stepSemitone(-1)}>
                <span class="material-symbols-outlined" slot="icon">remove</span>
                -1
            </md-filled-tonal-button>

            <div class="current-key-display">
                <span class="key-label">{t("transpose", "key")}</span>
                <span class="key-value">{displayedSelectedKey}</span>
                {#if originalKey && selectedPitchIndex !== originalPitchIndex}
                    <span class="original-hint">{t("transpose", "original")}: {originalKey}</span>
                {/if}
            </div>

            <md-filled-tonal-button onclick={() => stepSemitone(1)}>
                <span class="material-symbols-outlined" slot="icon">add</span>
                +1
            </md-filled-tonal-button>
        </div>

        <div class="keys-grid">
            {#each displayedScale as note}
                {@const pitchIndex = getNotePitchIndex(note)}
                {@const isSelected = selectedPitchIndex === pitchIndex}
                {@const isOriginal = originalPitchIndex === pitchIndex}
                <button type="button" class="key-chip" class:selected={isSelected} class:original={isOriginal && !isSelected} onclick={() => applyKey(note)}>
                    {note}
                </button>
            {/each}
        </div>
    </div>

    <div slot="actions">
        <md-text-button onclick={resetToOriginal}>{t("common", "reset")}</md-text-button>
        <md-filled-button onclick={closeDialog}>{t("common", "done")}</md-filled-button>
    </div>
</md-dialog>

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--md-sys-color-on-surface, #2b2930);
        font-size: 1.35rem;
    }

    .headline-icon {
        color: var(--md-sys-color-primary);
    }

    .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-top: 10px;
        min-width: 280px;
        max-width: 380px;
    }

    .stepper-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .current-key-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 90px;
    }

    .key-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--md-sys-color-outline, #79747e);
        letter-spacing: 0.5px;
    }

    .key-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--md-sys-color-primary, #6750a4);
        line-height: 1.1;
    }

    .original-hint {
        font-size: 0.75rem;
        color: var(--md-sys-color-outline, #79747e);
    }

    .keys-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
    }

    .key-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 42px;
        border-radius: 8px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-low, #f7f2fa);
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .key-chip:hover {
        background: var(--md-sys-color-surface-container-high, #ece6f0);
    }

    .key-chip.selected {
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        border-color: var(--md-sys-color-primary, #6750a4);
    }

    .key-chip.original {
        border: 2px dashed var(--md-sys-color-primary, #6750a4);
    }
</style>
