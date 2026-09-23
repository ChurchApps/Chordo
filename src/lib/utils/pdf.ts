export interface ProcessedPdfResult {
    imageUrls: string[]
    extractedText: string
}

export type PdfProgressCallback = (current: number, total: number) => void

export class PdfUnsupportedBrowserError extends Error {
    constructor(message = "PDF import is not supported by your browser.") {
        super(message)
        this.name = "PdfUnsupportedBrowserError"
    }
}

/**
 * Reads a PDF file, renders each page into a PNG Data URL at 2x scale,
 * and extracts all embedded text items with preserved line structure.
 */
export async function processPdfFile(
    file: File,
    onProgress?: PdfProgressCallback
): Promise<ProcessedPdfResult> {
    let pdfjsLib: any
    let pdfWorker: any

    try {
        pdfjsLib = await import("pdfjs-dist")
        pdfWorker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
    } catch (err) {
        console.error("Failed to load PDF.js library in this browser:", err)
        throw new PdfUnsupportedBrowserError(
            "Your browser does not support PDF import. Please convert the file to images or update your browser."
        )
    }

    try {
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
    } catch (err: any) {
        if (err instanceof PdfUnsupportedBrowserError) throw err
        console.error("Error processing PDF file:", err)
        throw new Error(err?.message || "Failed to process PDF file.")
    }
}
