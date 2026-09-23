import { createHistory, type HistoryManager } from "$lib/utils/history.svelte"
import storage from "$lib/storage/StorageManager.svelte"
import {
    type Stroke,
    type Point,
    renderDrawing,
    serializeDrawing,
    parseDrawingData,
    strokeHitsPoint,
    ERASER_THRESHOLD
} from "./drawUtils"

export interface DrawingEngineOptions {
    getEditable: () => boolean
    getInitialData: () => string
    getColors: () => string[]
    onChange?: (dataUrl: string) => void
    onFinish?: (dataUrl: string) => void
}

export class DrawingEngine {
    // Reactive Svelte 5 states
    canvasRef = $state<HTMLCanvasElement | null>(null)
    ctx = $state<CanvasRenderingContext2D | null>(null)
    isDrawing = $state(false)
    currentColor = $state(storage.settings.draw?.color || "#1d1b20")
    customColor = $state("#ff4081")
    brushSize = $state(storage.settings.draw?.brushSize ?? 4)
    toolMode = $state<"pen" | "eraser">("pen")

    colorInputRef: HTMLInputElement | null = null

    // Drawing internals
    strokes: Stroke[] = []
    currentStroke: Stroke | null = null
    backgroundImage: HTMLImageElement | null = null
    erasedThisStroke = false
    lastPoint: Point | null = null

    history: HistoryManager<string>
    private options: DrawingEngineOptions
    private initialSyncDone = false
    private loadedDataProp: string | undefined = undefined

    constructor(options: DrawingEngineOptions) {
        this.options = options

        const presetColors = options.getColors()
        const initialSettingColor = storage.settings.draw?.color
        if (initialSettingColor && !presetColors.includes(initialSettingColor)) {
            this.customColor = initialSettingColor
        }

        this.history = createHistory<string>(options.getInitialData(), {
            debounceMs: 0,
            onApply: (dataUrl) => {
                this.loadData(dataUrl)
                this.notifyChange()
            }
        })
    }

    syncSettings() {
        if (!this.initialSyncDone && storage.settings.draw) {
            if (storage.settings.draw.color) {
                this.currentColor = storage.settings.draw.color
                if (!this.options.getColors().includes(storage.settings.draw.color)) {
                    this.customColor = storage.settings.draw.color
                }
            }
            if (storage.settings.draw.brushSize !== undefined) {
                this.brushSize = storage.settings.draw.brushSize
            }
            this.initialSyncDone = true
        }
    }

    persistSettings() {
        if (!this.options.getEditable()) return
        const hasChanged =
            storage.settings.draw?.color !== this.currentColor ||
            storage.settings.draw?.brushSize !== this.brushSize

        if (hasChanged) {
            storage.settings.draw = {
                ...storage.settings.draw,
                color: this.currentColor,
                brushSize: this.brushSize
            }
            storage.persist()
        }
    }

    syncInitialData(data: string) {
        if (this.ctx && data !== this.loadedDataProp) {
            this.loadedDataProp = data
            this.history.reset(data)
            this.loadData(data)
        }
    }

