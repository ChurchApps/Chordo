<script lang="ts">
    import { slide } from "svelte/transition"
    import { closePlayback, playbackState } from "$lib/state/playback.svelte"
    import { openExternalPlayback, parsePlaybackUrl } from "$lib/utils/playback"
    import storage from "$lib/storage/StorageManager.svelte"
    import { t } from "$lib/state/i18n.svelte"

    let currentSong = $derived(playbackState.songId ? storage.getSongById(playbackState.songId, storage.songs) : null)
    let playbackUrl = $derived(currentSong?.playbackUrl || currentSong?.spotify || currentSong?.getMetadata("playback") || currentSong?.getMetadata("spotify") || "")
    let info = $derived(parsePlaybackUrl(playbackUrl))
</script>

{#if playbackState.isOpen && info}
    <div class="playback-bar-container" transition:slide={{ duration: 250, axis: "y" }}>
        <div class="playback-bar">
            <div class="bar-header">
                <div class="provider-info">
                    {#if info.provider === "spotify"}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.307c-.216.353-.674.466-1.027.25-2.822-1.724-6.374-2.115-10.559-1.159-.404.093-.807-.16-.9-.564-.092-.404.161-.807.564-.9 4.582-1.047 8.514-.606 11.672 1.346.353.216.466.674.25 1.027zm1.465-3.262c-.272.441-.849.582-1.29.31-3.23-1.986-8.155-2.56-11.977-1.4-4.99.151-.989-.138-1.14-.637-.152-.499.138-.989.637-1.14 4.381-1.33 9.807-.687 13.46 1.577.441.272.582.849.31 1.29zm.126-3.41c-3.874-2.3-10.264-2.512-13.97-1.386-.595.181-1.226-.157-1.407-.752-.181-.595.157-1.226.752-1.407 4.257-1.293 11.31-1.045 15.772 1.603.535.318.708 1.01.39 1.545-.318.535-1.01.708-1.545.39z"/>
                        </svg>
                        <span class="provider-name">Spotify</span>
                    {:else if info.provider === "youtube"}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span class="provider-name">YouTube</span>
                    {/if}

                    {#if currentSong?.name}
                        <span class="song-title-badge">{currentSong.name}</span>
                    {/if}
                </div>

                <div class="bar-actions">
                    <button type="button" class="action-btn open-btn" onclick={() => openExternalPlayback(playbackUrl)} title={t("song_edit", "open_external")}>
                        <md-icon style="font-size: 16px;">open_in_new</md-icon>
                        <span>{info.provider === "spotify" ? "Spotify" : "YouTube"}</span>
                    </button>

                    <button type="button" class="action-btn close-btn" onclick={closePlayback} aria-label={t("common", "close")}>
                        <md-icon style="font-size: 18px;">close</md-icon>
                    </button>
                </div>
            </div>

            <div class="player-wrapper" class:spotify={info.provider === "spotify"} class:youtube={info.provider === "youtube"}>
                <iframe
                    title="Audio Player"
                    src={info.embedUrl}
                    width="100%"
                    height={info.provider === "spotify" ? "152" : "180"}
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                    class="player-iframe"
                    class:spotify={info.provider === "spotify"}
                    class:youtube={info.provider === "youtube"}
                ></iframe>
            </div>
        </div>
    </div>
{/if}

<style>
    .playback-bar-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        display: flex;
        justify-content: center;
        padding: 0 12px 12px 12px;
        pointer-events: none;
        view-transition-name: playback-bar;
    }

    .playback-bar {
        width: 100%;
        max-width: 680px;
        background: #1e1e1e;
        color: #ffffff;
        border-radius: 14px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.12);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
    }

    .bar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        background: #141414;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .provider-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .provider-name {
        color: #ffffff;
    }

    .song-title-badge {
        color: rgba(255, 255, 255, 0.6);
        font-weight: 400;
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .song-title-badge::before {
        content: "•";
        margin-right: 6px;
        opacity: 0.5;
    }

    .bar-actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .action-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background 0.15s, color 0.15s;
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
    }

    .open-btn {
        background: rgba(255, 255, 255, 0.08);
    }

    .player-wrapper {
        width: 100%;
        line-height: 0;
        background: #000000;
    }

    .player-wrapper.spotify {
        height: 152px;
        min-height: 152px;
    }

    .player-wrapper.youtube {
        aspect-ratio: 16 / 9;
        max-height: 220px;
    }

    .player-iframe {
        border: none;
        width: 100%;
        height: 100%;
        display: block;
    }

    .player-iframe.spotify {
        height: 152px;
        min-height: 152px;
    }
</style>
