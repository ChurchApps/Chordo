export type Point = { x: number; y: number }
export type Stroke = { points: Point[]; color: string; lineWidth: number }
export type DrawingData = { v: number; strokes: Stroke[]; background?: string }

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

export function renderDrawing(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    strokes: Stroke[],
    backgroundImage: HTMLImageElement | null
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
}

export function serializeDrawing(strokes: Stroke[], backgroundImage: HTMLImageElement | null): string {
    if (strokes.length === 0 && !backgroundImage) return ""
    const data: DrawingData = { v: 2, strokes }
    if (backgroundImage?.src) data.background = backgroundImage.src
    return JSON.stringify(data)
}

export function parseDrawingData(
    data: string,
    onBackgroundLoaded?: (img: HTMLImageElement) => void
): { strokes: Stroke[]; backgroundImage: HTMLImageElement | null } {
    if (!data) {
        return { strokes: [], backgroundImage: null }
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
        backgroundImage: img
    }
}
