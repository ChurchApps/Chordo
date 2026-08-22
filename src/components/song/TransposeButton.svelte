<script lang="ts">
    import { calculateTransposeSemitones, hasTransposableContent } from "$lib/chords/transpose"
    import { t } from "$lib/state/i18n.svelte"
    import { getCurrentSong, setActivePopup } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let activeSongContext = $derived(storage.songs && storage.lists ? getCurrentSong() : null)
    let currentSong = $derived(activeSongContext?.song ?? null)
    let canTranspose = $derived(currentSong ? hasTransposableContent(currentSong.content, currentSong.getMetadata("key"), currentSong.images) : false)

    let transposeCount = $derived.by(() => {
        if (!currentSong) return 0
        return calculateTransposeSemitones({
            targetKey: activeSongContext?.listItem?.transposed,
            lastTransposed: currentSong.lastTransposed,
            songKey: currentSong.getMetadata("key"),
            content: currentSong.content
        })
    })
</script>

<div class="action-btn-wrapper">
    <md-icon-button
        aria-label={t("transpose", "title")}
        title={t("transpose", "title")}
        disabled={!canTranspose}
        onclick={() => setActivePopup("transpose")}
    >
        <span class="material-symbols-outlined">swap_vert</span>
    </md-icon-button>
    {#if transposeCount !== 0}
        <span class="badge" class:negative={transposeCount < 0}>
            {transposeCount > 0 ? "+" + transposeCount : transposeCount}
        </span>
    {/if}
</div>

<style>
    .action-btn-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .badge {
        position: absolute;
        bottom: 6px;
        right: 4px;
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        font-size: 0.65rem;
        font-weight: 700;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 9999px;
        pointer-events: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        font-variant-numeric: tabular-nums;
    }
</style>
