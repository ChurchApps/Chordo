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
    import { DrawingEngine } from "./DrawingEngine.svelte"

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

    let canvasElement = $state<HTMLCanvasElement | null>(null)

    const engine = new DrawingEngine({
        getEditable: () => editable,
        getInitialData: () => initialData,
        getColors: () => colors,
        onChange: (data) => onChange?.(data),
        onFinish: (data) => onFinish?.(data)
    })

    // Sync settings & reactive storage updates
    $effect(() => {
        engine.syncSettings()
    })

    $effect(() => {
        if (editable) {
            engine.persistSettings()
        }
    })

    // Canvas lifecycle & resize observation
    $effect(() => {
        return engine.setupCanvas(canvasElement)
    })

    // Sync external initialData updates
    $effect(() => {
        engine.syncInitialData(initialData)
    })

    // Export helpers
    export function getDrawingData(): string {
        return engine.getData()
    }

    export function clearCanvas() {
        engine.clear()
    }

    function handleClearRequest() {
        openConfirm({
            title: t("draw", "clear_title"),
            message: t("draw", "clear_msg"),
            confirmLabel: t("draw", "clear"),
            isDestructive: true,
            onConfirm: () => {
                engine.clear()
            }
        })
    }

    function handleSliderInput(e: Event) {
        const target = e.target as HTMLInputElement
        if (target && target.value !== undefined) {
            engine.setBrushSize(Number(target.value))
        }
    }
</script>

<svelte:window
    onkeydown={(e) => {
        if (editable) engine.history.handleKeyDown(e)
    }}
/>

