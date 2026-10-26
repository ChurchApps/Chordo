<script lang="ts">
    import { getExternalSong, getPlanAsList } from "$lib/integrations/integrationState.svelte"
    import { autoScrollState, registerScrollElement, setAutoScrollSpeed, stopAutoScroll, toggleAutoScrollPlay } from "$lib/state/autoScroll.svelte"
    import { fullscreenState, menuState, savedFullscreenPosition, setActivePage, updatePageTitle } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { enterFullscreen } from "$lib/utils/fullscreen"
    import "@material/web/slider/slider.js"
    import { onMount, tick } from "svelte"
    import Song from "../song/Song.svelte"

    let mainElement = $state<HTMLElement | null>(null)
    let songsElement = $state<HTMLElement | null>(null)

    $effect(() => {
        registerScrollElement(mainElement, songsElement)
        return () => {
            registerScrollElement(null, null)
            stopAutoScroll()
        }
    })

    let listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null)
    let allLists = $derived(storage.lists)
    let allSongs = $derived(storage.songs)
    let list = $derived(listId ? storage.getListById(listId, allLists) || getPlanAsList(listId) : null)
    let songs = $derived(list ? list.songs : menuState.contentId ? [{ id: menuState.contentId }] : [])

    let isNavigating = false

    onMount(() => {
        const targetIndex = savedFullscreenPosition.index
        if (targetIndex != null && targetIndex >= 0) {
            const currentItem = songs[targetIndex]
            if (currentItem?.type === "section") {
                menuState.contentId = null
                updatePageTitle(currentItem.name || "Section")
            } else if (currentItem?.id) {
                menuState.contentId = currentItem.id
                const song = storage.getSongById(currentItem.id, storage.songs) || getExternalSong(currentItem.id)
                if (song?.name) updatePageTitle(song.name)
            }

            tick().then(() => {
                if (mainElement) {
                    const songItems = Array.from(mainElement.querySelectorAll(".song-item-element")) as HTMLElement[]
                    if (songItems[targetIndex]) {
                        songItems[targetIndex].scrollIntoView({ behavior: "instant", block: "start" })
                    }
                }
            })
        }

        return () => {
            isNavigating = true
        }
    })

    let previousLyricsOnly = fullscreenState.lyricsOnly
    $effect(() => {
        const currentLyricsOnly = fullscreenState.lyricsOnly
        if (currentLyricsOnly !== previousLyricsOnly) {
            previousLyricsOnly = currentLyricsOnly
            const targetIdx = previousIndex ?? savedFullscreenPosition.index
            if (targetIdx !== null && targetIdx >= 0) {
                tick().then(() => {
                    if (mainElement) {
                        const songItems = Array.from(mainElement.querySelectorAll(".song-item-element")) as HTMLElement[]
                        if (songItems[targetIdx]) {
                            songItems[targetIdx].scrollIntoView({ behavior: "instant", block: "start" })
                        }
                    }
                })
            }
        }
    })

    function getVisibleSongIndex(): number {
        if (!mainElement) return savedFullscreenPosition.index ?? 0
        const songItems = Array.from(mainElement.querySelectorAll(".song-item-element")) as HTMLElement[]
        if (!songItems.length) return 0
        const offsetTop = mainElement.offsetTop
        const scrollTop = mainElement.scrollTop

        for (let i = songItems.length - 1; i >= 0; i--) {
            const itemTop = songItems[i].offsetTop - offsetTop
            if (scrollTop >= itemTop - 20 || i === 0) {
                savedFullscreenPosition.index = i
                return i
            }
        }
        savedFullscreenPosition.index = 0
        return 0
    }

    function openFullscreen(index: number) {
        isNavigating = true
        savedFullscreenPosition.pageIndex = null
        savedFullscreenPosition.index = index
        enterFullscreen()
        setActivePage("song_live", menuState.contentId)
    }

    function playFullscreen() {
        const currentIdx = getVisibleSongIndex()
        openFullscreen(currentIdx)
    }

    // detect when scrolling to each song-item
    let previousIndex: number | null = null
    function scrolling(e: Event) {
        if (isNavigating) return
        const container = e.currentTarget as HTMLElement
        const songItems = Array.from(container.querySelectorAll(".song-item-element")) as HTMLElement[]
        if (!songItems.length) return

        const offsetTop = container.offsetTop
        const scrollTop = container.scrollTop

        for (let i = songItems.length - 1; i >= 0; i--) {
            const itemTop = songItems[i].offsetTop - offsetTop
            if (scrollTop >= itemTop - 20 || i === 0) {
                if (i === previousIndex) return
                previousIndex = i

                const currentItem = songs[i]
                const itemId = currentItem?.id

                savedFullscreenPosition.index = i

                if (currentItem?.type === "section") {
                    menuState.contentId = null
                    updatePageTitle(currentItem.name || "Section")
                } else if (itemId) {
                    menuState.contentId = itemId
                    const song = storage.getSongById(itemId, storage.songs) || getExternalSong(itemId)
                    if (song?.name) updatePageTitle(song.name)
                }
                break
            }
        }
    }
</script>

