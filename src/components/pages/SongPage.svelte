<script lang="ts">
    import { onMount, tick } from "svelte"
    import { menuState, savedFullscreenPosition, setActivePage, updatePageTitle } from "$lib/state/menu.svelte"
    import { enterFullscreen } from "$lib/utils/fullscreen"
    import storage from "$lib/storage/StorageManager.svelte"
    import Song from "../song/Song.svelte"

    let mainElement = $state<HTMLElement | null>(null)

    let listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null)
    let allLists = $derived(storage.lists)
    let allSongs = $derived(storage.songs)
    let list = $derived(listId ? storage.getListById(listId, allLists) : null)
    let songs = $derived(list ? list.songs : menuState.contentId ? [{ id: menuState.contentId }] : [])

    let isNavigating = false

    onMount(() => {
        const targetIndex = savedFullscreenPosition.index
        if (targetIndex != null && targetIndex >= 0) {
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

                if (currentItem?.type === "section") {
                    if (currentItem.name) updatePageTitle(currentItem.name)
                } else if (itemId) {
                    const song = storage.getSongById(itemId, storage.songs)
                    if (song?.name) updatePageTitle(song.name)
                }

                savedFullscreenPosition.index = i
                break
            }
        }
    }
</script>

<main bind:this={mainElement} onscroll={scrolling}>
    <div class="songs">
        {#each songs as songItem, idx ((songItem?.id ?? "song") + "-" + idx)}
            {@const isSection = songItem?.type === "section"}
            {@const songId = isSection ? null : (songItem?.id ?? null)}
            {@const currentSong = songId ? storage.getSongById(songId, allSongs) : null}
            {@const targetKey = songItem?.transposed || currentSong?.lastTransposed}

            {#if isSection}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="song-item-element section-divider" role="button" tabindex="0" onclick={() => openFullscreen(idx)} onkeydown={(e) => e.key === "Enter" && openFullscreen(idx)}>
                    <div class="section-divider-line"></div>
                    <div class="section-divider-title">{songItem.name}</div>
                    <div class="section-divider-line"></div>
                </div>
            {:else}
                <div class="song-item-element song-wrapper" role="button" tabindex="0" onclick={() => openFullscreen(idx)} onkeydown={(e) => e.key === "Enter" && openFullscreen(idx)}>
                    <Song {songId} {targetKey} />
                </div>
            {/if}
        {/each}
    </div>
</main>

<div class="fab-container">
    <md-fab aria-label="Play" onclick={playFullscreen}>
        <span class="material-symbols-outlined" slot="icon">play_arrow</span>
    </md-fab>
</div>

<style>
    main {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    .songs {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 20px;
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
        color: var(--md-sys-color-primary);
        letter-spacing: 0.5px;
    }

    @media print {
        .songs {
            gap: 0 !important;
        }
    }
</style>
