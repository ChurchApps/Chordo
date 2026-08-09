<script lang="ts">
    import { parseChordPro } from "../../lib/chords/chordproParser"
    import storage from "../../lib/storage/StorageManager.svelte"

    let {
        songId,
        showMeta = false,
        numColumns = 1
    } = $props<{
        songId: string | null
        showMeta?: boolean
        numColumns?: number
    }>()

    let song = $derived(storage.getSongById(songId, storage.songs))
    let parsed = $derived(parseChordPro(song?.content || ""))

    const metadataDirectiveKeys = ["title", "t", "artist", "a", "subtitle", "st", "key", "k", "tempo", "time", "capo"]
    function isMetadataDirective(key: string | undefined) {
        if (!key) return false
        return metadataDirectiveKeys.includes(key.toLowerCase())
    }
</script>

{#if parsed}
    <div class="chordpro-container" style="--num-columns: {numColumns};">
        <div class="song-header">
            {#if song?.name}
                <div class="song-title">{song.name}</div>
            {/if}
            <!-- {#if parsed.metadata.title}
                <div class="song-title">{parsed.metadata.title}</div>
            {/if} -->
            {#if showMeta}
                <div class="song-meta">
                    {#if parsed.metadata.key}
                        <span class="meta-item">Key: {parsed.metadata.key}</span>
                    {/if}
                    {#if parsed.metadata.timeSignature}
                        <span class="meta-item">Time: {parsed.metadata.timeSignature}</span>
                    {/if}
                    {#if parsed.metadata.tempo}
                        <span class="meta-item">Tempo: {parsed.metadata.tempo}</span>
                    {/if}
                    {#if parsed.metadata.capo}
                        <span class="meta-item">Capo: {parsed.metadata.capo}</span>
                    {/if}
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
</style>
