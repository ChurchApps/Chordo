<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import SongContentEditor from "../common/SongContentEditor.svelte"
    import BaseDialog from "./BaseDialog.svelte"

    interface Props {
        open?: boolean
        songId: string | null
        onClose: () => void
    }

    let { open = false, songId, onClose }: Props = $props()

    let song = $derived(songId ? storage.getSongById(songId, storage.songs) : null)
</script>

{#if open && song}
    <BaseDialog {open} icon="edit_note" title={song.name || t("common", "edit")} maxWidth="min(780px, calc(100vw - 32px))" onclose={onClose}>
        <div class="dialog-content">
            <SongContentEditor id="quick-edit-song-content" {song} rows={16} style="width: 100%; height: 55vh; min-height: 280px;" />
        </div>

        {#snippet actions()}
            <md-filled-button onclick={onClose}>{t("common", "done")}</md-filled-button>
        {/snippet}
    </BaseDialog>
{/if}

<style>
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
