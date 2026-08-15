<script lang="ts">
    import { onMount } from "svelte"
    import { Songs } from "$lib/models/Song"
    import { t } from "$lib/state/i18n.svelte"
    import { menuState, setActivePage, setActivePopup } from "$lib/state/menu.svelte"

    let songName = $state("")

    function closeDialog() {
        songName = ""
        setActivePopup(null)
    }

    function createSong() {
        const name = songName.trim()
        if (!name) return

        const song = Songs.create({ name }, menuState.contentId)

        if (menuState.contentId) {
            // when adding directly to a list, "close" the Add songs page
            setActivePage("song_edit", song.id, song.name, "replace")
        } else {
            // make sure we go to the actual song after editing
            setActivePage("song_edit", song.id, song.name, "append", { activePage: "song", contentId: song.id, customPageTitle: song.name })
        }

        closeDialog()
    }

    onMount(() => {
        const inputField = document.getElementById("song-name-input")
        if (inputField) inputField.focus()
    })

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            createSong()
        }
    }
</script>

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline">
        <div class="dialog-header">
            <span class="material-symbols-outlined headline-icon">music_note</span>
            <span>{t("new", "song")}</span>
        </div>
    </div>

    <form slot="content" id="song-form" method="dialog" class="dialog-form">
        <md-outlined-text-field id="song-name-input" label="Song Title" placeholder="e.g. Amazing Grace" value={songName} oninput={(e: Event) => (songName = (e.target as HTMLInputElement).value)} onkeydown={keydown} required>
        </md-outlined-text-field>
    </form>

    <div slot="actions">
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>Cancel</md-text-button>
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <md-filled-button role="button" tabindex="0" onclick={createSong} disabled={!songName.trim()}>Create</md-filled-button>
    </div>
</md-dialog>

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #2b2930;
        font-size: 1.35rem;
    }

    .headline-icon {
        /* color: #d0bcff; */
        color: #2b2930;
    }

    .dialog-form {
        display: flex;
        flex-direction: column;
        padding-top: 12px;
        min-width: 320px;
        max-width: 500px;
    }

    md-outlined-text-field {
        width: 100%;
    }
</style>
