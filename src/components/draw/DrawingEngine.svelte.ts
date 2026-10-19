import { createHistory, type HistoryManager } from "$lib/utils/history.svelte"
import storage from "$lib/storage/StorageManager.svelte"
import {
    type Stroke,
    type Point,
    type TextItem,
    renderDrawing,
    serializeDrawing,
    parseDrawingData,
    strokeHitsPoint,
    textHitsPoint,
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
    currentColor = $state(storage.settings.draw?.color || "#b3261e")
    customColor = $state("#ff4081")
    brushSize = $state(storage.settings.draw?.brushSize ?? 4)
    toolMode = $state<"pen" | "text" | "eraser">("pen")

    // Text insertion state
    activeTextPrompt = $state<{ x: number; y: number } | null>(null)

    colorInputRef: HTMLInputElement | null = null

    // Drawing internals
    strokes = $state<Stroke[]>([])
    texts = $state<TextItem[]>([])
    currentStroke: Stroke | null = null
    backgroundImage = $state<HTMLImageElement | null>(null)
    erasedThisStroke = false
    lastPoint: Point | null = null

    get hasContent(): boolean {
        return this.strokes.length > 0 || this.texts.length > 0 || this.backgroundImage !== null
    }

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
            if (this.loadedDataProp === undefined) {
                this.loadedDataProp = initialData || ""
                if (initialData) {
                    this.history.reset(initialData)
                    this.loadData(initialData)
                } else {
                    this.redraw()
                }
            } else {
                this.redraw()
            }
        }

        resizeAndScale()

        const resizeObserver = new ResizeObserver(() => resizeAndScale())
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement)
        }

        const preventTouchDefault = (e: TouchEvent) => {
            if (this.options.getEditable()) {
                e.preventDefault()
            }
        }

        canvas.addEventListener("touchstart", preventTouchDefault, { passive: false })
        canvas.addEventListener("touchmove", preventTouchDefault, { passive: false })
        canvas.addEventListener("touchend", preventTouchDefault, { passive: false })
        canvas.addEventListener("touchcancel", preventTouchDefault, { passive: false })

        return () => {
            resizeObserver.disconnect()
            canvas.removeEventListener("touchstart", preventTouchDefault)
            canvas.removeEventListener("touchmove", preventTouchDefault)
            canvas.removeEventListener("touchend", preventTouchDefault)
            canvas.removeEventListener("touchcancel", preventTouchDefault)
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
        e.preventDefault()

        const point = this.getPointerCoordinates(e)

        if (this.toolMode === "text") {
            // Place text at tapped location
            this.openTextInput(point)
            return
        }

        this.canvasRef?.setPointerCapture(e.pointerId)
        this.isDrawing = true
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
        e.preventDefault()

        const currentPoint = this.getPointerCoordinates(e)

        if (this.toolMode === "eraser") {
            this.eraseAt(currentPoint)
        } else if (this.toolMode === "pen") {
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
        e.preventDefault()
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

    openTextInput(point: Point) {
        this.activeTextPrompt = { x: point.x, y: point.y }
    }

    cancelTextInput() {
        this.activeTextPrompt = null
    }

    commitText(text: string) {
        if (!this.activeTextPrompt) return
        const trimmed = text.trim()
        if (trimmed) {
            // Linear scale from brush size: size 2 -> 16px, size 20 -> 34px
            const fontSize = 14 + this.brushSize
            this.texts.push({
                x: this.activeTextPrompt.x,
                y: this.activeTextPrompt.y,
                text: trimmed,
                color: this.currentColor,
                fontSize
            })
            this.redraw()
            this.history.push(this.getData())
            this.notifyChange()
        }
        this.activeTextPrompt = null
    }

    eraseAt(point: Point) {
        if (!this.ctx) return
        const threshold = Math.max(8, this.brushSize * 1.5)
        const strokesBefore = this.strokes.length
        this.strokes = this.strokes.filter((s) => !strokeHitsPoint(s, point.x, point.y, threshold))

        const canvasWidth = this.canvasRef ? this.canvasRef.width : 1000
        const textsBefore = this.texts.length
        this.texts = this.texts.filter((t) => !textHitsPoint(this.ctx!, t, point.x, point.y, threshold, canvasWidth))

        if (this.strokes.length !== strokesBefore || this.texts.length !== textsBefore) {
            this.redraw()
            this.erasedThisStroke = true
        }
    }

    redraw() {
        if (!this.ctx || !this.canvasRef) return
        renderDrawing(this.ctx, this.canvasRef, this.strokes, this.backgroundImage, this.texts)
    }

    loadData(data: string) {
        const parsed = parseDrawingData(data, (loadedImg) => {
            this.backgroundImage = loadedImg
            this.redraw()
        })
        this.strokes = parsed.strokes
        this.texts = parsed.texts
        this.backgroundImage = parsed.backgroundImage
        this.redraw()
    }

    getData(): string {
        return serializeDrawing(this.strokes, this.backgroundImage, this.texts)
    }

    clear() {
        this.strokes = []
        this.texts = []
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
        this.activeTextPrompt = null
        const data = this.getData()
        this.loadedDataProp = data
        if (this.options.onFinish) {
            this.options.onFinish(data)
        }
    }

    handleCustomColorClick() {
        const isCustomSelected = !this.options.getColors().includes(this.currentColor) && this.toolMode !== "eraser"
        if (isCustomSelected) {
            this.colorInputRef?.showPicker ? this.colorInputRef.showPicker() : this.colorInputRef?.click()
        } else {
            this.currentColor = this.customColor
            if (this.toolMode === "eraser") this.toolMode = "pen"
        }
    }

    handleCustomColorInput(e: Event) {
        const target = e.target as HTMLInputElement
        this.customColor = target.value
        this.currentColor = target.value
        if (this.toolMode === "eraser") this.toolMode = "pen"
    }

    selectPresetColor(color: string) {
        this.currentColor = color
        if (this.toolMode === "eraser") this.toolMode = "pen"
    }

    setToolMode(mode: "pen" | "text" | "eraser") {
        this.activeTextPrompt = null
        this.toolMode = mode
    }

    setBrushSize(size: number) {
        this.brushSize = size
    }
}
