import * as pdfjsLib from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url"

// Set worker source to bundled Vite URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export interface ProcessedPdfResult {
    imageUrls: string[]
    extractedText: string
}

export type PdfProgressCallback = (current: number, total: number) => void

/**
 * Reads a PDF file, renders each page into a PNG Data URL at 2x scale,
 * and extracts all embedded text items with preserved line structure.
 */
export async function processPdfFile(
    file: File,
    onProgress?: PdfProgressCallback
): Promise<ProcessedPdfResult> {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    const pdf = await loadingTask.promise

    const imageUrls: string[] = []
    const textPages: string[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (onProgress) {
            onProgress(pageNum, pdf.numPages)
        }

        const page = await pdf.getPage(pageNum)

        // 1. Render page as PNG image
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        canvas.width = viewport.width
        canvas.height = viewport.height

        if (context) {
            await page.render({ canvasContext: context, viewport, canvas } as any).promise
            imageUrls.push(canvas.toDataURL("image/png"))
        }

        // 2. Extract text content
        const textContent = await page.getTextContent()
        let pageText = ""
        let lastY: number | null = null

        for (const item of textContent.items) {
            if ("str" in item) {
                const strItem = item as { str: string; transform?: number[]; hasEOL?: boolean }
                const currentY = strItem.transform ? strItem.transform[5] : null

                // Add line break if y-coordinate changes or hasEOL is true
                if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
                    pageText += "\n"
                } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
                    pageText += " "
                }

                pageText += strItem.str
                if (strItem.hasEOL) {
                    pageText += "\n"
                }

                if (currentY !== null) {
                    lastY = currentY
                }
            }
        }

        if (pageText.trim()) {
            textPages.push(pageText.trim())
        }
    }

    return {
        imageUrls,
        extractedText: textPages.join("\n\n")
    }
}
