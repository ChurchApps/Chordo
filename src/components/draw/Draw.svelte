<script lang="ts">
    // Import Material Web Components
    import "@material/web/button/filled-button.js"
    import "@material/web/button/filled-tonal-button.js"
    import "@material/web/button/text-button.js"
    import "@material/web/dialog/dialog.js"
    import "@material/web/icon/icon.js"
    import "@material/web/slider/slider.js"

    import { openConfirm } from "$lib/state/confirm.svelte"
    import { t } from "$lib/state/i18n.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import { createHistory } from "$lib/utils/history.svelte"

    interface Props {
        /** Enable or disable drawing capabilities (defaults to false) */
        editable?: boolean
        /** Base64 PNG Data URL of an existing drawing to load */
        initialData?: string
        /** Color choices preset list */
        colors?: string[]
        /** Callback triggered whenever a stroke finishes or canvas clears */
        onChange?: (dataUrl: string) => void
        /** Callback triggered when user clicks the Check / Finish button */
        onFinish?: (dataUrl: string) => void
    }

    let {
        editable = false,
        initialData = "",
        colors = [
            "#1d1b20", // M3 On Surface / Black
            "#b3261e", // M3 Error / Red
            "#6750a4", // M3 Primary / Purple
            "#00639b", // M3 Blue
            "#2e6a4f", // M3 Green
            "#8e4900", // M3 Orange
            "#ffffff" // White
        ],
        onChange,
        onFinish
    }: Props = $props()

    // Component State (Runes)
    let canvasRef = $state<HTMLCanvasElement | null>(null)
    let ctx = $state<CanvasRenderingContext2D | null>(null)
    let isDrawing = $state(false)
    let currentColor = $state(storage.settings.draw?.color || "#1d1b20")
    let brushSize = $state(storage.settings.draw?.brushSize ?? 4)
    let lastPoint = $state<{ x: number; y: number } | null>(null)

    // History Manager for Drawing
    const drawHistory = createHistory<string>(initialData, {
        debounceMs: 0,
        onApply: (dataUrl) => {
            loadInitialData(dataUrl)
            notifyChange()
        }
    })

    let initialSyncDone = false
    $effect(() => {
        if (!initialSyncDone && storage.settings.draw) {
            if (storage.settings.draw.color) currentColor = storage.settings.draw.color
            if (storage.settings.draw.brushSize !== undefined) brushSize = storage.settings.draw.brushSize
            initialSyncDone = true
        }
    })

    $effect(() => {
        if (editable) {
            const hasChanged = storage.settings.draw?.color !== currentColor || storage.settings.draw?.brushSize !== brushSize
            if (hasChanged) {
                storage.settings.draw = {
                    ...storage.settings.draw,
                    color: currentColor,
                    brushSize: brushSize
                }
                storage.persist()
            }
        }
    })

    // Function to check if canvas actually contains any drawn pixels
    function isCanvasBlank(): boolean {
        if (!canvasRef || !ctx) return true
        const w = canvasRef.width
        const h = canvasRef.height
        if (w === 0 || h === 0) return true

        // Read pixel buffer
        const imgData = ctx.getImageData(0, 0, w, h)
        const data = new Uint32Array(imgData.data.buffer)
        for (let i = 0; i < data.length; i++) {
            if (data[i] !== 0) return false
        }
        return true
    }

    // Export helper: get current drawing as Base64 Data URL
    export function getDrawingData(): string {
        if (!canvasRef || isCanvasBlank()) return ""
        return canvasRef.toDataURL("image/png")
    }

    // Export helper: clear canvas
    export function clearCanvas() {
        if (!ctx || !canvasRef) return
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)
        ctx.restore()
        drawHistory.push("")
        notifyChange()
    }

    function handleClearRequest() {
        openConfirm({
            title: t("draw", "clear_title"),
            message: t("draw", "clear_msg"),
            confirmLabel: t("draw", "clear"),
            isDestructive: true,
            onConfirm: () => {
                clearCanvas()
            }
        })
    }

    function notifyChange() {
        if (onChange && canvasRef) {
            onChange(getDrawingData())
        }
    }

    function handleFinish() {
        const data = getDrawingData()
        if (onFinish) {
            onFinish(data)
        }
    }

    // Load image data onto canvas
    function loadInitialData(dataUrl: string) {
        if (!ctx || !canvasRef) return
        if (!dataUrl) {
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)
            ctx.restore()
            return
        }
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            if (!ctx || !canvasRef) return
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)
            ctx.drawImage(img, 0, 0, canvasRef.width, canvasRef.height)
            ctx.restore()
        }
        img.src = dataUrl
    }

    let loadedDataProp: string | undefined = undefined

    // Canvas Lifecycle & High-DPI Scaling Effect
    $effect(() => {
        if (!canvasRef) return

        const canvas = canvasRef
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return
        ctx = context

        const resizeAndScale = () => {
            const parent = canvas.parentElement
            if (!parent) return

            const rect = parent.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            const newWidth = rect.width * dpr
            const newHeight = rect.height * dpr

            if (canvas.width === newWidth && canvas.height === newHeight) return

            const hasContent = !isCanvasBlank() && canvas.width > 0 && canvas.height > 0
            const tempCanvas = document.createElement("canvas")
            tempCanvas.width = canvas.width
            tempCanvas.height = canvas.height
            const tempCtx = tempCanvas.getContext("2d")
            if (tempCtx && hasContent) {
                tempCtx.drawImage(canvas, 0, 0)
            }

            // Adjust physical pixel dimensions
            canvas.width = newWidth
            canvas.height = newHeight

            // Set styling / transformation on context
            context.lineCap = "round"
            context.lineJoin = "round"
            context.setTransform(dpr, 0, 0, dpr, 0, 0)

            if (hasContent) {
                context.save()
                context.setTransform(1, 0, 0, 1, 0, 0)
                context.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
                context.restore()
            } else if (loadedDataProp === undefined && initialData) {
                loadedDataProp = initialData
                drawHistory.reset(initialData)
                loadInitialData(initialData)
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
    })

    // Load updated initialData if prop changes from outside
    $effect(() => {
        const data = initialData
        if (ctx && data !== loadedDataProp) {
            loadedDataProp = data
            drawHistory.reset(data)
            loadInitialData(data)
        }
    })

    function getPointerCoordinates(e: PointerEvent) {
        if (!canvasRef) return { x: 0, y: 0 }
        const rect = canvasRef.getBoundingClientRect()
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }
    }

    function startDrawing(e: PointerEvent) {
        if (!editable || !ctx) return
        canvasRef?.setPointerCapture(e.pointerId)
        isDrawing = true
        const point = getPointerCoordinates(e)
        lastPoint = point

        ctx.beginPath()
        ctx.fillStyle = currentColor
        ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2)
        ctx.fill()
    }

    function draw(e: PointerEvent) {
        if (!isDrawing || !editable || !ctx || !lastPoint) return

        const currentPoint = getPointerCoordinates(e)

        ctx.beginPath()
        ctx.moveTo(lastPoint.x, lastPoint.y)
        ctx.lineTo(currentPoint.x, currentPoint.y)
        ctx.strokeStyle = currentColor
        ctx.lineWidth = brushSize
        ctx.stroke()

        lastPoint = currentPoint
    }

    function stopDrawing(e: PointerEvent) {
        if (!isDrawing) return
        if (canvasRef?.hasPointerCapture(e.pointerId)) {
            canvasRef.releasePointerCapture(e.pointerId)
        }
        isDrawing = false
        lastPoint = null
        drawHistory.push(getDrawingData())
        notifyChange()
    }

    function handleSliderInput(e: Event) {
        const target = e.target as HTMLInputElement
        if (target && target.value !== undefined) {
            brushSize = Number(target.value)
        }
    }
