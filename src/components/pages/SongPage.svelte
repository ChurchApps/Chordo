<script lang="ts">
    import { onMount } from "svelte"
    import { menuState, savedFullscreenPosition, setActivePage, updatePageTitle } from "../../lib/state/menu.svelte"
    import storage from "../../lib/storage/StorageManager.svelte"
    import Song from "../song/Song.svelte"

    let listId = menuState.previousPages.find((a) => a.activePage === "list")?.contentId || null
    let list = $derived(listId ? storage.getListById(listId, storage.lists) : null)
    let songs = $derived(list ? list.songs : [menuState.contentId])

    onMount(() => {
        savedFullscreenPosition.index = null
    })

    // detect when scrolling to each song-item
    let previousSongId: string | null = null
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
                const songId = songItem.id
                if (songId === previousSongId) return
                previousSongId = songId

                const song = storage.getSongById(songId, storage.songs)
                const name = song?.name
                if (name) updatePageTitle(name)

                // TODO: this does not set the correct "sub" page index
                savedFullscreenPosition.index = currentIndex
                break
            }
        }
    }
</script>

<main onscroll={scrolling}>
    <div class="songs">
        {#each songs as songId}
            <Song {songId} />
        {/each}
    </div>
</main>

<div class="fab-container">
    <md-fab aria-label="Play" onclick={() => setActivePage("song_live", menuState.contentId)}>
        <span class="material-symbols-outlined" slot="icon">play_arrow</span>
    </md-fab>
</div>

<style>
    main {
        overflow-y: auto;
    }

    .songs {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 10px;
        /* padding: 10px; */
    }
</style>
