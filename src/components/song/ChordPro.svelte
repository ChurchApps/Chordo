<script lang="ts">
    import { convertToChordPro } from "$lib/chords/chordproConverter"
    import { parseChordPro } from "$lib/chords/chordproParser"
    import { ALL_METADATA_ALIASES, METADATA_CONFIGS } from "$lib/chords/metadata"
    import { calculateTransposeSemitones } from "$lib/chords/transpose"
    import { FileSystem } from "$lib/storage/FileSystem"
    import storage from "$lib/storage/StorageManager.svelte"

    let {
        songId,
        targetKey,
        semitones,
        showMeta = false,
        numColumns = 1,
        lightMode = false,
        fitParent = true
    } = $props<{
        songId: string | null
        targetKey?: string
        semitones?: number
        showMeta?: boolean
        numColumns?: number
        lightMode?: boolean
        fitParent?: boolean
    }>()

    // do some optimization to the rendering if light mode
    lightMode

    let song = $derived(storage.getSongById(songId, storage.songs))

    // Ensure rendered content is in ChordPro format without modifying original song content
    let chordProContent = $derived.by(() => {
        const raw = song?.content || ""
        if (!raw) return ""
        if (raw.includes("[") || raw.includes("{")) {
            return raw
        }
        return convertToChordPro(raw)
    })

    // Calculate effective semitones to transpose
    let effectiveSemitones = $derived(
        calculateTransposeSemitones({
            semitones,
            targetKey,
            lastTransposed: song?.lastTransposed,
            songKey: song?.getMetadata("key"),
            content: chordProContent
        })
    )

    let parsed = $derived(parseChordPro(chordProContent, effectiveSemitones))
    let imageWebUrls = $state<string[]>([])

    $effect(() => {
        if (song?.images && song.images.length > 0) {
            Promise.all(song.images.map((img) => FileSystem.resolveImageUrl(img))).then((urls) => {
                imageWebUrls = urls
            })
        } else {
            imageWebUrls = []
        }
    })

    function isMetadataDirective(key: string | undefined) {
        if (!key) return false
        return ALL_METADATA_ALIASES.has(key.toLowerCase())
    }
</script>

{#if imageWebUrls.length > 0}
    <div class="image-song-container" class:fitParent>
        {#each imageWebUrls as imageSrc, i}
            <div class="image-page" class:fitParent>
                <img src={imageSrc} alt={"Page " + (i + 1)} />
            </div>
        {/each}
    </div>
{:else if parsed}
    <div class="chordpro-container" style="--num-columns: {numColumns};">
        <div class="song-header">
            {#if song?.name}
                <div class="song-title">{song.name}</div>
            {/if}
            {#if showMeta}
                <div class="song-meta">
                    {#each METADATA_CONFIGS as cfg}
                        {@const val = parsed.metadata[cfg.key] || song?.getMetadata(cfg.key)}
                        {#if val}
                            <span class="meta-item">{cfg.label}: {val}</span>
                        {/if}
                    {/each}
                </div>
            {/if}
        </div>

        {#each parsed.lines as line}
            {@const hasChords = line.tokens?.some((token) => token.chord)}

            {#if line.type === "empty"}
                <div class="line empty">&nbsp;</div>
            {:else if line.type === "directive"}
                {#if !isMetadataDirective(line.directiveKey)}
                    <div class="line directive">
                        {#if line.directiveKey === "verse"}
                            {line.directiveValue}
                        {:else}
                            {line.directiveKey}{line.directiveValue ? ": " + line.directiveValue : ""}
                        {/if}
                    </div>
                {/if}
            {:else if line.type === "comment"}
                <div class="line comment">{line.directiveValue}</div>
            {:else if line.type === "lyrics"}
                <div class="line lyrics-line">
                    {#each line.tokens as token}
                        <span class="token">
                            {#if hasChords}
                                {#if token.chord}
                                    <span class="chord-cell">{token.chord}</span>
                                {:else}
                                    <span class="chord-cell placeholder">&nbsp;</span>
                                {/if}
                            {/if}

                            <span class="lyric-cell">{token.lyric}</span>
                        </span>
                    {/each}
                </div>
            {/if}
        {/each}
    </div>
{/if}

<style>
    .chordpro-container {
        width: 100%;
        height: 100%;
        flex: 1;
        box-sizing: border-box;
        column-count: var(--num-columns, 1);
        -webkit-column-count: var(--num-columns, 1);
        column-gap: 1.5rem;
        column-fill: auto; /* Fill column 1 to bottom before wrapping to column 2 */

        pointer-events: none;
    }

    .song-header {
        text-align: center;
        margin-bottom: 12px;
        column-span: all; /* Title/Metadata spans across all columns */
        -webkit-column-span: all;
    }

    .line {
        break-inside: avoid; /* Keeps lyric lines from splitting mid-line across columns */
        -webkit-column-break-inside: avoid;
        page-break-inside: avoid;
    }

    .lyrics-line {
        white-space: pre-wrap;
        font-size: 1rem;
        line-height: 1.2;
    }
    .token {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        vertical-align: baseline;
        white-space: pre;
    }
    .chord-cell {
        line-height: 1;
        font-family: monospace;
        font-weight: 700;
        font-size: 1.1rem;
        margin-bottom: 1px;
        color: #5498be;
        text-align: left;
    }
    .lyric-cell {
        display: inline-block;
        white-space: pre-wrap;
        text-align: left;
    }
    .chord-cell.placeholder {
        color: transparent;
        user-select: none;
    }
    .directive {
        font-weight: 500;
        color: #5498be;
        margin: 4px 0;

        text-transform: capitalize;
    }
    .comment {
        font-weight: 600;
        color: #2e7d32;
        margin: 4px 0;
    }
    .line.empty {
        height: 8px;
    }
    .song-title {
        font-size: 1.6rem;
        font-weight: 800;
        margin-bottom: 4px;
    }
    .song-meta {
        font-size: 0.95rem;
        color: #444;
    }
    .song-meta .meta-item {
        margin-right: 12px;
    }

    /* image */

    .image-song-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 16px;

        pointer-events: none;
    }

    .image-page {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        page-break-after: always;
        break-after: page;
        flex-shrink: 0;
    }

    .image-page img {
        max-width: 100%;
        height: auto;
        width: auto;
        object-fit: contain;
        display: block;
    }
</style>
