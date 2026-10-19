export type Point = { x: number; y: number }
export type Stroke = { points: Point[]; color: string; lineWidth: number }
export type TextItem = { x: number; y: number; text: string; color: string; fontSize: number }
export type DrawingData = { v: number; strokes: Stroke[]; texts?: TextItem[]; background?: string }

export const ERASER_THRESHOLD = 12 // CSS pixels

export function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) {
        return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
    return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2)
}

export function strokeHitsPoint(stroke: Stroke, x: number, y: number, threshold = ERASER_THRESHOLD): boolean {
    const pts = stroke.points
    if (pts.length === 0) return false
    // Expand hit area by half the stroke width so thick lines are easy to erase
    const hitRadius = threshold + stroke.lineWidth / 2
    if (pts.length === 1) {
        return Math.sqrt((pts[0].x - x) ** 2 + (pts[0].y - y) ** 2) <= hitRadius
    }
    for (let i = 0; i < pts.length - 1; i++) {
        if (pointToSegmentDist(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= hitRadius) {
            return true
        }
    }
    return false
}

export function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontSize: number
): { lines: string[]; width: number; height: number; lineHeight: number } {
    ctx.save()
    ctx.font = `bold ${fontSize}px sans-serif`
    const lineHeight = fontSize * 1.25

    const rawParagraphs = text.split("\n")
    const lines: string[] = []
    let maxLineWidth = 0

    for (const paragraph of rawParagraphs) {
        if (!paragraph) {
            lines.push("")
            continue
        }
        const words = paragraph.split(" ")
        let currentLine = ""

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word
            const testWidth = ctx.measureText(testLine).width

            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine)
                maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
                currentLine = word
            } else {
                currentLine = testLine
            }
        }
        if (currentLine) {
            lines.push(currentLine)
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
        }
    }
    ctx.restore()

    const totalHeight = Math.max(lineHeight, lines.length * lineHeight)
    return {
        lines,
        width: Math.max(1, maxLineWidth),
        height: totalHeight,
        lineHeight
    }
}

export function textHitsPoint(
    ctx: CanvasRenderingContext2D,
    textItem: TextItem,
    x: number,
    y: number,
    threshold = ERASER_THRESHOLD,
    canvasWidth = 1000
): boolean {
    const maxWidth = Math.min(300, Math.max(80, canvasWidth - textItem.x - 16))
    const { width, height } = wrapText(ctx, textItem.text, maxWidth, textItem.fontSize)

    const minX = textItem.x - threshold
    const maxX = textItem.x + width + threshold
    const minY = textItem.y - threshold
    const maxY = textItem.y + height + threshold

    return x >= minX && x <= maxX && y >= minY && y <= maxY
}

export function renderDrawing(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    strokes: Stroke[],
    backgroundImage: HTMLImageElement | null,
    texts: TextItem[] = []
) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    if (backgroundImage) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
        ctx.restore()
    }

    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    for (const stroke of strokes) {
        if (stroke.points.length === 1) {
            ctx.beginPath()
            ctx.fillStyle = stroke.color
            ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.lineWidth / 2, 0, Math.PI * 2)
            ctx.fill()
        } else {
            ctx.beginPath()
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
            }
            ctx.strokeStyle = stroke.color
            ctx.lineWidth = stroke.lineWidth
            ctx.stroke()
        }
    }

    if (texts && texts.length > 0) {
        ctx.save()
        ctx.textBaseline = "top"
        for (const t of texts) {
            ctx.font = `bold ${t.fontSize}px sans-serif`
            ctx.fillStyle = t.color
            const maxWidth = Math.min(300, Math.max(80, canvas.width - t.x - 16))
            const { lines, lineHeight } = wrapText(ctx, t.text, maxWidth, t.fontSize)
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], t.x, t.y + i * lineHeight)
            }
        }
        ctx.restore()
    }
}

export function serializeDrawing(
    strokes: Stroke[],
    backgroundImage: HTMLImageElement | null,
    texts: TextItem[] = []
): string {
    if (strokes.length === 0 && !backgroundImage && texts.length === 0) return ""
    const data: DrawingData = { v: 2, strokes }
    if (texts.length > 0) data.texts = texts
    if (backgroundImage?.src) data.background = backgroundImage.src
    return JSON.stringify(data)
}

export function parseDrawingData(
    data: string,
    onBackgroundLoaded?: (img: HTMLImageElement) => void
): { strokes: Stroke[]; texts: TextItem[]; backgroundImage: HTMLImageElement | null } {
    if (!data) {
        return { strokes: [], texts: [], backgroundImage: null }
    }

    if (data.startsWith("{")) {
        try {
            const parsed = JSON.parse(data) as DrawingData
            if (parsed.v === 2) {
                let backgroundImage: HTMLImageElement | null = null
                if (parsed.background) {
                    const img = new Image()
                    img.crossOrigin = "anonymous"
                    if (onBackgroundLoaded) {
                        img.onload = () => onBackgroundLoaded(img)
                    }
                    img.src = parsed.background
                    backgroundImage = img
                }
                return {
                    strokes: parsed.strokes ?? [],
                    texts: parsed.texts ?? [],
                    backgroundImage
                }
            }
        } catch {
            // fall through to legacy handler
        }
    }

    // Legacy PNG data URL → treat as non-editable background layer
    const img = new Image()
    img.crossOrigin = "anonymous"
    if (onBackgroundLoaded) {
        img.onload = () => onBackgroundLoaded(img)
    }
    img.src = data

    return {
        strokes: [],
        texts: [],
        backgroundImage: img
    }
}
