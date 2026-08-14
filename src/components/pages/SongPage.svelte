<script lang="ts">
    import { onMount, tick } from "svelte"
    import { menuState, savedFullscreenPosition, setActivePage, updatePageTitle } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import Song from "../song/Song.svelte"

    let mainElement = $state<HTMLElement | null>(null)

    let listId = $derived(menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null)
    let allLists = $derived(storage.lists)
    let allSongs = $derived(storage.songs)
    let list = $derived(listId ? storage.getListById(listId, allLists) : null)
    let songs = $derived(list ? list.songs : menuState.contentId ? [{ songId: menuState.contentId }] : [])

    onMount(async () => {
        const targetIndex = savedFullscreenPosition.index
        if (targetIndex != null && targetIndex >= 0) {
            await tick()
            if (mainElement) {
                const songItems = Array.from(mainElement.querySelectorAll(".paper-wrapper")) as HTMLElement[]
                if (songItems[targetIndex]) {
                    songItems[targetIndex].scrollIntoView({ behavior: "instant", block: "start" })
                }
            }
        }
    })

    function getVisibleSongIndex(): number {
        if (!mainElement) return savedFullscreenPosition.index ?? 0
        const songItems = Array.from(mainElement.querySelectorAll(".paper-wrapper")) as HTMLElement[]
        const offsetTop = mainElement.offsetTop
        const scrollTop = mainElement.scrollTop

        let currentIndex = songItems.length
        for (const songItem of songItems.reverse()) {
            currentIndex--

            const itemTop = songItem.offsetTop - offsetTop
            if (scrollTop >= itemTop - 20) {
                savedFullscreenPosition.index = currentIndex
                return currentIndex
            }
        }
        savedFullscreenPosition.index = 0
        return 0
    }

    function openFullscreen(index: number) {
        savedFullscreenPosition.index = index
        setActivePage("song_live", menuState.contentId)
    }

    function playFullscreen() {
        const currentIdx = getVisibleSongIndex()
        openFullscreen(currentIdx)
    }

    // detect when scrolling to each song-item
    let previousIndex: number | null = null
    function scrolling(e: Event) {
        const container = e.currentTarget as HTMLElement
        const songItems = Array.from(container.querySelectorAll(".paper-wrapper")) as HTMLElement[]

        const offsetTop = container.offsetTop
        const scrollTop = container.scrollTop

        let currentIndex = songItems.length
        for (const songItem of songItems.reverse()) {
            currentIndex--

            const itemTop = songItem.offsetTop - offsetTop
            if (scrollTop >= itemTop) {
                if (currentIndex === previousIndex) return
                previousIndex = currentIndex

                const songId = songItem.id
                const song = storage.getSongById(songId, storage.songs)
                const name = song?.name
                if (name) updatePageTitle(name)

                savedFullscreenPosition.index = currentIndex
                break
            }
        }
    }
</script>

<main bind:this={mainElement} onscroll={scrolling}>
    <div class="songs">
        {#each songs as songItem, idx (songItem?.songId ? songItem.songId + "-" + idx : idx)}
            {@const songId = songItem?.songId ?? null}
            {@const currentSong = songId ? storage.getSongById(songId, allSongs) : null}
            {@const targetKey = songItem?.transposed || currentSong?.lastTransposed}

            <div class="song-wrapper" role="button" tabindex="0" onclick={() => openFullscreen(idx)} onkeydown={(e) => e.key === "Enter" && openFullscreen(idx)}>
                <Song {songId} {targetKey} />
            </div>
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
</style>
