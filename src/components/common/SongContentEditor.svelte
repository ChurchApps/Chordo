<script lang="ts">
    import type { Song } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { createHistory } from "$lib/utils/history.svelte"
    import { onDestroy } from "svelte"
    import { convertToChordPro } from "$lib/chords/chordproConverter"
    import FindReplaceDialog from "../popups/FindReplaceDialog.svelte"
    import InsertChordDialog from "../popups/InsertChordDialog.svelte"
    import ReorderSectionsDialog from "../popups/ReorderSectionsDialog.svelte"
    import HighlightedTextarea from "./HighlightedTextarea.svelte"

    interface Props {
        song: Song | null
        id?: string
        rows?: number
        style?: string
        class?: string
        onContentChange?: (newVal: string) => void
        onBlur?: () => void
    }

    let { song, id = "song-content-editor", rows = 8, style = "", class: className = "", onContentChange = undefined, onBlur = undefined }: Props = $props()

    let textareaEl = $state<HTMLTextAreaElement | null>(null)
    let isTextareaFocused = $state(false)
    let lastSelection = $state<{ start: number; end: number }>({ start: 0, end: 0 })
    let showChordDialog = $state(false)
    let showReorderDialog = $state(false)
    let reorderInitialText = $state("")
    let showFindReplaceDialog = $state(false)
    let isInitialized = false

    const contentHistory = createHistory<string>("", {
        debounceMs: 300,
        onApply: (newVal) => {
            if (!song) return
            song.content = newVal
            storage.updateSong(song)
            storage.persist()
            if (onContentChange) onContentChange(newVal)
        }
    })

    onDestroy(() => {
        contentHistory.destroy()
    })

    $effect(() => {
        if (song && !isInitialized) {
            contentHistory.reset(song.content || "")
            isInitialized = true
        } else if (!song) {
            isInitialized = false
        }
    })

    export function setContent(newContent: string, overwrite = false) {
        if (!song) return
        contentHistory.set(newContent, overwrite)
        song.content = newContent
        storage.updateSong(song)
        storage.persist()
    }

    export function pushContent(newContent: string) {
        if (!song) return
        contentHistory.push(newContent)
        song.content = newContent
        storage.updateSong(song)
        storage.persist()
    }

    function handleInput(e: Event) {
        if (!song) return
        const val = (e.target as HTMLTextAreaElement).value
        contentHistory.set(val)
        song.content = val
        storage.updateSong(song)
        storage.persist()
        if (onContentChange) onContentChange(val)
    }

    function handleFocus() {
        isTextareaFocused = true
    }

    function handleBlur() {
        isTextareaFocused = false
        if (textareaEl) {
            lastSelection = {
                start: textareaEl.selectionStart ?? 0,
                end: textareaEl.selectionEnd ?? 0
            }
        }
        if (!song) return
        storage.updateSong(song)
        storage.persist()
        if (onBlur) onBlur()
    }

    let lastScrollPos = $state<{ top: number; left: number }>({ top: 0, left: 0 })

    function openAddChordDialog() {
        if (!isTextareaFocused) return
        if (textareaEl) {
            lastSelection = {
                start: textareaEl.selectionStart ?? (song?.content?.length || 0),
                end: textareaEl.selectionEnd ?? (song?.content?.length || 0)
            }
            lastScrollPos = {
                top: textareaEl.scrollTop,
                left: textareaEl.scrollLeft
            }
        }
        showChordDialog = true
    }

    function insertChord(chord: string) {
        if (!song) return
        const currentText = song.content || ""
        let start = lastSelection.start
        let end = lastSelection.end

        if (start < 0 || start > currentText.length) {
            start = currentText.length
            end = currentText.length
        }

        const chordToken = `[${chord}]`
        const textWithChord = currentText.slice(0, start) + chordToken + currentText.slice(end)

        // Run chordpro parsing right after adding the chord
        const parsedChordProText = convertToChordPro(textWithChord)

        // Calculate where the caret should be in the new parsed text
        // If the text length changed drastically (e.g. line merged), keep caret near insertion point
        let newCaretPos = start + chordToken.length
        if (parsedChordProText !== textWithChord) {
            // Find the inserted token in the new text at or closest to 'start'
            const foundIdx = parsedChordProText.indexOf(chordToken, Math.max(0, start - 20))
            if (foundIdx !== -1) {
                newCaretPos = foundIdx + chordToken.length
            } else {
                newCaretPos = Math.min(newCaretPos, parsedChordProText.length)
            }
        }

        contentHistory.push(parsedChordProText)
        song.content = parsedChordProText
        storage.updateSong(song)
        storage.persist()
        if (onContentChange) onContentChange(parsedChordProText)

        lastSelection = { start: newCaretPos, end: newCaretPos }
        const savedScroll = { ...lastScrollPos }

        // Restore focus, caret position, and scroll position precisely
        setTimeout(() => {
            if (textareaEl) {
                textareaEl.focus({ preventScroll: true })
                textareaEl.setSelectionRange(newCaretPos, newCaretPos)
                textareaEl.scrollTop = savedScroll.top
                textareaEl.scrollLeft = savedScroll.left
            }
        }, 30)
    }

    function openReorderDialog() {
        reorderInitialText = song?.content || ""
        showReorderDialog = true
    }

    function applyReorder(newContent: string) {
        if (!song) return
        contentHistory.push(newContent)
        song.content = newContent
        reorderInitialText = newContent
        storage.updateSong(song)
        storage.persist()
        if (onContentChange) onContentChange(newContent)
    }

    function openFindReplaceDialog() {
        showFindReplaceDialog = true
    }

    function applyFindReplace(newContent: string) {
        if (!song) return
        contentHistory.push(newContent)
        song.content = newContent
        storage.updateSong(song)
        storage.persist()
        if (onContentChange) onContentChange(newContent)
    }

    function handleEditorKeyDown(e: KeyboardEvent) {
        const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
        const isModifier = isMac ? e.metaKey : e.ctrlKey

        if (isModifier && (e.key === "f" || e.key === "h")) {
            e.preventDefault()
            if (hasContent) openFindReplaceDialog()
            return
        }

        contentHistory.handleKeyDown(e)
    }

    let hasContent = $derived(Boolean(song?.content && song.content.trim().length > 0))
