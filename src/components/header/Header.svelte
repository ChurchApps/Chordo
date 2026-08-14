<script lang="ts">
    import { calculateTransposeSemitones, hasTransposableContent } from "../../lib/chords/transpose"
    import { getCurrentSong, goBack, isFullscreenPage, listEditingState, menuState, setActivePage, setActivePopup } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import { pages } from "../pages/pages"

    let headerPath = $derived(
        menuState.previousPages.reduce((path, page) => {
            const title = page.customPageTitle
            if (title) path += title + " / "
            return path
        }, "")
    )

    let headerTitle = $derived(menuState.customPageTitle ?? pages[menuState.activePage]?.title ?? "")

    let isEditing = $derived(listEditingState.isEditing) // menuState.activePage === "list" && listEditingState.isEditing

    // Active song context
    let activeSongContext = $derived(storage.songs && storage.lists ? getCurrentSong() : null)
    let currentSong = $derived(activeSongContext?.song ?? null)

    let canTranspose = $derived(currentSong ? hasTransposableContent(currentSong.content, currentSong.key, currentSong.images) : false)

    // Semitone distance / count from base key
    let transposeCount = $derived.by(() => {
        if (!currentSong) return 0
        return calculateTransposeSemitones({
            targetKey: activeSongContext?.listItem?.transposed,
            lastTransposed: currentSong.lastTransposed,
            songKey: currentSong.key,
            content: currentSong.content
        })
    })
</script>

{#if isFullscreenPage(menuState.activePage)}
    <!-- don't show any headers -->
{:else}
    <header class="top-app-bar">
        <div class="top-bar-left">
            {#if isEditing}
                <md-icon-button disabled>
                    <span class="material-symbols-outlined">edit</span>
                </md-icon-button>
            {:else if menuState.previousPages.length > 0}
                <md-icon-button aria-label="Go back" onclick={goBack}>
                    <span class="material-symbols-outlined">arrow_back</span>
                </md-icon-button>
            {:else}
                <md-icon-button aria-label="Menu" disabled>
                    <span class="material-symbols-outlined">music_note</span>
                </md-icon-button>
            {/if}

            <h1 class="top-bar-title">
                {#if isEditing}
                    Edit
                {:else}
                    <span style="font-size: 0.7em;opacity: 0.7;">{headerPath}</span>{headerTitle}
                {/if}
            </h1>
        </div>

        <div class="top-bar-actions">
            {#if isEditing}
                <md-icon-button aria-label="Delete selected" onclick={() => listEditingState.onDeleteSelected?.()}>
                    <span class="material-symbols-outlined" style="color: var(--md-sys-color-error, #ba1a1a);">delete</span>
                </md-icon-button>
            {:else}
                {#if menuState.activePage === "song"}
                    <div class="action-btn-wrapper">
                        <md-icon-button aria-label="Transpose" disabled={!canTranspose} onclick={() => setActivePopup("transpose")}>
                            <span class="material-symbols-outlined">swap_vert</span>
                        </md-icon-button>
                        {#if transposeCount !== 0}
                            <span class="badge" class:negative={transposeCount < 0}>
                                {transposeCount > 0 ? "+" + transposeCount : transposeCount}
                            </span>
                        {/if}
                    </div>
                    <md-icon-button aria-label="Edit" onclick={() => setActivePage("song_edit", menuState.contentId, "Edit Song")}>
                        <span class="material-symbols-outlined">edit</span>
                    </md-icon-button>
                {:else}
                    <md-icon-button aria-label="Search">
                        <span class="material-symbols-outlined">search</span>
                    </md-icon-button>
                {/if}
                <md-icon-button aria-label="More options">
                    <span class="material-symbols-outlined">more_vert</span>
                </md-icon-button>
            {/if}
        </div>
    </header>
{/if}

<style>
    .top-app-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;

        height: 64px;
        min-height: 64px;

        padding: 0 16px;

        z-index: 10;

        user-select: none;
    }

    .top-bar-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .top-bar-title {
        font-size: 1.25rem;
        font-weight: 500;
        letter-spacing: 0.15px;
    }

    .top-bar-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

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
    /* .badge.negative {
        background: var(--md-sys-color-tertiary, #7d5260);
    } */
</style>
