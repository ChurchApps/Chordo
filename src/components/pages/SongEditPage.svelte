<script lang="ts">
    import type { SongKeys } from "../../lib/models/Song"
    import { goBack, menuState, updatePageTitle } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"

    let song = $derived(storage.getSongById(menuState.contentId, storage.songs))
    let name = $derived(song?.name || "")

    let currentSongName = ""
    function updateValue(e: Event, key: keyof SongKeys) {
        const value = (e.target as HTMLInputElement).value
        if (!song) return

        if (key === "name" && !value.trim()) return
        if (key === "createdAt") return

        song[key] = value

        storage.persist()

        if (key === "name") {
            if (currentSongName !== value) updatePageTitle(value)
            currentSongName = value
        }
    }
</script>

<main>
    <div style="padding: 30px;">
        {#if song}
            <div style="display: flex; gap: 16px; margin-top: 16px;">
                <!-- Title -->
                <md-outlined-text-field id="song-name-input" label="Title" placeholder="e.g. Amazing Grace" value={name} oninput={(e: Event) => updateValue(e, "name")} style="flex: 1;"> </md-outlined-text-field>
                <!-- Artist (dropdown) -->
                <md-outlined-text-field id="song-artist-input" label="Artist" placeholder="e.g. John Newton" value={song.artist} oninput={(e: Event) => updateValue(e, "artist")} style="flex: 1;"> </md-outlined-text-field>
            </div>

            <div style="display: flex; gap: 16px; margin-top: 16px;">
                <!-- Key (dropdown) -->
                <md-outlined-text-field id="song-key-input" label="Key" placeholder="e.g. G" value={song.key} oninput={(e: Event) => updateValue(e, "key")} style="flex: 1;"> </md-outlined-text-field>
                <!-- Tempo -->
                <md-outlined-text-field id="song-tempo-input" label="Tempo" placeholder="e.g. 120" value={song.tempo} oninput={(e: Event) => updateValue(e, "tempo")} style="flex: 1;"> </md-outlined-text-field>
            </div>

            <md-outlined-text-field
                type="textarea"
                label="Content"
                placeholder={"[G]Amazing [G7]grace\nHow [C]sweet the [G]sound\n..."}
                rows={8}
                value={song.content}
                oninput={(e: Event) => updateValue(e, "content")}
                style="width: 100%; margin-top: 16px;"
            >
            </md-outlined-text-field>
        {/if}
    </div>
</main>

<div class="fab-container">
    <md-fab aria-label="Done" onclick={goBack}>
        <span class="material-symbols-outlined" slot="icon">check</span>
    </md-fab>
</div>
