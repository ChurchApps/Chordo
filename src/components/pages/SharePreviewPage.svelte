<script lang="ts">
    import { Folder } from "$lib/models/Folder"
    import { List } from "$lib/models/List"
    import { Song } from "$lib/models/Song"
    import { clearSharePayload, sharePreviewState } from "$lib/share/share.svelte"
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePage } from "$lib/state/menu.svelte"
    import { playbackState, togglePlayback } from "$lib/state/playback.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { parsePlaybackUrl } from "$lib/utils/playback"
    import ChordPro from "../song/ChordPro.svelte"

    let payload = $derived(sharePreviewState.payload)

    let previewSong = $derived.by(() => {
        if (!payload || payload.type !== "song") return null
        return new Song(payload.song)
    })

    let previewListSongs = $derived.by(() => {
        if (!payload || payload.type !== "list") return []
        return payload.list.songs.map((s) => new Song(s))
    })

    // Check if single song already exists in library
    let existingSong = $derived.by(() => {
        if (!payload || payload.type !== "song") return null
        const sharedSong = payload.song
        return storage.songs.find((s) => (sharedSong.id && s.id === sharedSong.id) || s.name.trim().toLowerCase() === sharedSong.name.trim().toLowerCase()) || null
    })

    function handleSongPlayback(song: Song) {
        const url = song.playbackUrl || song.spotify || song.getMetadata("playback") || song.getMetadata("spotify")
        if (!url) return
        togglePlayback(song.id || null, url, song.name)
    }

    async function importSong() {
        if (!payload || payload.type !== "song") return
        const shared = payload.song

        let songToOpen: Song

        if (existingSong) {
            // Update existing song
            existingSong.name = shared.name
            existingSong.content = shared.content
            if (shared.metadata) {
                existingSong.metadata = { ...existingSong.metadata, ...shared.metadata }
            }
            if (shared.playbackUrl) existingSong.playbackUrl = shared.playbackUrl
            if (shared.url) existingSong.url = shared.url
            if (shared.lastTransposed) existingSong.lastTransposed = shared.lastTransposed

            storage.updateSong(existingSong)
            songToOpen = existingSong
            showToast(`Updated "${shared.name}" in your library`, "success")
        } else {
            // Create new song
            const newSong = new Song({
                id: shared.id,
                name: shared.name,
                content: shared.content,
                metadata: shared.metadata || {},
                playbackUrl: shared.playbackUrl,
                url: shared.url,
                lastTransposed: shared.lastTransposed,
                createdAt: shared.createdAt || Date.now()
            })
            storage.addSong(newSong)
            songToOpen = newSong
            showToast(`Imported "${shared.name}" to your library`, "success")
        }

        storage.persist()
        clearSharePayload()
        setActivePage("song", songToOpen.id, songToOpen.name, "replace")
    }

    async function importList() {
        if (!payload || payload.type !== "list") return
        const sharedList = payload.list

        // Map through songs: keep existing songs intact, create new ones
        const resolvedListSongs: { songId: string; lastKnownName?: string; transposed?: string }[] = []
        let newSongsCount = 0
        let existingSongsCount = 0

        for (let i = 0; i < sharedList.songs.length; i++) {
            const sharedSong = sharedList.songs[i]
            const listItem = sharedList.listItems[i] || { songId: sharedSong.id || "", transposed: sharedSong.lastTransposed }

            // Check if song exists by ID or name
            const existing = storage.songs.find((s) => (sharedSong.id && s.id === sharedSong.id) || s.name.trim().toLowerCase() === sharedSong.name.trim().toLowerCase())

            if (existing) {
                // Keep existing song intact without overwrite
                resolvedListSongs.push({
                    songId: existing.id,
                    lastKnownName: existing.name,
                    transposed: listItem.transposed || sharedSong.lastTransposed
                })
                existingSongsCount++
            } else {
                // Create new song
                const newSong = new Song({
                    id: sharedSong.id,
                    name: sharedSong.name,
                    content: sharedSong.content,
                    metadata: sharedSong.metadata || {},
                    playbackUrl: sharedSong.playbackUrl,
                    url: sharedSong.url,
                    lastTransposed: sharedSong.lastTransposed,
                    createdAt: sharedSong.createdAt || Date.now()
                })
                storage.addSong(newSong)
                resolvedListSongs.push({
                    songId: newSong.id,
                    lastKnownName: newSong.name,
                    transposed: listItem.transposed || sharedSong.lastTransposed
                })
                newSongsCount++
            }
        }

        // Create the List
        const newList = new List({
            name: sharedList.name,
            songs: resolvedListSongs,
            createdAt: sharedList.createdAt || Date.now()
        })

        // Find or create "Shared" folder
        let sharedFolder = storage.folders.find((f) => f.name.trim().toLowerCase() === "shared")
        if (!sharedFolder) {
            sharedFolder = new Folder({ name: "Shared" })
            storage.addFolder(sharedFolder)
        }
        sharedFolder.addList(newList.id)
        storage.updateFolder(sharedFolder)

        storage.addList(newList)
        storage.persist()
        clearSharePayload()

        const msg = `Imported "${newList.name}" into Shared (${newSongsCount} new, ${existingSongsCount} existing)`
        showToast(msg, "success")
        setActivePage("list", newList.id, newList.name, "replace")
    }
