import { convertToChordPro } from "../chords/chordproConverter"
import { processPdfFile } from "./pdf"
import { Song, Songs } from "../models/Song"
import storage from "../storage/StorageManager.svelte"

/**
 * Reads a browser File object as a Data URL string.
 */
export function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export interface MediaProgressStatus {
    fileName: string
    currentPage: number
    totalPages: number
    message: string
}

export type MediaProgressCallback = (status: MediaProgressStatus) => void

/**
 * Imports media files (images or PDFs) into an existing Song.
 * Converts PDF pages into images and converts extracted text into ChordPro format.
 */
export async function importMediaFilesToSong(
    song: Song,
    files: File[],
    onProgress?: MediaProgressCallback
): Promise<void> {
    if (!song || !files.length) return

    let extractedTextCombined = ""

    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        const file = files[fileIdx]
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            onProgress?.({
                fileName: file.name,
                currentPage: 0,
                totalPages: 0,
                message: `Preparing ${file.name}...`
            })

            const { imageUrls, extractedText } = await processPdfFile(file, (pageNum, numPages) => {
                onProgress?.({
                    fileName: file.name,
                    currentPage: pageNum,
                    totalPages: numPages,
                    message: `Converting page ${pageNum} of ${numPages}...`
                })
            })

            for (const url of imageUrls) {
                await song.addImage(url)
            }
            if (extractedText) {
                if (extractedTextCombined) extractedTextCombined += "\n\n"
                extractedTextCombined += extractedText
            }
        } else {
            onProgress?.({
                fileName: file.name,
                currentPage: 1,
                totalPages: 1,
                message: `Importing ${file.name}...`
            })
            const dataUrl = await readFileAsDataURL(file)
            await song.addImage(dataUrl)
        }
    }

    if (extractedTextCombined.trim()) {
        const chordProContent = convertToChordPro(extractedTextCombined.trim())
        if (song.content && song.content.trim()) {
            song.content = song.content.trim() + "\n\n" + chordProContent
        } else {
            song.content = chordProContent
        }
    }

    storage.updateSong(song)
}

/**
 * Creates a new Song and imports media files (images or PDFs) into it.
 */
export async function createSongFromMediaFiles(
    files: File[],
    customTitle?: string,
    listId?: string | null,
    onProgress?: MediaProgressCallback
): Promise<Song> {
    const firstFileName = files[0]?.name.replace(/\.[^/.]+$/, "") || ""
    const title = customTitle?.trim() || firstFileName || "Untitled"

    const song = Songs.create({ name: title }, listId ?? null)
    await importMediaFilesToSong(song, files, onProgress)
    return song
}

/**
 * Rotates a song page image by the specified degrees and triggers live reactive update.
 */
export async function rotateSongImage(song: Song | null | undefined, index: number, degrees: number = 90): Promise<void> {
    if (!song) return
    await song.rotateImage(index, degrees)
    storage.updateSong(song)
}

/**
 * Moves a song page image position and triggers live reactive update.
 */
export function moveSongImage(song: Song | null | undefined, fromIndex: number, toIndex: number): void {
    if (!song) return
    song.moveImage(fromIndex, toIndex)
    storage.updateSong(song)
}

/**
 * Removes a song page image and triggers live reactive update.
 */
export async function removeSongImage(song: Song | null | undefined, index: number): Promise<void> {
    if (!song) return
    await song.removeImage(index)
    storage.updateSong(song)
}
