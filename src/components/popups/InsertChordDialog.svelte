<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { extractBaseKey, getScaleForOriginalKey, isChordToken } from "$lib/chords/transpose"
    import BaseDialog from "./BaseDialog.svelte"

    interface Props {
        open: boolean
        text?: string
        onInsertChord: (chord: string) => void
        onClose: () => void
    }

    let { open, text = "", onInsertChord, onClose }: Props = $props()

    let showAdvanced = $state(false)
    let selectedRoot = $state("C")
    let selectedType = $state("") // "" means none
    let selectedTension = $state("")
    let selectedBass = $state("C")

    // Musical scale / roots to pick from
    let originalKey = $derived(extractBaseKey(text) || "C")
    let displayedScale = $derived(getScaleForOriginalKey(originalKey))

    // Keep default root aligned with song's key if C is not in scale, or initially set
    $effect(() => {
        if (open && originalKey) {
            selectedRoot = originalKey
            selectedBass = originalKey
        }
    })

    // Collect all existing unique chords in song content
    let existingChords = $derived.by(() => {
        if (!text) return []
        const found = new Set<string>()

        // 1. Bracketed tokens: [A], [F#m7], [C/G], etc.
        const bracketMatches = text.matchAll(/\[([^\]\n]+)\]/g)
        for (const m of bracketMatches) {
            const raw = m[1].trim()
            // Could contain multiple spaced chords like [C G/B Am]
            const tokens = raw
                .split(/[\s|]+/)
                .map((t) => t.trim())
                .filter(Boolean)
            for (const t of tokens) {
                if (isChordToken(t)) {
                    found.add(t)
                }
            }
        }

        // 2. Scan lines that are pure chord lines
        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith("{")) continue
            const tokens = trimmed
                .split(/[\s|:,]+/)
                .map((t) => t.trim())
                .filter(Boolean)
            for (const t of tokens) {
                if (isChordToken(t)) {
                    found.add(t.replace(/[\(\)\[\]]/g, ""))
                }
            }
        }

        return Array.from(found).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    })

    $effect(() => {
        if (!existingChords.length) showAdvanced = true
    })

    // Generated chord from 4 columns:
    // If bass is identical to key/root, hide it (do not append /bass)
    let generatedChord = $derived.by(() => {
        if (!selectedRoot) return ""
        let chord = selectedRoot + selectedType + selectedTension
        if (selectedBass && selectedBass !== selectedRoot) {
            chord += "/" + selectedBass
        }
        return chord
    })

    export const chordTypes: string[] = ["", "m", "maj", "min", "dim", "sus", "sus4", "sus2", "aug"]
    export const chordTensions: string[] = ["", "7", "j7", "b9", "9", "#9", "11", "#11", "b13", "13", "+", "°"]

    function handleSelectExisting(chord: string) {
        onInsertChord(chord)
        onClose()
    }

    function handleInsertGenerated() {
        if (generatedChord) {
            onInsertChord(generatedChord)
            onClose()
        }
    }

    function handleSelectRoot(note: string) {
        const wasBassSame = selectedBass === selectedRoot
        selectedRoot = note
        if (wasBassSame) {
            selectedBass = note
        }
    }
</script>

