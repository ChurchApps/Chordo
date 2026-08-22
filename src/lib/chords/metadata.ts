export interface SongMetadata {
    artist?: string
    key?: string
    tempo?: string
    timeSignature?: string
    album?: string
    year?: string
    copyright?: string
    composer?: string
    capo?: string
    spotify?: string
    [key: string]: string | undefined
}

export interface MetadataConfig {
    key: Extract<keyof SongMetadata, string>
    label: string
    placeholder: string
    aliases: string[]
}

export const METADATA_CONFIGS: MetadataConfig[] = [
    {
        key: "artist",
        label: "Artist",
        placeholder: "e.g. John Newton",
        aliases: ["artist", "a", "subtitle", "st"]
    },
    {
        key: "key",
        label: "Key",
        placeholder: "e.g. G",
        aliases: ["key", "k"]
    },
    {
        key: "tempo",
        label: "Tempo",
        placeholder: "e.g. 120",
        aliases: ["tempo"]
    },
    {
        key: "timeSignature",
        label: "Time",
        placeholder: "e.g. 4/4",
        aliases: ["time", "timesignature"]
    },
    {
        key: "album",
        label: "Album",
        placeholder: "e.g. Amazing Grace",
        aliases: ["album"]
    },
    {
        key: "year",
        label: "Year",
        placeholder: "e.g. 2026",
        aliases: ["year", "published"]
    },
    {
        key: "composer",
        label: "Composer",
        placeholder: "e.g. John Newton",
        aliases: ["composer", "author", "writer", "t/m"]
    },
    {
        key: "copyright",
        label: "Copyright",
        placeholder: "e.g. Public Domain",
        aliases: ["copyright"]
    },
    {
        key: "capo",
        label: "Capo",
        placeholder: "e.g. 2",
        aliases: ["capo"]
    }
]

// Central mapping of any alias/directive/unbraced key to standard SongMetadata key
export const METADATA_ALIAS_MAP: Record<string, Extract<keyof SongMetadata, string> | "title"> = {
    title: "title",
    t: "title",
    playback: "playback",
    playback_url: "playback",
    playbackurl: "playback",
    spotify: "playback",
    spotify_url: "playback",
    spotifyurl: "playback",
    youtube: "playback",
    youtube_url: "playback",
    youtubeurl: "playback",
    audio: "playback"
}

export const ALL_METADATA_ALIASES = new Set<string>(["title", "t", "playback", "playback_url", "playbackurl", "spotify", "spotify_url", "spotifyurl", "youtube", "youtube_url", "youtubeurl", "audio"])

for (const cfg of METADATA_CONFIGS) {
    for (const alias of cfg.aliases) {
        const lower = alias.toLowerCase()
        METADATA_ALIAS_MAP[lower] = cfg.key
        ALL_METADATA_ALIASES.add(lower)
    }
}
