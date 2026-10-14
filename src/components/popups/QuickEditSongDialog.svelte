<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import SongContentEditor from "../common/SongContentEditor.svelte"

    let {
        open = false,
        songId,
        onClose
    } = $props<{
        open: boolean
        songId: string | null
        onClose: () => void
    }>()

    let song = $derived(songId ? storage.getSongById(songId, storage.songs) : null)
</script>

{#if open && song}
    <md-dialog {open} onclosed={onClose} oncancel={onClose} class="quick-edit-dialog">
        <div slot="headline">
            <div class="dialog-header">
                <span class="material-symbols-outlined headline-icon">edit_note</span>
                <span class="dialog-title">{song.name || t("common", "edit")}</span>
            </div>
        </div>

        <div slot="content" class="dialog-content">
            <SongContentEditor id="quick-edit-song-content" {song} rows={16} style="width: 100%; height: 55vh; min-height: 280px;" />
        </div>

        <div slot="actions">
            <md-filled-button onclick={onClose}>{t("common", "done")}</md-filled-button>
        </div>
    </md-dialog>
{/if}

<style>
    .quick-edit-dialog {
        --md-dialog-container-max-width: min(780px, calc(100vw - 32px));
        max-width: min(780px, calc(100vw - 32px));
        width: 100%;
    }

    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--md-sys-color-on-surface, #2b2930);
        font-size: 1.25rem;
        min-width: 0;
    }

    .dialog-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .headline-icon {
        color: var(--md-sys-color-primary);
        font-size: 24px;
        flex-shrink: 0;
    }

    .dialog-content {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        text-align: left;
        direction: ltr;
        overflow: hidden;
        padding-top: 4px;
    }
</style>
