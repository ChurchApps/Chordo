export interface PlaybackState {
    isOpen: boolean
    songId: string | null
}

export const playbackState = $state<PlaybackState>({
    isOpen: false,
    songId: null
})

export function openPlayback(songId: string): void {
    playbackState.songId = songId
    playbackState.isOpen = true
}

export function closePlayback(): void {
    playbackState.isOpen = false
    playbackState.songId = null
}

export function togglePlayback(songId: string): void {
    if (playbackState.isOpen && playbackState.songId === songId) {
        playbackState.isOpen = false
    } else {
        playbackState.songId = songId
        playbackState.isOpen = true
    }
}
