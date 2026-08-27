<script lang="ts">
    import { convertToChordPro } from "$lib/chords/chordproConverter"
    import { parseChordPro } from "$lib/chords/chordproParser"
    import { ALL_METADATA_ALIASES, METADATA_CONFIGS } from "$lib/chords/metadata"
    import { calculateTransposeSemitones } from "$lib/chords/transpose"
    import { FileSystem } from "$lib/storage/FileSystem"
    import storage from "$lib/storage/StorageManager.svelte"

    let {
        songId,
        song: customSong,
        targetKey,
        semitones,
        showMeta = false,
        numColumns = 1,
        lightMode = false, // do some optimization to the rendering if light mode
        fitParent = true,
        hideChords = false
    } = $props<{
        songId?: string | null
        song?: any
        targetKey?: string
        semitones?: number
        showMeta?: boolean
        numColumns?: number
        lightMode?: boolean
        fitParent?: boolean
        hideChords?: boolean
    }>()

    import { Song } from "$lib/models/Song"

    let rawSong = $derived(customSong ?? storage.getSongById(songId ?? null, storage.songs))
    let song = $derived(rawSong ? (rawSong instanceof Song ? rawSong : new Song(rawSong)) : null)

    // Ensure rendered content is in ChordPro format without modifying original song content
    let chordProContent = $derived.by(() => {
        const raw = song?.content || ""
        if (!raw) return ""
        return convertToChordPro(raw)
    })

    // Calculate effective semitones to transpose
    let effectiveSemitones = $derived(
        calculateTransposeSemitones({
            semitones,
            targetKey,
            lastTransposed: song?.lastTransposed,
            songKey: typeof song?.getMetadata === "function" ? song.getMetadata("key") : (song?.metadata?.key ?? ""),
            content: chordProContent
        })
    )

    let parsed = $derived(parseChordPro(chordProContent, effectiveSemitones))
    let imageWebUrls = $state<string[]>([])

    $effect(() => {
        if (song?.images && song.images.length > 0) {
            Promise.all(song.images.map((img: string) => FileSystem.resolveImageUrl(img))).then((urls) => {
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
    <div class="chordpro-container" class:hide-chords={hideChords} style="--num-columns: {numColumns};">
        <div class="song-header">
            {#if song?.name}
                <div class="song-title">{song.name}</div>
            {/if}
            {#if showMeta}
                {@const artist = parsed.metadata.artist || (typeof song?.getMetadata === "function" ? song.getMetadata("artist") : song?.metadata?.artist)}
                {@const keyVal = parsed.metadata.key || (typeof song?.getMetadata === "function" ? song.getMetadata("key") : song?.metadata?.key)}
                {@const tempo = parsed.metadata.tempo || (typeof song?.getMetadata === "function" ? song.getMetadata("tempo") : song?.metadata?.tempo)}
                {@const timeSig = parsed.metadata.timeSignature || (typeof song?.getMetadata === "function" ? song.getMetadata("timeSignature") : song?.metadata?.timeSignature)}
                {@const capo = parsed.metadata.capo || (typeof song?.getMetadata === "function" ? song.getMetadata("capo") : song?.metadata?.capo)}
                {@const tempoFormatted = tempo ? (timeSig ? `${tempo} BPM ${timeSig}` : `${tempo} BPM`) : timeSig}
                <div class="song-meta">
                    {#if artist}
                        <div class="row">
                            <span class="meta-item">{artist}</span>
                        </div>
                    {/if}

                    <div class="row">
                        {#if keyVal}
                            <span class="meta-item">Key: {keyVal}</span>
                        {/if}
                        {#if tempoFormatted}
                            <span class="meta-item"> • </span>
                            <span class="meta-item">{tempo ? tempoFormatted : tempoFormatted}</span>
                        {/if}
                        {#if capo}
                            <span class="meta-item"> • </span>
                            <span class="meta-item">Capo: {capo}</span>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        {#each parsed.sections as section}
            <div class="chordpro-section">
                {#each section.lines as line}
                    {@const hasChords = !hideChords && line.tokens?.some((token) => token.chord)}

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
                        {#if !hideChords || line.tokens?.some((t) => t.lyric && t.lyric.trim() !== "")}
                            <div class="line lyrics-line">
                                {#each line.words ?? [{ tokens: line.tokens ?? [] }] as word}
                                    <span class="word">
                                        {#each word.tokens as token}
                                            <span class="token">
                                                {#if hasChords}
                                                    {#if token.chord}
                                                        <span class="chord-cell">{token.chord}</span>
                                                    {:else}
                                                        <span class="chord-cell placeholder">&nbsp;</span>
                                                    {/if}
                                                {/if}

                                                <span class="lyric-cell">{token.lyric || "\u200B"}</span>
                                            </span>
                                        {/each}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                    {/if}
                {/each}
            </div>
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
        column-gap: 0.8rem;
        column-fill: auto; /* Fill column 1 to bottom before wrapping to column 2 */

        pointer-events: none;
    }

    .song-header {
        text-align: center;
        margin-bottom: 12px;
        column-span: all; /* Title/Metadata spans across all columns */
        -webkit-column-span: all;
    }

    .chordpro-section {
        break-inside: avoid; /* Prevents splitting a section across columns or pages */
        -webkit-column-break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 25px;
    }

    .chordpro-section:last-child {
        margin-bottom: 0;
    }

    .chordpro-section:empty {
        display: none;
    }

    .line {
        break-inside: avoid; /* Keeps lyric lines from splitting mid-line across columns */
        -webkit-column-break-inside: avoid;
        page-break-inside: avoid;
        text-wrap: pretty;
    }

    .lyrics-line {
        white-space: pre-wrap;
        font-size: calc(1rem * var(--font-scale, 1));
        line-height: 1.4;
        word-break: normal;
        overflow-wrap: break-word;
        text-wrap: balance;
    }
    .hide-chords .lyrics-line {
        line-height: 1.2;
        margin-bottom: 3px;
    }
    .word {
        display: inline-flex;
        align-items: flex-end;
        white-space: pre-wrap;
        max-width: 100%;
    }
    .token {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        vertical-align: baseline;
        white-space: pre-wrap;
        max-width: 100%;
    }

    .chord-cell {
        line-height: 0.9;
        font-family: monospace;
        font-weight: 700;
        font-size: calc(1rem * var(--font-scale, 1));
        margin-bottom: 1px;
        color: var(--chord-color, #5498be);
        text-align: left;
        white-space: pre-wrap;
        word-break: normal;
        overflow-wrap: break-word;
        max-width: 100%;
        padding-right: 0.3em;
    }
    .lyric-cell {
        display: inline-block;
        white-space: pre-wrap;
        text-align: left;
        min-height: 1.1em;
        line-height: 1.1;
    }

    .chord-cell.placeholder {
        color: transparent;
        user-select: none;
        padding-right: 0;
    }

    .directive {
        font-weight: 500;
        font-size: calc(0.95rem * var(--font-scale, 1));
        color: var(--chord-color, #5498be);
        margin: 4px 0;

        text-transform: capitalize;
    }
    .comment {
        font-weight: 600;
        font-size: calc(0.95rem * var(--font-scale, 1));
        color: var(--comment-color, #306685);
        margin: 4px 0;

        /* text-transform: uppercase; */
    }
    .line.empty {
        height: 8px;
    }
    .song-title {
        font-size: calc(1.6rem * var(--font-scale, 1));
        font-weight: 800;
        margin-bottom: 2px;
    }
    .song-meta {
        display: flex;
        flex-direction: column;

        font-size: calc(0.95rem * var(--font-scale, 1));
        opacity: 0.75;
    }
    .song-meta .row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
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