{#if open}
    <BaseDialog {open} icon="music_note" title={t("song_edit", "add_chord")} maxWidth="min(620px, calc(100vw - 32px))" onclose={onClose}>
        <div class="dialog-content">
            {#if existingChords.length > 0}
                <!-- Existing chords in song -->
                <div class="section-container">
                    <div class="existing-chords-grid">
                        {#each existingChords as chord}
                            <button type="button" class="chord-chip existing-chip" onclick={() => handleSelectExisting(chord)} title={`${t("common", "add")} [${chord}]`}>
                                <span class="bracket-hint">[</span>
                                <span class="chord-name">{chord}</span>
                                <span class="bracket-hint">]</span>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- More options toggle -->
                <div class="more-options-toggle-row">
                    <button type="button" class="toggle-more-btn" onclick={() => (showAdvanced = !showAdvanced)}>
                        <span class="material-symbols-outlined toggle-icon" class:expanded={showAdvanced}> expand_more </span>
                        <span>{t("menu", "more_options")}</span>
                    </button>
                </div>
            {/if}

            <!-- 4 columns chord generator -->
            {#if showAdvanced}
                <div class="builder-container">
                    <div class="four-columns-grid">
                        <!-- Column 1: Key / Root -->
                        <div class="builder-col">
                            <div class="col-title">{t("transpose", "key")}</div>
                            <div class="col-chips">
                                {#each displayedScale as note}
                                    <button type="button" class="builder-chip" class:selected={selectedRoot === note} onclick={() => handleSelectRoot(note)}>
                                        {note}
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- Column 2: Quality / Type -->
                        <div class="builder-col">
                            <div class="col-title">{t("song_edit", "type")}</div>
                            <div class="col-chips">
                                {#each chordTypes as ct}
                                    <button type="button" class="builder-chip" class:selected={selectedType === ct} onclick={() => (selectedType = ct)}>
                                        {ct || ""}
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- Column 3: Tension / Extension -->
                        <div class="builder-col">
                            <div class="col-title">{t("song_edit", "tension")}</div>
                            <div class="col-chips">
                                {#each chordTensions as ten}
                                    <button type="button" class="builder-chip" class:selected={selectedTension === ten} onclick={() => (selectedTension = ten)}>
                                        {ten || ""}
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- Column 4: Bass note -->
                        <div class="builder-col">
                            <div class="col-title">{t("song_edit", "bass")}</div>
                            <div class="col-chips">
                                {#each displayedScale as note}
                                    <button type="button" class="builder-chip" class:selected={selectedBass === note} onclick={() => (selectedBass = note)}>
                                        /{note}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <!-- Add Preview -->
                    <div class="preview-actions">
                        <md-filled-button type="button" disabled={!generatedChord} onclick={handleInsertGenerated}>
                            <span class="material-symbols-outlined" slot="icon">add</span>
                            {t("common", "add")} [{generatedChord || "—"}]
                        </md-filled-button>
                    </div>
                </div>
            {/if}
        </div>

        {#snippet actions()}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-text-button role="button" tabindex="0" onclick={onClose}>
                {t("common", "close")}
            </md-text-button>
        {/snippet}
    </BaseDialog>
{/if}

<style>
    .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 6px;
        width: 100%;
        box-sizing: border-box;
        max-height: 70vh;
        overflow-y: auto;
    }

    .section-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .existing-chords-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        max-height: 140px;
        overflow-y: auto;
        padding: 2px;
    }

    .chord-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 7px 14px;
        min-height: 38px;
        box-sizing: border-box;
        border-radius: 8px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-low, #f7f2fa);
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .chord-chip:hover {
        background: var(--md-sys-color-primary-container, #eaddff);
        color: var(--md-sys-color-on-primary-container, #21005d);
        border-color: var(--md-sys-color-primary, #6750a4);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .bracket-hint {
        color: var(--md-sys-color-outline, #79747e);
        font-size: 0.85rem;
        font-weight: normal;
    }

    .more-options-toggle-row {
        display: flex;
        align-items: center;
        padding-top: 4px;
        border-top: 1px solid var(--md-sys-color-outline-variant, #e0dbe3);
    }

    .toggle-more-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        color: var(--md-sys-color-primary, #6750a4);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        padding: 6px 8px;
        border-radius: 6px;
        transition: background 0.15s ease;
    }

    .toggle-more-btn:hover {
        background: var(--md-sys-color-surface-container-high, #ece6f0);
    }

    .toggle-icon {
        font-size: 20px;
        transition: transform 0.2s ease;
    }

    .toggle-icon.expanded {
        transform: rotate(180deg);
    }

    .builder-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        background: var(--md-sys-color-surface-container, #f3edf7);
        border: 1px solid var(--md-sys-color-outline-variant, #e0dbe3);
    }

    .four-columns-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
    }

    .builder-col {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .col-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        text-align: center;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
    }

    .col-chips {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 2px 2px;
    }

    .builder-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        padding: 6px 8px;
        border-radius: 8px;
        box-sizing: border-box;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-lowest, #ffffff);
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .builder-chip:hover {
        background: var(--md-sys-color-surface-container-high, #ece6f0);
    }

    .builder-chip.selected {
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        border-color: var(--md-sys-color-primary, #6750a4);
    }

    .preview-actions {
        width: 100%;
        display: flex;
        align-items: center;
        border-radius: 20px;
        overflow: hidden;
        margin-top: 4px;
    }

    .preview-actions :global(md-filled-button),
    .preview-actions :global(md-filled-tonal-button) {
        width: 100%;
        border-radius: 20px;
        --md-filled-button-container-shape: 20px;
        --md-filled-tonal-button-container-shape: 20px;
    }

    @media (max-width: 480px) {
        .four-columns-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
    }
</style>