</script>

<svelte:window onkeydown={(e) => { if (editable) drawHistory.handleKeyDown(e) }} />

<div class="m3-drawing-container">
    <canvas bind:this={canvasRef} class="drawing-canvas" class:interactive={editable} onpointerdown={startDrawing} onpointermove={draw} onpointerup={stopDrawing} onpointercancel={stopDrawing}></canvas>

    {#if editable}
        <!-- Top Left Toolbar (Clear, Undo, Redo Actions) -->
        <header class="m3-top-left-bar">
            <md-filled-tonal-button type="button" onclick={handleClearRequest}>
                <md-icon slot="icon">delete</md-icon>
                {t("draw", "clear")}
            </md-filled-tonal-button>

            <md-filled-tonal-button type="button" disabled={!drawHistory.canUndo} onclick={() => drawHistory.undo()} title={`${t("common", "undo")} (Ctrl+Z)`}>
                <md-icon slot="icon">undo</md-icon>
                {t("common", "undo")}
            </md-filled-tonal-button>

            <md-filled-tonal-button type="button" disabled={!drawHistory.canRedo} onclick={() => drawHistory.redo()} title={`${t("common", "redo")} (Ctrl+Y)`}>
                <md-icon slot="icon">redo</md-icon>
                {t("common", "redo")}
            </md-filled-tonal-button>
        </header>

        <!-- Bottom Floating Toolbar -->
        <footer class="m3-bottom-app-bar">
            <!-- Scrollable Color Swatches -->
            <div class="color-picker-group">
                {#each colors as color}
                    <button type="button" class="m3-color-chip" class:selected={currentColor === color} style="--chip-color: {color};" aria-label="Select color {color}" onclick={() => (currentColor = color)}>
                        {#if currentColor === color}
                            <md-icon class="check-icon" style="color: {color === '#ffffff' ? '#000000' : '#ffffff'}"> check </md-icon>
                        {/if}
                    </button>
                {/each}

                <!-- Custom Color Button Wrapper -->
                <label class="custom-color-wrapper" title="Choose custom color">
                    <md-icon class="palette-icon">palette</md-icon>
                    <input type="color" bind:value={currentColor} class="custom-color-input" />
                </label>
            </div>

            <div class="m3-divider"></div>

            <!-- Brush Size Selector -->
            <div class="brush-size-group">
                <div class="brush-preview-container">
                    <span class="brush-preview" style="width: {brushSize}px; height: {brushSize}px; background: {currentColor};"></span>
                </div>

                <md-slider min="1" max="40" value={brushSize} step="1" labeled oninput={handleSliderInput} class="m3-slider"></md-slider>
            </div>

            <div class="m3-divider"></div>

            <!-- Finish Action -->
            <div class="actions-group">
                <md-filled-button type="button" onclick={handleFinish}>
                    <md-icon slot="icon">check</md-icon>
                    {t("draw", "done")}
                </md-filled-button>
            </div>
        </footer>
    {/if}
</div>

<style>
    .m3-drawing-container {
        /* --md-sys-color-surface-container-high: #ece6f0;
        --md-sys-color-on-surface: #1d1b20;
        --md-sys-color-on-surface-variant: #49454f;
        --md-sys-color-outline-variant: #cac4d0; */
        /* --md-sys-color-primary: #6750a4; */

        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: transparent;
        touch-action: none;
        font-family:
            "Open Sans",
            system-ui,
            -apple-system,
            sans-serif;
        pointer-events: none;
        z-index: 10;
    }

    .drawing-canvas {
        width: 100%;
        height: 100%;
        display: block;
        background: transparent;
        pointer-events: none;
    }

    .drawing-canvas.interactive {
        cursor: crosshair;
        pointer-events: auto;
    }

    /* Top Left Toolbar */
    .m3-top-left-bar {
        position: absolute;
        top: 1rem;
        left: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        pointer-events: auto;
        z-index: 12;
    }

    /* Bottom App Bar Container */
    .m3-bottom-app-bar {
        position: absolute;
        bottom: 1.5rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.875rem;
        background-color: var(--md-sys-color-surface-container-high, #ece6f0);
        border-radius: 28px;
        box-shadow:
            0px 3px 6px -2px rgba(0, 0, 0, 0.12),
            0px 2px 4px 0px rgba(0, 0, 0, 0.08);
        user-select: none;
        max-width: calc(100vw - 2rem);
        box-sizing: border-box;
        pointer-events: auto;
    }

    /* Scrollable Color Picker Container */
    .color-picker-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        overflow-x: auto;
        max-width: 100%;
        scrollbar-width: none;
        /* Vertical padding prevents ring shadow clipping */
        padding: 0.5rem 0.375rem;
        box-sizing: border-box;
    }

    .color-picker-group::-webkit-scrollbar {
        display: none;
    }

    .m3-color-chip {
        position: relative;
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background-color: var(--chip-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition:
            transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            box-shadow 0.2s ease;
    }

    .m3-color-chip:hover {
        transform: scale(1.08);
    }

    /* Dual Box-shadow Ring to prevent outline overflow clipping */
    .m3-color-chip.selected {
        box-shadow:
            0 0 0 2px var(--md-sys-color-surface-container-high, #ece6f0),
            0 0 0 4px var(--md-sys-color-primary, #6750a4);
    }

    .check-icon {
        --md-icon-size: 1.125rem;
        font-size: 1.125rem;
        width: 1.125rem;
        height: 1.125rem;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .custom-color-wrapper {
        position: relative;
        width: 2rem;
        height: 2rem;
        box-sizing: border-box;
        padding: 0;
        margin: 0;
        flex-shrink: 0;
        border-radius: 50%;
        border: 1px dashed var(--md-sys-color-on-surface-variant, #49454f);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        transition: background-color 0.2s ease;
        overflow: hidden;
    }

    .custom-color-wrapper:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }

    .palette-icon {
        --md-icon-size: 1.125rem;
        font-size: 1.125rem;
        width: 1.125rem;
        height: 1.125rem;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .custom-color-input {
        position: absolute;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
        top: 0;
        left: 0;
        margin: 0;
        padding: 0;
        border: none;
    }

    .m3-divider {
        width: 1px;
        height: 1.75rem;
        flex-shrink: 0;
        background-color: var(--md-sys-color-outline-variant, #cac4d0);
    }

    .brush-size-group {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 1;
        min-width: 0;
    }

    .brush-preview-container {
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .brush-preview {
        border-radius: 50%;
        display: inline-block;
        max-width: 1.75rem;
        max-height: 1.75rem;
        transition:
            width 0.15s ease,
            height 0.15s ease,
            background-color 0.2s ease;
    }

    .m3-slider {
        width: 5.5rem;
        flex-shrink: 1;
        min-width: 3.5rem;
        --md-slider-active-track-color: var(--md-sys-color-primary, #6750a4);
        --md-slider-handle-color: var(--md-sys-color-primary, #6750a4);
    }

    .actions-group {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    /* Responsive adjustments for narrow screens */
    @media (max-width: 480px) {
        .m3-bottom-app-bar {
            gap: 0.5rem;
            padding: 0.375rem 0.625rem;
        }

        .m3-slider {
            width: 4rem;
        }
    }
</style>
