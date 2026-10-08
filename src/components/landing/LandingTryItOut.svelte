<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import HighlightedTextarea from "../common/HighlightedTextarea.svelte"
    import ChordPro from "../song/ChordPro.svelte"
    import TransposeDialog from "../popups/TransposeDialog.svelte"
    import { extractBaseKey } from "$lib/chords/transpose"

    const DEFAULT_CHORDPRO_TEXT =
        "{title: Amazing Grace}\n\n{c: Verse 1}\n[G]Amazing [Em7]grace, how [Cadd9]sweet the [D]sound\nThat [G]saved a [Em7]wretch like [D]me\nI [G]once was [Em7]lost, but [Cadd9]now am [D]found\nWas [G]blind, but [D]now I [G]see"
    let chordProEditorText = $state(DEFAULT_CHORDPRO_TEXT)

    let detectedKey = $derived(extractBaseKey(chordProEditorText) || "")
    let selectedTargetKey = $state<string | null>(null)
    let effectiveTargetKey = $derived(selectedTargetKey || detectedKey || "G")

    let showTransposePopup = $state(false)

    let demoSong = $derived({
        id: "demo_song",
        name: "Amazing Grace",
        content: chordProEditorText,
        metadata: { artist: "John Newton" }
    })

    function resetDemoEditor() {
        chordProEditorText = DEFAULT_CHORDPRO_TEXT
        selectedTargetKey = null
    }
</script>

<section class="demo-card">
    <div class="demo-header">
        <div class="demo-title-group">
            <span class="material-symbols-outlined demo-icon">tune</span>
            <div>
                <h2 class="demo-title">{t("landing", "interactive_preview_title")}</h2>
                <p class="demo-desc">{t("landing", "interactive_preview_desc")}</p>
            </div>
        </div>

        <button class="reset-editor-btn" onclick={resetDemoEditor} title="Reset example">
            <span class="material-symbols-outlined">refresh</span>
            <span>{t("common", "reset")}</span>
        </button>
    </div>

    <div class="editor-demo-split">
        <!-- Live ChordPro Editor Input -->
        <div class="demo-pane">
            <div class="pane-label">
                <span class="material-symbols-outlined pane-icon">edit_note</span>
                <span>ChordPro Editor</span>
            </div>
            <HighlightedTextarea bind:value={chordProEditorText} rows={7} placeholder="[G]Type chords and lyrics here..." class="demo-highlighted-editor" />

            <div class="pane-bottom-bar">
                <span class="material-symbols-outlined bottom-icon">music_note</span>
                <span>{t("common", "original")} {t("common", "key").toLowerCase()}: <strong>{detectedKey || "—"}</strong></span>
            </div>
        </div>

        <!-- Live Rendered Output (Transposed in Real-Time) -->
        <div class="demo-pane">
            <div class="pane-label">
                <span class="material-symbols-outlined pane-icon">visibility</span>
                <span>Preview</span>
            </div>
            <div class="demo-rendered-sheet">
                <ChordPro song={demoSong} targetKey={effectiveTargetKey} showMeta={false} fitParent={false} />
            </div>

            <button class="pane-bottom-bar action-btn" onclick={() => (showTransposePopup = true)} title="Open transpose popup">
                <span class="material-symbols-outlined bottom-icon">swap_vert</span>
                <span>{t("common", "key")}: <strong>{effectiveTargetKey}</strong></span>
                <span class="material-symbols-outlined dropdown-icon">expand_more</span>
            </button>
        </div>
    </div>
</section>

{#if showTransposePopup}
    <TransposeDialog customOriginalKey={detectedKey || "G"} currentKey={effectiveTargetKey} onSelectKey={(k) => (selectedTargetKey = k)} onClose={() => (showTransposePopup = false)} />
{/if}

<style>
    .demo-card {
        display: flex;
        flex-direction: column;
        width: 100%;
        background-color: var(--md-sys-color-surface, #ffffff);
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.12));
        border-radius: 20px;
        padding: 20px;
        box-sizing: border-box;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        gap: 16px;
    }

    .demo-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .demo-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .demo-icon {
        font-size: 28px;
        color: var(--md-sys-color-primary);
        background: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.05));
        padding: 8px;
        border-radius: 12px;
    }

    .demo-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--md-sys-color-on-surface, inherit);
        margin: 0;
    }

    .demo-desc {
        font-size: 0.85rem;
        opacity: 0.75;
        color: var(--md-sys-color-on-surface, inherit);
        margin: 0;
    }

    .reset-editor-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.2));
        background: transparent;
        color: var(--md-sys-color-on-surface, inherit);
        padding: 6px 12px;
        border-radius: 10px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .reset-editor-btn .material-symbols-outlined {
        font-size: 16px;
    }

    .reset-editor-btn:hover {
        background: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.06));
    }

    .editor-demo-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        width: 100%;
        box-sizing: border-box;
    }

    .demo-pane {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        min-width: 0;
    }

    .pane-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.7;
        color: var(--md-sys-color-on-surface, inherit);
    }

    .pane-icon {
        font-size: 16px;
        color: var(--md-sys-color-primary);
    }

    :global(.demo-highlighted-editor) {
        height: 100% !important;
        min-height: 200px;
        border-radius: 12px !important;
        font-family: monospace, monospace !important;
        font-size: 0.88rem !important;
    }

    .demo-rendered-sheet {
        background-color: #ffffff;
        color: #000000;
        border-radius: 12px;
        padding: 16px;
        border: 1px dashed var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.15));
        height: 100%;
        min-height: 200px;
        box-sizing: border-box;
        overflow-y: auto;
        max-height: 280px;
    }

    /* Shared Bottom Bar for Both Panes */
    .pane-bottom-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 40px;
        padding: 4px 16px;
        border-radius: 12px;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.12));
        background: var(--md-sys-color-surface-container, rgba(0, 0, 0, 0.04));
        color: var(--md-sys-color-on-surface, inherit);
        font-size: 0.88rem;
        box-sizing: border-box;
        margin-top: 4px;
    }

    .pane-bottom-bar strong {
        color: var(--md-sys-color-primary);
        font-weight: 700;
        font-size: 0.95rem;
    }

    .pane-bottom-bar .bottom-icon {
        font-size: 18px;
        color: var(--md-sys-color-primary);
    }

    .pane-bottom-bar.action-btn {
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pane-bottom-bar.action-btn:hover {
        background: var(--md-sys-color-secondary-container, rgba(0, 0, 0, 0.08));
        border-color: var(--md-sys-color-primary);
    }

    .pane-bottom-bar .dropdown-icon {
        font-size: 18px;
        opacity: 0.6;
    }

    @media (max-width: 600px) {
        .demo-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .editor-demo-split {
            grid-template-columns: 1fr;
        }
    }
</style>