<main bind:this={mainElement} onscroll={scrolling} class:auto-scrolling-active={autoScrollState.isActive}>
    <div class="songs" class:is-setlist={!!list} bind:this={songsElement}>
        {#each songs as songItem, idx ((songItem?.id ?? "song") + "-" + idx)}
            {@const isSection = songItem?.type === "section"}
            {@const songId = isSection ? null : (songItem?.id ?? null)}
            {@const currentSong = songId ? storage.getSongById(songId, allSongs) || getExternalSong(songId) : null}
            {@const targetKey = songItem?.transposed || currentSong?.lastTransposed}
            {@const isActiveSong = !isSection && songId === menuState.contentId}

            {#if isSection}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                    class="song-item-element section-divider"
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                        e.stopPropagation()
                        openFullscreen(idx)
                    }}
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.stopPropagation()
                            openFullscreen(idx)
                        }
                    }}
                >
                    <div class="section-divider-line"></div>
                    <div class="section-divider-title">{songItem.name}</div>
                    <div class="section-divider-line"></div>
                </div>
            {:else}
                <div
                    class="song-item-element song-wrapper"
                    class:active-print-song={isActiveSong}
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                        e.stopPropagation()
                        openFullscreen(idx)
                    }}
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.stopPropagation()
                            openFullscreen(idx)
                        }
                    }}
                >
                    <Song {songId} {targetKey} />
                </div>
            {/if}
        {/each}
    </div>
</main>

{#if autoScrollState.isActive}
    <div class="autoscroll-panel-container">
        <div class="autoscroll-panel">
            <button
                type="button"
                class="autoscroll-btn play-pause-btn"
                onclick={toggleAutoScrollPlay}
                title={autoScrollState.isPlaying ? "Pause auto scroll" : "Resume auto scroll"}
                aria-label={autoScrollState.isPlaying ? "Pause auto scroll" : "Resume auto scroll"}
            >
                <span class="material-symbols-outlined play-pause-icon">
                    {autoScrollState.isPlaying ? "pause" : "play_arrow"}
                </span>
            </button>

            <div class="autoscroll-slider-wrapper">
                <span class="material-symbols-outlined speed-icon" title="Speed">speed</span>
                <md-slider min="1" max="10" step="1" labeled value={autoScrollState.speed} oninput={(e: Event) => setAutoScrollSpeed(Number((e.target as HTMLInputElement).value) || autoScrollState.speed)} class="autoscroll-slider"></md-slider>
            </div>

            <button type="button" class="autoscroll-btn exit-btn" onclick={stopAutoScroll} title="Exit auto scroll" aria-label="Exit auto scroll">
                <span class="material-symbols-outlined exit-icon">close</span>
            </button>
        </div>
    </div>
{:else}
    <div class="fab-container">
        <md-fab aria-label="Play" onclick={playFullscreen}>
            <span class="material-symbols-outlined" slot="icon">play_arrow</span>
        </md-fab>
    </div>
{/if}

<style>
    main {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    main.auto-scrolling-active {
        margin: 0 !important;
        border-radius: 0 !important;
        height: 100vh !important;
        height: 100dvh !important;
        padding-top: calc(16px + env(safe-area-inset-top, 0px));
        padding-bottom: calc(90px + env(safe-area-inset-bottom, 0px));
    }

    .songs {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 20px;
    }

    .songs.is-setlist {
        padding-bottom: 88vh;
    }

    main.auto-scrolling-active .songs {
        will-change: transform;
    }

    .song-wrapper {
        cursor: pointer;
    }

    .section-divider {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        cursor: pointer;
    }

    .section-divider-line {
        flex: 1;
        height: 1px;
        background: var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.15));
    }

    .section-divider-title {
        font-weight: 600;
        font-size: 1.1rem;
        color: var(--md-sys-color-on-surface, #1b1b1f);
        letter-spacing: 0.5px;
    }

    @media print {
        .songs {
            gap: 0 !important;
            padding-bottom: 0 !important;
        }

        /* If an active song is marked for print, hide all other items and sections */
        .songs:has(.active-print-song) .song-item-element:not(.active-print-song) {
            display: none !important;
        }
    }

    .autoscroll-panel-container {
        position: fixed;
        bottom: 24px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100;
        pointer-events: none;
    }

    .autoscroll-panel {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--md-sys-color-surface-container-high, #2b2930);
        color: var(--md-sys-color-on-surface, #e6e1e5);
        border: 1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12));
        border-radius: 32px;
        padding: 6px 10px 6px 8px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        pointer-events: auto;
        min-width: 300px;
        max-width: calc(100vw - 32px);
    }

    .autoscroll-btn {
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition:
            opacity 0.15s,
            transform 0.1s,
            background-color 0.15s;
    }

    .autoscroll-btn:active {
        transform: scale(0.94);
    }

    .play-pause-icon {
        font-size: 24px;
    }

    .autoscroll-btn.exit-btn {
        background: transparent;
        color: var(--md-sys-color-on-surface-variant, rgba(255, 255, 255, 0.7));
        border: 1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.15));
        width: 36px;
        height: 36px;
    }

    .autoscroll-btn.exit-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--md-sys-color-on-surface, #ffffff);
    }

    .exit-icon {
        font-size: 20px;
    }

    .autoscroll-slider-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 2px 10px;
        min-width: 150px;
    }

    .speed-icon {
        font-size: 20px;
        opacity: 0.8;
        color: var(--md-sys-color-primary, #6750a4);
        flex-shrink: 0;
    }

    .autoscroll-slider {
        flex: 1;
        --md-slider-active-track-color: var(--md-sys-color-primary, #6750a4);
        --md-slider-handle-color: var(--md-sys-color-primary, #6750a4);
    }
</style>
