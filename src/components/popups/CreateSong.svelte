<script lang="ts">
    import { Songs } from "../../lib/models/Song"
    import { t } from "../../lib/state/i18n.svelte"
    import { goBack, menuState, setActivePage, setActivePopup } from "../../lib/state/menu.svelte"

    let songName = $state("")
    let songContent = $state("")

    function closeDialog() {
        songName = ""
        songContent = ""
        setActivePopup(null)
    }

    function createSong() {
        const name = songName.trim()
        if (!name) return

        const song = Songs.create({ name, content: songContent }, menuState.contentId)

        if (menuState.contentId) {
            goBack()
        } else {
            setActivePage("song", song.id, song.name)
        }

        closeDialog()
    }

    const options = [
        { type: "text", label: "Text (ChordPro)", description: "Any text should work, but ChordPro formatted text works best." },
        { type: "media", label: "Media", description: "PDF, JPG, PNG, etc." },
        { type: "web", label: "Website", description: "Link to any website with the song." }
    ] as const
    type OptionType = (typeof options)[number]["type"]
    let chosenType = $state<OptionType | null>(null)

    function chooseType(type: OptionType) {
        chosenType = type

        if (type === "text") {
            setTimeout(() => {
                const inputField = document.getElementById("song-name-input")
                if (inputField) inputField.focus()
            }, 0)
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

    {#if !chosenType}
        <form slot="content" method="dialog" class="dialog-form">
            {#each options as option}
                <md-list-item type="button" onclick={() => chooseType(option.type)}>
                    <div slot="headline">{option.label}</div>
                    <div slot="supporting-text">{option.description}</div>
                    <md-icon slot="end" style="opacity: 0.8;">keyboard_arrow_right</md-icon>
                </md-list-item>
            {/each}
        </form>
    {:else if chosenType === "text"}
        <form slot="content" id="song-form" method="dialog" class="dialog-form">
            <md-outlined-text-field id="song-name-input" label="Song Title" placeholder="e.g. Amazing Grace" value={songName} oninput={(e: Event) => (songName = (e.target as HTMLInputElement).value)} required> </md-outlined-text-field>

            <md-outlined-text-field
                type="textarea"
                label="Content"
                placeholder={"[G]Amazing [G7]grace\nHow [C]sweet the [G]sound\n..."}
                rows={8}
                value={songContent}
                oninput={(e: Event) => (songContent = (e.target as HTMLInputElement).value)}
                style="width: 100%; margin-top: 16px;"
            >
            </md-outlined-text-field>
        </form>
    {:else if chosenType === "media"}
        <div slot="content" class="dialog-form">
            <p>Media upload is not yet implemented.</p>
        </div>
    {:else if chosenType === "web"}
        <div slot="content" class="dialog-form">
            <p>Web link is not yet implemented.</p>
        </div>
    {/if}

    <div slot="actions">
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <md-text-button role="button" tabindex="0" onclick={closeDialog}>Cancel</md-text-button>
        {#if chosenType}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-filled-button role="button" tabindex="0" onclick={createSong} disabled={!songName.trim()}>Create</md-filled-button>
        {/if}
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
        width: 400px;
    }
</style>