</script>

<div class="song-content-editor {className}" style={style ? `${style}` : ""}>
    <div class="content-actions-container">
        <button type="button" class="content-action-btn" disabled={!contentHistory.canUndo} onclick={() => contentHistory.undo()} title={`${t("common", "undo")} (Ctrl+Z)`}>
            <span class="material-symbols-outlined" style="font-size: 16px;">undo</span>
            <span>{t("common", "undo")}</span>
        </button>

        <button type="button" class="content-action-btn" disabled={!contentHistory.canRedo} onclick={() => contentHistory.redo()} title={`${t("common", "redo")} (Ctrl+Y)`}>
            <span class="material-symbols-outlined" style="font-size: 16px;">redo</span>
            <span>{t("common", "redo")}</span>
        </button>

        {#if hasContent}
            <button
                type="button"
                class="content-action-btn"
                disabled={!isTextareaFocused}
                onpointerdown={(e) => {
                    // Prevent mousedown from blurring the textarea before opening dialog
                    if (isTextareaFocused) {
                        e.preventDefault()
                    }
                }}
                onclick={openAddChordDialog}
                title={t("song_edit", "add_chord")}
            >
                <span class="material-symbols-outlined" style="font-size: 16px;">music_note</span>
                <span>{t("song_edit", "add_chord")}</span>
            </button>

            <button type="button" class="content-action-btn" onclick={openFindReplaceDialog} title={`${t("find_replace", "title")} (Ctrl+F / Ctrl+H)`}>
                <span class="material-symbols-outlined" style="font-size: 16px;">find_replace</span>
                <span>{t("find_replace", "title")}</span>
            </button>

            <button type="button" class="content-action-btn" onclick={openReorderDialog} title={t("song_edit", "reorder_sections")}>
                <span class="material-symbols-outlined" style="font-size: 16px;">reorder</span>
                <span>{t("song_edit", "reorder")}</span>
            </button>
        {/if}
    </div>

    <HighlightedTextarea
        {id}
        bind:ref={textareaEl}
        label={t("song_edit", "content")}
        placeholder={t("song_edit", "content_placeholder")}
        {rows}
        value={song?.content || ""}
        oninput={handleInput}
        onfocus={handleFocus}
        onblur={handleBlur}
        onkeydown={handleEditorKeyDown}
        style="width: 100%; height: 100%; min-height: inherit; max-height: inherit; flex: 1;"
    />
</div>

<InsertChordDialog open={showChordDialog} text={song?.content || ""} onInsertChord={insertChord} onClose={() => (showChordDialog = false)} />

<ReorderSectionsDialog open={showReorderDialog} initialText={reorderInitialText} onApply={applyReorder} onClose={() => (showReorderDialog = false)} />

<FindReplaceDialog open={showFindReplaceDialog} initialText={song?.content || ""} onApply={applyFindReplace} onClose={() => (showFindReplaceDialog = false)} />

<style>
    .song-content-editor {
        position: relative;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        direction: ltr;
        display: flex;
        flex-direction: column;
    }

    .content-actions-container {
        position: absolute;
        top: 8px;
        right: 12px;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .content-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 16px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-high, #f7f2fa);
        color: var(--md-sys-color-primary, #6750a4);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        transition: all 0.15s ease;
    }

    .content-action-btn:hover:not(:disabled) {
        background: var(--md-sys-color-primary-container, #eaddff);
        color: var(--md-sys-color-on-primary-container, #21005d);
        border-color: var(--md-sys-color-primary, #6750a4);
    }

    .content-action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: none;
    }
</style>