    setupCanvas(canvas: HTMLCanvasElement | null): (() => void) | undefined {
        if (!canvas) {
            this.canvasRef = null
            this.ctx = null
            return
        }

        this.canvasRef = canvas
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return
        this.ctx = context

        const resizeAndScale = () => {
            const parent = canvas.parentElement
            if (!parent) return

            const rect = parent.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            const newWidth = rect.width * dpr
            const newHeight = rect.height * dpr

            if (canvas.width === newWidth && canvas.height === newHeight) return

            canvas.width = newWidth
            canvas.height = newHeight

            context.lineCap = "round"
            context.lineJoin = "round"
            context.setTransform(dpr, 0, 0, dpr, 0, 0)

            const initialData = this.options.getInitialData()
            if (this.loadedDataProp === undefined && initialData) {
                this.loadedDataProp = initialData
                this.history.reset(initialData)
                this.loadData(initialData)
            } else {
                this.redraw()
            }
        }

        resizeAndScale()

        const resizeObserver = new ResizeObserver(() => resizeAndScale())
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement)
        }

        return () => {
            resizeObserver.disconnect()
        }
    }

    getPointerCoordinates(e: PointerEvent): Point {
        if (!this.canvasRef) return { x: 0, y: 0 }
        const rect = this.canvasRef.getBoundingClientRect()
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }
    }

    startDrawing(e: PointerEvent) {
        if (!this.options.getEditable() || !this.ctx) return
        this.canvasRef?.setPointerCapture(e.pointerId)
        this.isDrawing = true
        const point = this.getPointerCoordinates(e)
        this.lastPoint = point

        if (this.toolMode === "eraser") {
            this.erasedThisStroke = false
            this.eraseAt(point)
        } else {
            this.currentStroke = { points: [point], color: this.currentColor, lineWidth: this.brushSize }
            this.ctx.beginPath()
            this.ctx.fillStyle = this.currentColor
            this.ctx.arc(point.x, point.y, this.brushSize / 2, 0, Math.PI * 2)
            this.ctx.fill()
        }
    }

    draw(e: PointerEvent) {
        if (!this.isDrawing || !this.options.getEditable() || !this.ctx || !this.lastPoint) return

        const currentPoint = this.getPointerCoordinates(e)

        if (this.toolMode === "eraser") {
            this.eraseAt(currentPoint)
        } else {
            if (!this.currentStroke) return
            this.currentStroke.points.push(currentPoint)
            this.ctx.beginPath()
            this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
            this.ctx.lineTo(currentPoint.x, currentPoint.y)
            this.ctx.strokeStyle = this.currentColor
            this.ctx.lineWidth = this.brushSize
            this.ctx.stroke()
        }

        this.lastPoint = currentPoint
    }

    stopDrawing(e: PointerEvent) {
        if (!this.isDrawing) return
        if (this.canvasRef?.hasPointerCapture(e.pointerId)) {
            this.canvasRef.releasePointerCapture(e.pointerId)
        }
        this.isDrawing = false
        this.lastPoint = null

        if (this.toolMode === "pen" && this.currentStroke) {
            this.strokes.push(this.currentStroke)
            this.currentStroke = null
            this.history.push(this.getData())
            this.notifyChange()
        } else if (this.toolMode === "eraser" && this.erasedThisStroke) {
            this.erasedThisStroke = false
            this.history.push(this.getData())
            this.notifyChange()
        }
    }

    eraseAt(point: Point) {
        const before = this.strokes.length
        this.strokes = this.strokes.filter((s) => !strokeHitsPoint(s, point.x, point.y, ERASER_THRESHOLD))
        if (this.strokes.length !== before) {
            this.redraw()
            this.erasedThisStroke = true
        }
    }

    redraw() {
        if (!this.ctx || !this.canvasRef) return
        renderDrawing(this.ctx, this.canvasRef, this.strokes, this.backgroundImage)
    }

    loadData(data: string) {
        const parsed = parseDrawingData(data, (loadedImg) => {
            this.backgroundImage = loadedImg
            this.redraw()
        })
        this.strokes = parsed.strokes
        this.backgroundImage = parsed.backgroundImage
        this.redraw()
    }

    getData(): string {
        return serializeDrawing(this.strokes, this.backgroundImage)
    }

    clear() {
        this.strokes = []
        this.backgroundImage = null
        this.redraw()
        this.history.push("")
        this.notifyChange()
    }

    notifyChange() {
        if (this.options.onChange && this.canvasRef) {
            this.options.onChange(this.getData())
        }
    }

    finish() {
        if (this.options.onFinish) {
            this.options.onFinish(this.getData())
        }
    }

    handleCustomColorClick() {
        const isCustomSelected = !this.options.getColors().includes(this.currentColor) && this.toolMode === "pen"
        if (isCustomSelected) {
            this.colorInputRef?.showPicker ? this.colorInputRef.showPicker() : this.colorInputRef?.click()
        } else {
            this.currentColor = this.customColor
            this.toolMode = "pen"
        }
    }

    handleCustomColorInput(e: Event) {
        const target = e.target as HTMLInputElement
        this.customColor = target.value
        this.currentColor = target.value
        this.toolMode = "pen"
    }

    selectPresetColor(color: string) {
        this.currentColor = color
        this.toolMode = "pen"
    }

    toggleEraser() {
        this.toolMode = this.toolMode === "eraser" ? "pen" : "eraser"
    }

    setBrushSize(size: number) {
        this.brushSize = size
    }
}
