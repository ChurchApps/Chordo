<script>
    import { goBack, isFullscreenPage, menuState, setActivePage } from "../../lib/state/menu.svelte"
    import { pages } from "../pages/pages"

    let headerPath = $derived(
        menuState.previousPages.reduce((path, page) => {
            const title = page.customPageTitle
            if (title) path += title + " / "
            return path
        }, "")
    )

    let headerTitle = $derived(menuState.customPageTitle ?? pages[menuState.activePage]?.title ?? "")
</script>

{#if !isFullscreenPage(menuState.activePage)}
    <header class="top-app-bar">
        <div class="top-bar-left">
            {#if menuState.previousPages.length > 0}
                <md-icon-button aria-label="Go back" onclick={goBack}>
                    <span class="material-symbols-outlined">arrow_back</span>
                </md-icon-button>
            {:else}
                <md-icon-button aria-label="Menu" disabled>
                    <span class="material-symbols-outlined">music_note</span>
                </md-icon-button>
            {/if}
            <h1 class="top-bar-title"><span style="font-size: 0.7em;opacity: 0.7;">{headerPath}</span>{headerTitle}</h1>
        </div>

        <div class="top-bar-actions">
            {#if menuState.activePage === "song"}
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

        /* padding: 0 12px; */
        /* background-color: #211f26; */
        /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); */

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
</style>