<div class="m3-drawing-container">
    <canvas
        bind:this={canvasElement}
        class="drawing-canvas"
        class:interactive={editable}
        class:eraser-mode={editable && engine.toolMode === "eraser"}
        onpointerdown={(e) => engine.startDrawing(e)}
        onpointermove={(e) => engine.draw(e)}
        onpointerup={(e) => engine.stopDrawing(e)}
        onpointercancel={(e) => engine.stopDrawing(e)}
    ></canvas>

    {#if editable}
        <!-- Top Left Toolbar (Clear, Undo, Redo Actions) -->
        <header class="m3-top-left-bar">
            <md-filled-tonal-button type="button" onclick={handleClearRequest}>
                <md-icon slot="icon">delete</md-icon>
                {t("draw", "clear")}
            </md-filled-tonal-button>

            <md-filled-tonal-button type="button" disabled={!engine.history.canUndo} onclick={() => engine.history.undo()} title={`${t("common", "undo")} (Ctrl+Z)`}>
                <md-icon slot="icon">undo</md-icon>
                {t("common", "undo")}
            </md-filled-tonal-button>

            <md-filled-tonal-button type="button" disabled={!engine.history.canRedo} onclick={() => engine.history.redo()} title={`${t("common", "redo")} (Ctrl+Y)`}>
                <md-icon slot="icon">redo</md-icon>
                {t("common", "redo")}
            </md-filled-tonal-button>
        </header>

        <!-- Bottom Floating Toolbar -->
        <footer class="m3-bottom-app-bar">
            <!-- Scrollable Color Swatches -->
            <div class="color-picker-group">
                {#each colors as color}
                    <button
                        type="button"
                        class="m3-color-chip"
                        class:selected={engine.currentColor === color && engine.toolMode === "pen"}
                        style="--chip-color: {color};"
                        aria-label="Select color {color}"
                        onclick={() => engine.selectPresetColor(color)}
                    >
                        {#if engine.currentColor === color && engine.toolMode === "pen"}
                            <md-icon class="check-icon" style="color: {color === '#ffffff' ? '#000000' : '#ffffff'}"> check </md-icon>
                        {/if}
                    </button>
                {/each}

                <!-- Custom Color Button Wrapper -->
                <button
                    type="button"
                    class="m3-color-chip custom-color-chip"
                    class:selected={!colors.includes(engine.currentColor) && engine.toolMode === "pen"}
                    style="--chip-color: {engine.customColor};"
                    onclick={() => engine.handleCustomColorClick()}
                    title={!colors.includes(engine.currentColor) && engine.toolMode === "pen" ? "Choose custom color" : "Select custom color"}
                    aria-label="Custom color"
                >
                    <md-icon class="palette-icon">palette</md-icon>
                    <input bind:this={engine.colorInputRef} type="color" value={engine.customColor} class="custom-color-input-hidden" oninput={(e) => engine.handleCustomColorInput(e)} tabindex="-1" aria-hidden="true" />
                </button>
            </div>

            <div class="m3-divider"></div>

            <!-- Brush Size Selector -->
            <div class="brush-size-group">
                <div class="brush-preview-container">
                    <span class="brush-preview" style="width: {engine.brushSize}px; height: {engine.brushSize}px; background: {engine.currentColor};"></span>
                </div>

                <md-slider min="1" max="40" value={engine.brushSize} step="1" labeled oninput={handleSliderInput} class="m3-slider"></md-slider>
            </div>

            <div class="m3-divider"></div>

            <!-- Eraser Tool Toggle -->
            <button type="button" class="eraser-btn" class:selected={engine.toolMode === "eraser"} onclick={() => engine.toggleEraser()} title="Eraser — tap a stroke to remove it">
                <md-icon>ink_eraser</md-icon>
            </button>

            <div class="m3-divider"></div>

            <!-- Finish Action -->
            <div class="actions-group">
                <md-filled-button type="button" onclick={() => engine.finish()}>
                    <md-icon slot="icon">check</md-icon>
                    {t("draw", "done")}
                </md-filled-button>
            </div>
        </footer>
    {/if}
</div>

<style>
    .m3-drawing-container {
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
        pointer-events: auto;
        cursor: crosshair;
    }

    .drawing-canvas.eraser-mode {
        cursor:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/%3E%3Cpath d='M22 21H7'/%3E%3Cpath d='m5 11 9 9'/%3E%3C/svg%3E")
                4 20,
            crosshair;
    }

    /* Top Left Floating Bar */
    .m3-top-left-bar {
        position: absolute;
        top: 1rem;
        left: 1rem;
        display: flex;
        gap: 0.5rem;
        z-index: 20;
        pointer-events: auto;
        background-color: var(--md-sys-color-surface-container-high, #ece6f0);
        padding: 0.5rem;
        border-radius: 9999px;
        box-shadow:
            0 1px 3px 1px rgba(0, 0, 0, 0.15),
            0 1px 2px 0 rgba(0, 0, 0, 0.3);
    }

    /* Bottom Floating Bar */
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
        border-radius: 9999px;
        box-shadow:
            0 3px 6px -2px rgba(0, 0, 0, 0.2),
            0 2px 14px 0 rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(0, 0, 0, 0.05);
        z-index: 20;
        pointer-events: auto;
        max-width: 95vw;
        overflow-x: auto;
    }

    .color-picker-group {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex-shrink: 0;
        overflow-x: auto;
        padding: 2px;
        scrollbar-width: none;
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

    .custom-color-chip {
        border-style: dashed;
        border-color: var(--md-sys-color-outline, #79747e);
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
        color: #ffffff;
        filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
    }

    .custom-color-input-hidden {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
        pointer-events: none;
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

    /* Eraser toggle button */
    .eraser-btn {
        width: 2.25rem;
        height: 2.25rem;
        flex-shrink: 0;
        border-radius: 50%;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--md-sys-color-on-surface, #1d1b20);
        transition: background-color 0.2s ease;
        --md-icon-size: 1.25rem;
        font-size: 1.25rem;
        padding: 0;
    }

    .eraser-btn:hover {
        background-color: rgba(0, 0, 0, 0.08);
    }

    .eraser-btn.selected {
        background-color: var(--md-sys-color-secondary-container, #e8def8);
        color: var(--md-sys-color-on-secondary-container, #1d192b);
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
