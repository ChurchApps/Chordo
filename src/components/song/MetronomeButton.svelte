<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { getCurrentSong, setActivePopup } from "$lib/state/menu.svelte"
    import { metronomeState, startMetronome, stopMetronome } from "$lib/state/metronome.svelte"
    import storage from "$lib/storage/StorageManager.svelte"

    let activeSongContext = $derived(storage.songs && storage.lists ? getCurrentSong() : null)
    let currentSong = $derived(activeSongContext?.song ?? null)

    let songTempo = $derived(Number(currentSong?.getMetadata?.("tempo")?.match(/\d+/)?.[0]) || null)
    let songTimeSig = $derived(Number(currentSong?.getMetadata?.("timeSignature")?.match(/^(\d+)/)?.[1]) || null)

    $effect(() => {
        if (!metronomeState.isPlaying && currentSong?.id) {
            metronomeState.bpm = songTempo || 120
            metronomeState.beatsPerBar = songTimeSig || 4
        }
    })

    function handleClick() {
        setActivePopup("metronome")
    }
</script>

<div class="action-btn-wrapper">
    <md-icon-button
        aria-label={t("metronome", "title")}
        title={t("metronome", "title")}
        onclick={handleClick}
        class:is-active={metronomeState.isPlaying}
    >
        <span class="material-symbols-outlined icon" class:beating={metronomeState.isPlaying}>timer</span>
    </md-icon-button>

    {#if metronomeState.isPlaying}
        <span class="badge">
            {metronomeState.bpm}
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

    .is-active {
        --md-icon-button-icon-color: var(--md-sys-color-primary, #f5aa67);
        color: var(--md-sys-color-primary, #f5aa67);
    }

    .icon.beating {
        animation: pulse 0.3s ease;
    }

    @keyframes pulse {
        0% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.15);
        }
        100% {
            transform: scale(1);
        }
    }
</style>
