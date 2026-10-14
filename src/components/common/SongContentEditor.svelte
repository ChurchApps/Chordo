<script lang="ts">
    import type { Song } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { createHistory } from "$lib/utils/history.svelte"
    import { onDestroy } from "svelte"
    import ReorderSectionsDialog from "../popups/ReorderSectionsDialog.svelte"
    import HighlightedTextarea from "./HighlightedTextarea.svelte"

    let {
        song,
        id = "song-content-editor",
        rows = 8,
        style = "",
        class: className = "",
        onContentChange,
        onBlur
    } = $props<{
        song: Song | null
        id?: string
        rows?: number
        style?: string
        class?: string
        onContentChange?: (newVal: string) => void
        onBlur?: () => void
    }>()

    let showReorderDialog = $state(false)
    let reorderInitialText = $state("")
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

    function handleBlur() {
        if (!song) return
        storage.updateSong(song)
        storage.persist()
        if (onBlur) onBlur()
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
            <button type="button" class="content-action-btn" onclick={openReorderDialog} title={t("song_edit", "reorder_sections")}>
                <span class="material-symbols-outlined" style="font-size: 16px;">reorder</span>
                <span>{t("song_edit", "reorder")}</span>
            </button>
        {/if}
    </div>

    <HighlightedTextarea
        {id}
        label={t("song_edit", "content")}
        placeholder={t("song_edit", "content_placeholder")}
        {rows}
        value={song?.content || ""}
        oninput={handleInput}
        onblur={handleBlur}
        onkeydown={contentHistory.handleKeyDown}
        style="width: 100%; height: 100%; min-height: inherit; max-height: inherit; flex: 1;"
    />
</div>

<ReorderSectionsDialog open={showReorderDialog} initialText={reorderInitialText} onApply={applyReorder} onClose={() => (showReorderDialog = false)} />

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
