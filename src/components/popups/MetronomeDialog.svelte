<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { getCurrentSong, setActivePopup } from "$lib/state/menu.svelte"
    import { metronomeState, setMetronomeBeatsPerBar, setMetronomeBpm, setMetronomeSoundType, toggleMetronome, type MetronomeSoundType } from "$lib/state/metronome.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import "@material/web/button/filled-button.js"
    import "@material/web/button/filled-tonal-button.js"
    import "@material/web/button/text-button.js"
    import "@material/web/dialog/dialog.js"
    import "@material/web/select/outlined-select.js"
    import "@material/web/select/select-option.js"
    import "@material/web/slider/slider.js"

    let activeSongContext = $derived(storage.songs && storage.lists ? getCurrentSong() : null)
    let song = $derived(activeSongContext?.song ?? null)
    let songTempo = $derived(Number(song?.getMetadata?.("tempo")?.match(/\d+/)?.[0]) || null)
    let songTimeSig = $derived(Number(song?.getMetadata?.("timeSignature")?.match(/^(\d+)/)?.[1]) || null)

    let tapTimes: number[] = []
    let tapTimeout: ReturnType<typeof setTimeout> | undefined

    function handleTap() {
        const now = performance.now()
        tapTimes.push(now)
        clearTimeout(tapTimeout)
        tapTimeout = setTimeout(() => (tapTimes = []), 2500)
        if (tapTimes.length > 5) tapTimes.shift()

        if (tapTimes.length >= 2) {
            const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i])
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
            if (avg > 0) setMetronomeBpm(Math.round(60000 / avg))
        }
    }

    function closeDialog() {
        setActivePopup(null)
    }

    function resetToSongDefaults() {
        setMetronomeBpm(songTempo || 120)
        setMetronomeBeatsPerBar(songTimeSig || 4)
    }

    const TIME_SIGNATURE_PRESETS = [1, 2, 3, 4, 5, 6, 7]