</script>

<div class="share-page-wrapper">
    {#if !payload}
        <div class="empty-card">
            <span class="material-symbols-outlined icon">link_off</span>
            <h2>Invalid or Expired Link</h2>
            <p>Could not decode shared song or list data from this link.</p>
        </div>
    {:else if payload.type === "song" && previewSong}
        {@const song = previewSong}
        {@const pbUrl = song.playbackUrl || song.spotify || song.getMetadata("playback") || song.getMetadata("spotify")}
        {@const pbInfo = parsePlaybackUrl(pbUrl)}

        <div class="share-card">
            <div class="card-top">
                <div class="title-section">
                    <span class="badge-type"><span class="material-symbols-outlined">music_note</span> Shared Song</span>
                    <h1 class="title">{song.name}</h1>
                    <div class="meta-tags">
                        {#if song.getMetadata("artist")}
                            <span class="tag"><span class="material-symbols-outlined">person</span>{song.getMetadata("artist")}</span>
                        {/if}
                        {#if song.getMetadata("key") || song.lastTransposed}
                            <span class="tag key"><span class="material-symbols-outlined">key</span>Key: {song.lastTransposed || song.getMetadata("key")}</span>
                        {/if}
                        {#if song.getMetadata("tempo")}
                            <span class="tag"><span class="material-symbols-outlined">speed</span>{song.getMetadata("tempo")} BPM</span>
                        {/if}
                        {#if pbInfo}
                            <button class="tag playback-tag" onclick={() => handleSongPlayback(song)} title="Play track">
                                <span class="material-symbols-outlined">play_circle</span>
                                Play {pbInfo.provider === "spotify" ? "Spotify" : "YouTube"}
                            </button>
                        {/if}
                    </div>
                </div>
            </div>

            {#if existingSong}
                <div class="alert warning">
                    <span class="material-symbols-outlined">info</span>
                    <span>"{existingSong.name}" already exists in your library. Importing will replace it.</span>
                </div>
            {/if}

            <div class="sheet-container">
                <div class="paper-preview">
                    <ChordPro {song} showMeta={true} />
                </div>
            </div>

            <div class="bottom-center-action">
                <md-filled-button onclick={importSong} class="import-btn">
                    <span class="material-symbols-outlined" slot="icon">download</span>
                    <!-- {#if existingSong}
                        Update / Replace Song
                    {:else} -->
                    {t("common", "import")} Song
                    <!-- {/if} -->
                </md-filled-button>
            </div>
        </div>
    {:else if payload.type === "list"}
        {@const list = payload.list}
        <div class="share-card compact">
            <!-- <div class="card-top">
                <div class="title-section">
                    <span class="badge-type"><span class="material-symbols-outlined">queue_music</span> Shared Setlist</span>
                    <h1 class="title">{list.name}</h1>
                    <div class="meta-tags">
                        <span class="tag count"><span class="material-symbols-outlined">format_list_numbered</span>{previewListSongs.length} {previewListSongs.length === 1 ? "song" : "songs"}</span>
                        <span class="tag folder"><span class="material-symbols-outlined">folder</span>Saved to "Shared" folder</span>
                    </div>
                </div>
            </div> -->

            <div class="setlist-container">
                <!-- <div class="setlist-header">
                    <span>Songs ({previewListSongs.length})</span>
                    <span class="sub-hint">Existing library songs are preserved without overwrite</span>
                </div> -->

                <div class="song-table">
                    {#each previewListSongs as song, idx}
                        {@const pbUrl = song.playbackUrl || song.spotify || song.getMetadata("playback") || song.getMetadata("spotify")}
                        {@const pbInfo = parsePlaybackUrl(pbUrl)}
                        {@const isPlaying = playbackState.isOpen && (playbackState.songId === song.id || (pbUrl && playbackState.customPlaybackUrl === pbUrl))}
                        {@const isExisting = storage.songs.some((s) => (song.id && s.id === song.id) || s.name.trim().toLowerCase() === song.name.trim().toLowerCase())}

                        <div class="song-row">
                            <span class="track-num">{idx + 1}</span>

                            <div class="song-main">
                                <span class="song-title-text">{song.name}</span>
                                {#if song.getMetadata("artist")}
                                    <span class="song-artist-text">{song.getMetadata("artist")}</span>
                                {/if}
                            </div>

                            <div class="song-meta-side">
                                {#if song.getMetadata("key") || song.lastTransposed}
                                    <span class="key-badge">{song.lastTransposed || song.getMetadata("key")}</span>
                                {/if}

                                {#if pbInfo}
                                    <button class="play-btn" class:active={isPlaying} onclick={() => handleSongPlayback(song)} title={`Play on ${pbInfo.provider}`} aria-label={`Play ${song.name}`}>
                                        {#if pbInfo.provider === "spotify"}
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill={isPlaying ? "#1DB954" : "currentColor"}>
                                                <path
                                                    d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.307c-.216.353-.674.466-1.027.25-2.822-1.724-6.374-2.115-10.559-1.159-.404.093-.807-.16-.9-.564-.092-.404.161-.807.564-.9 4.582-1.047 8.514-.606 11.672 1.346.353.216.466.674.25 1.027zm1.465-3.262c-.272.441-.849.582-1.29.31-3.23-1.986-8.155-2.56-11.977-1.4-4.99.151-.989-.138-1.14-.637-.152-.499.138-.989.637-1.14 4.381-1.33 9.807-.687 13.46 1.577.441.272.582.849.31 1.29zm.126-3.41c-3.874-2.3-10.264-2.512-13.97-1.386-.595.181-1.226-.157-1.407-.752-.181-.595.157-1.226.752-1.407 4.257-1.293 11.31-1.045 15.772 1.603.535.318.708 1.01.39 1.545-.318.535-1.01.708-1.545.39z"
                                                />
                                            </svg>
                                        {:else}
                                            <span class="material-symbols-outlined" style="font-size: 20px;">{isPlaying ? "pause_circle" : "play_circle"}</span>
                                        {/if}
                                    </button>
                                {/if}

                                <!-- {#if isExisting}
                                    <span class="status-pill existing">Library</span>
                                {:else}
                                    <span class="status-pill new">New</span>
                                {/if} -->
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <div class="bottom-center-action">
                <md-filled-button onclick={importList} class="import-btn">
                    <span class="material-symbols-outlined" slot="icon">download</span>
                    {t("common", "import")} List
                </md-filled-button>
            </div>
        </div>
    {/if}
</div>

<style>
    .share-page-wrapper {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        overflow-y: auto;
        padding: 16px 20px 32px 20px;
        box-sizing: border-box;
        max-width: 860px;
        margin: 0 auto;
        width: 100%;

        padding-top: 0;
    }

    .empty-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 60px 20px;
        gap: 12px;
        color: var(--md-sys-color-on-surface-variant);
    }

    .empty-card .icon {
        font-size: 56px;
        opacity: 0.4;
    }

    .share-card {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .title-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    }

    .badge-type {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--md-sys-color-primary, #006666);
    }

    .badge-type .material-symbols-outlined {
        font-size: 15px;
    }

    .title {
        font-size: 1.6rem;
        font-weight: 700;
        margin: 0;
        color: var(--md-sys-color-on-surface, #1b1b1f);
    }

    .meta-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
    }

    .tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
        background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
        color: var(--md-sys-color-on-surface-variant, #44474e);
    }

    .tag .material-symbols-outlined {
        font-size: 15px;
    }

    .playback-tag {
        border: none;
        cursor: pointer;
        background-color: var(--md-sys-color-primary-container, #cce8e8);
        color: var(--md-sys-color-on-primary-container, #002020);
        font-weight: 600;
        transition: opacity 0.15s;
    }

    .playback-tag:hover {
        opacity: 0.85;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.88rem;
    }

    .alert.warning {
        background-color: #fff3e0;
        color: #b26a00;
        border: 1px solid #ffe0b2;
    }

    .alert .material-symbols-outlined {
        font-size: 20px;
    }

    /* Single Song Sheet */
    .sheet-container {
        display: flex;
        justify-content: center;
    }

    .paper-preview {
        width: 100%;
        background: #ffffff;
        color: #000000;
        padding: 32px 40px;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        box-sizing: border-box;
    }

    /* Setlist Layout */
    .setlist-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: var(--md-sys-color-surface-container, #f4f4f7);
        border-radius: 12px;
        padding: 14px 16px;
        box-sizing: border-box;
    }

    .song-table {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .song-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--md-sys-color-surface, #ffffff);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .track-num {
        font-size: 0.85rem;
        font-weight: 700;
        opacity: 0.5;
        width: 22px;
        text-align: center;
        flex-shrink: 0;
    }

    .song-main {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        gap: 2px;
    }

    .song-title-text {
        font-size: 0.98rem;
        font-weight: 600;
        color: var(--md-sys-color-on-surface, #1b1b1f);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .song-artist-text {
        font-size: 0.8rem;
        color: var(--md-sys-color-on-surface-variant, #555);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .song-meta-side {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
    }

    .key-badge {
        font-size: 1rem;
        font-weight: 700;
        font-family: monospace;
        opacity: 0.7;
    }

    .play-btn {
        background: transparent;
        border: none;
        padding: 4px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--md-sys-color-on-surface-variant, #444);
        transition:
            color 0.15s,
            background 0.15s;
    }

    .play-btn:hover {
        background: rgba(0, 0, 0, 0.06);
        color: var(--md-sys-color-primary, #006666);
    }

    .play-btn.active {
        color: #1db954;
    }

    /* Bottom center action container */
    .bottom-center-action {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);

        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px 0 8px 0;
        width: 100%;
    }

    .bottom-center-action :global(md-filled-button) {
        min-width: 220px;
        height: 48px;
        font-size: 1rem;
        font-weight: 600;
    }

    @media (max-width: 600px) {
        .share-page-wrapper {
            padding: 12px 12px 24px 12px;
        }

        .paper-preview {
            padding: 20px 16px;
        }

        .bottom-center-action :global(md-filled-button) {
            width: 100%;
        }
    }
</style>
