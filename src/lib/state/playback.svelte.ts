export interface PlaybackState {
    isOpen: boolean
    songId: string | null
    customPlaybackUrl?: string | null
    customSongName?: string | null
}

export const playbackState = $state<PlaybackState>({
    isOpen: false,
    songId: null,
    customPlaybackUrl: null,
    customSongName: null
})

export function openPlayback(songId: string | null, customUrl?: string, customName?: string): void {
    playbackState.songId = songId
    playbackState.customPlaybackUrl = customUrl || null
    playbackState.customSongName = customName || null
    playbackState.isOpen = true
}

export function closePlayback(): void {
    playbackState.isOpen = false
    playbackState.songId = null
    playbackState.customPlaybackUrl = null
    playbackState.customSongName = null
}

export function togglePlayback(songId: string | null, customUrl?: string, customName?: string): void {
    if (playbackState.isOpen && (playbackState.songId === songId || (customUrl && playbackState.customPlaybackUrl === customUrl))) {
        closePlayback()
    } else {
        openPlayback(songId, customUrl, customName)
    }
}