</script>

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline">
        <div class="dialog-header">
            <span class="material-symbols-outlined headline-icon">timer</span>
            <span>{t("metronome", "title")}</span>
        </div>
    </div>

    <div slot="content" class="dialog-content">
        <!-- Beat Visualizer Dots -->
        <div class="beat-indicators">
            {#each Array(metronomeState.beatsPerBar) as _, i}
                <div class="beat-dot" class:accent={i === 0} class:active={metronomeState.isPlaying && metronomeState.currentBeat === i}></div>
            {/each}
        </div>

        <!-- BPM Stepper Row -->
        <div class="stepper-row">
            <div class="step-buttons">
                <md-filled-tonal-button onclick={() => setMetronomeBpm(metronomeState.bpm - 1)} class="step-btn">
                    <span class="material-symbols-outlined" slot="icon">remove</span>
                    1
                </md-filled-tonal-button>
                <!-- <md-filled-tonal-button onclick={() => setMetronomeBpm(metronomeState.bpm - 5)} class="step-btn">
                    <span class="material-symbols-outlined" slot="icon">remove</span>
                    5
                </md-filled-tonal-button> -->
            </div>

            <div class="current-bpm-display">
                <span class="bpm-label">{t("metronome", "bpm")}</span>
                <span class="bpm-value">{metronomeState.bpm}</span>
                {#if songTempo && songTempo !== metronomeState.bpm}
                    <span class="song-hint">{t("metronome", "song_tempo")}: {songTempo}</span>
                {/if}
            </div>

            <div class="step-buttons">
                <md-filled-tonal-button onclick={() => setMetronomeBpm(metronomeState.bpm + 1)} class="step-btn">
                    <span class="material-symbols-outlined" slot="icon">add</span>
                    1
                </md-filled-tonal-button>
                <!-- <md-filled-tonal-button onclick={() => setMetronomeBpm(metronomeState.bpm + 5)} class="step-btn">
                    <span class="material-symbols-outlined" slot="icon">add</span>
                    5
                </md-filled-tonal-button> -->
            </div>
        </div>

        <!-- BPM Slider with Tap Tempo Icon on the left -->
        <div class="slider-row">
            <button type="button" class="tap-icon-btn" onclick={handleTap} title="Tap tempo" aria-label="Tap tempo">
                <span class="material-symbols-outlined">touch_app</span>
            </button>
            <div class="slider-container">
                <md-slider min="30" max="260" value={metronomeState.bpm} step="1" labeled oninput={(e: Event) => setMetronomeBpm(Number((e.target as HTMLInputElement).value) || metronomeState.bpm)} class="bpm-slider"></md-slider>
            </div>
        </div>

        <!-- Time Signature / Beats per Bar -->
        <div class="time-sig-section">
            <span class="section-label">{t("metronome", "time_signature")}</span>
            <div class="time-sig-grid">
                {#each TIME_SIGNATURE_PRESETS as b}
                    <button type="button" class="sig-chip" class:selected={metronomeState.beatsPerBar === b} onclick={() => setMetronomeBeatsPerBar(b)}>
                        {b}/4
                    </button>
                {/each}
                <button type="button" class="sig-chip" class:selected={metronomeState.beatsPerBar === 8} onclick={() => setMetronomeBeatsPerBar(8)}> 6/8 </button>
            </div>
        </div>

        <!-- Sound Selection Dropdown -->
        <div class="sound-section">
            <span class="section-label">{t("metronome", "sound")}</span>
            <md-outlined-select
                value={metronomeState.soundType}
                onchange={(e: Event) => {
                    const target = e.target as HTMLSelectElement
                    if (target?.value) setMetronomeSoundType(target.value as MetronomeSoundType)
                }}
                class="sound-select"
            >
                <md-select-option value="digital" selected={metronomeState.soundType === "digital"}>
                    <div slot="headline">Digital</div>
                </md-select-option>
                <md-select-option value="metal" selected={metronomeState.soundType === "metal"}>
                    <div slot="headline">Metal</div>
                </md-select-option>
                <md-select-option value="silent" selected={metronomeState.soundType === "silent"}>
                    <div slot="headline">Silent</div>
                </md-select-option>
            </md-outlined-select>
        </div>

        <!-- Play / Stop Button -->
        <button type="button" class="play-toggle-btn" class:playing={metronomeState.isPlaying} onclick={() => toggleMetronome()}>
            <span class="material-symbols-outlined play-icon">
                {metronomeState.isPlaying ? "stop" : "play_arrow"}
            </span>
            <span>{metronomeState.isPlaying ? t("metronome", "stop") : t("metronome", "start")}</span>
        </button>
    </div>

    <div slot="actions">
        <md-text-button onclick={resetToSongDefaults}>{t("common", "reset")}</md-text-button>
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
        gap: 16px;
        padding-top: 6px;
        min-width: 280px;
        max-width: 380px;
    }

    .beat-indicators {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        min-height: 24px;
        padding: 4px 0;
    }

    .beat-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--md-sys-color-surface-container-high, #e0e0e0);
        border: 2px solid var(--md-sys-color-outline-variant, #cac4d0);
        transition:
            transform 0.08s ease,
            background 0.08s ease,
            box-shadow 0.08s ease;
    }

    .beat-dot.accent {
        width: 16px;
        height: 16px;
        border-color: var(--md-sys-color-primary, #6750a4);
    }

    .beat-dot.active {
        background: var(--md-sys-color-primary, #6750a4);
        border-color: var(--md-sys-color-primary, #6750a4);
        transform: scale(1.25);
        box-shadow: 0 0 8px var(--md-sys-color-primary, #6750a4);
    }

    .beat-dot.accent.active {
        background: var(--md-sys-color-primary, #6750a4);
        border-color: var(--md-sys-color-primary, #6750a4);
        transform: scale(1.45);
        box-shadow: 0 0 14px var(--md-sys-color-primary, #6750a4);
    }

    .stepper-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .step-buttons {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .step-btn {
        --md-filled-tonal-button-container-height: 36px;
        min-width: 64px;
        font-size: 0.85rem;
    }

    .current-bpm-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 90px;
    }

    .bpm-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--md-sys-color-outline, #79747e);
        letter-spacing: 0.5px;
    }

    .bpm-value {
        font-size: 2.2rem;
        font-weight: 700;
        color: var(--md-sys-color-primary, #6750a4);
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
    }

    .song-hint {
        font-size: 0.72rem;
        color: var(--md-sys-color-outline, #79747e);
    }

    .slider-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
    }

    .tap-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-low, #f7f2fa);
        color: var(--md-sys-color-on-surface, #1d1b20);
        cursor: pointer;
        user-select: none;
        flex-shrink: 0;
        transition:
            background 0.15s ease,
            transform 0.08s ease;
    }

    .tap-icon-btn:active {
        transform: scale(0.92);
        background: var(--md-sys-color-surface-container-high, #ece6f0);
    }

    .tap-icon-btn .material-symbols-outlined {
        font-size: 22px;
    }

    .slider-container {
        flex: 1;
        margin-top: -4px;
        margin-bottom: -4px;
    }

    .bpm-slider {
        width: 100%;
        --md-slider-active-track-color: var(--md-sys-color-primary, #6750a4);
        --md-slider-handle-color: var(--md-sys-color-primary, #6750a4);
    }

    .play-toggle-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 48px;
        border-radius: 12px;
        border: none;
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    .play-toggle-btn.playing {
        background: var(--md-sys-color-error, #ba1a1a);
        color: var(--md-sys-color-on-error, #ffffff);
    }

    .play-toggle-btn:active {
        transform: scale(0.97);
    }

    .play-icon {
        font-size: 24px;
    }

    .sound-section,
    .time-sig-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .sound-select {
        width: 100%;
    }

    .section-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--md-sys-color-on-surface, #1d1b20);
        opacity: 0.8;
    }

    .time-sig-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
    }

    .sig-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-low, #f7f2fa);
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .sig-chip:hover {
        background: var(--md-sys-color-surface-container-high, #ece6f0);
    }

    .sig-chip.selected {
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        border-color: var(--md-sys-color-primary, #6750a4);
    }
</style>
