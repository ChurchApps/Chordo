<script lang="ts">
    // Import Material Web Components
    import "@material/web/button/filled-button.js"
    import "@material/web/button/filled-tonal-button.js"
    import "@material/web/button/text-button.js"
    import "@material/web/dialog/dialog.js"
    import "@material/web/icon/icon.js"
    import "@material/web/iconbutton/filled-tonal-icon-button.js"
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
            "#b3261e", // M3 Error / Red
            "#1d1b20", // M3 On Surface / Black
            "#6750a4", // M3 Primary / Purple
            "#00639b", // M3 Blue
            "#2e6a4f", // M3 Green
            "#e65100", // Warm Orange
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

    let textInputValue = $state("")
    let textInputEl = $state<HTMLInputElement | null>(null)

    $effect(() => {
        if (engine.activeTextPrompt) {
            textInputValue = ""
            setTimeout(() => {
                textInputEl?.focus()
            }, 20)
        }
    })

    function submitTextInput() {
        if (textInputValue.trim()) {
            engine.commitText(textInputValue)
        } else {
            engine.cancelTextInput()
        }
        textInputValue = ""
    }

    function handleTextKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            e.stopPropagation()
            submitTextInput()
        } else if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            engine.cancelTextInput()
            textInputValue = ""
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
        class:text-mode={editable && engine.toolMode === "text"}
        onpointerdown={(e) => engine.startDrawing(e)}
        onpointermove={(e) => engine.draw(e)}
        onpointerup={(e) => engine.stopDrawing(e)}
        onpointercancel={(e) => engine.stopDrawing(e)}
        oncontextmenu={(e) => e.preventDefault()}
    ></canvas>

    {#if editable}
        <!-- Inline Text Input Overlay -->
        {#if engine.activeTextPrompt}
            <div class="active-text-wrapper" style="left: min(calc(100% - 160px), {engine.activeTextPrompt.x}px); top: {engine.activeTextPrompt.y}px; max-width: min(300px, calc(100% - min(calc(100% - 160px), {engine.activeTextPrompt.x}px) - 16px));">
                <input bind:this={textInputEl} bind:value={textInputValue} type="text" class="active-text-input" placeholder="Type text..." style="color: {engine.currentColor}; font-size: {14 + engine.brushSize}px;" onkeydown={handleTextKeydown} />
                <button
                    type="button"
                    class="active-text-submit-btn"
                    title={t("draw", "done")}
                    aria-label={t("draw", "done")}
                    onpointerdown={(e) => {
                        e.preventDefault()
                        submitTextInput()
                    }}
                >
                    <md-icon>check</md-icon>
                </button>
            </div>
        {/if}

        <!-- Top Right Toolbar (Clear, Undo, Redo, Done Actions) -->
        <header class="m3-top-right-bar">
            <md-filled-tonal-icon-button type="button" disabled={!engine.hasContent} onclick={handleClearRequest} title={t("draw", "clear")} aria-label={t("draw", "clear")}>
                <md-icon>delete</md-icon>
            </md-filled-tonal-icon-button>

            <md-filled-tonal-icon-button type="button" disabled={!engine.history.canUndo} onclick={() => engine.history.undo()} title={`${t("common", "undo")} (Ctrl+Z)`} aria-label={t("common", "undo")}>
                <md-icon>undo</md-icon>
            </md-filled-tonal-icon-button>

            <md-filled-tonal-icon-button type="button" disabled={!engine.history.canRedo} onclick={() => engine.history.redo()} title={`${t("common", "redo")} (Ctrl+Y)`} aria-label={t("common", "redo")}>
                <md-icon>redo</md-icon>
            </md-filled-tonal-icon-button>

            <md-filled-button type="button" onclick={() => engine.finish()}>
                <md-icon slot="icon">check</md-icon>
                {t("draw", "done")}
            </md-filled-button>
        </header>

        <!-- Bottom Floating Toolbar -->
        <footer class="m3-bottom-app-bar">
            <!-- Scrollable Color Swatches -->
            <div class="color-picker-group">
                {#each colors as color}
                    <button
                        type="button"
                        class="m3-color-chip"
                        class:selected={engine.currentColor === color && engine.toolMode !== "eraser"}
                        style="--chip-color: {color};"
                        aria-label="Select color {color}"
                        onclick={() => engine.selectPresetColor(color)}
                    >
                        {#if engine.currentColor === color && engine.toolMode !== "eraser"}
                            <md-icon class="check-icon" style="color: {color === '#ffffff' ? '#000000' : '#ffffff'}"> check </md-icon>
                        {/if}
                    </button>
                {/each}

                <!-- Custom Color Button Wrapper -->
                <button
                    type="button"
                    class="m3-color-chip custom-color-chip"
                    class:selected={!colors.includes(engine.currentColor) && engine.toolMode !== "eraser"}
                    style="--chip-color: {engine.customColor};"
                    onclick={() => engine.handleCustomColorClick()}
                    title={!colors.includes(engine.currentColor) && engine.toolMode !== "eraser" ? "Choose custom color" : "Select custom color"}
                    aria-label="Custom color"
                >
                    <md-icon class="palette-icon">palette</md-icon>
                    <input bind:this={engine.colorInputRef} type="color" value={engine.customColor} class="custom-color-input-hidden" oninput={(e) => engine.handleCustomColorInput(e)} tabindex="-1" aria-hidden="true" />
                </button>
            </div>

            <div class="m3-divider"></div>

            <!-- Tool Mode Group (Pen, Text, Eraser) -->
            <div class="tool-mode-group">
                <button
                    type="button"
                    class="tool-btn"
                    class:selected={engine.toolMode === "pen"}
                    onclick={() => engine.setToolMode("pen")}
                    title="Pen — draw freehand"
                    aria-label="Pen tool"
                >
                    <md-icon>edit</md-icon>
                </button>

                <button
                    type="button"
                    class="tool-btn"
                    class:selected={engine.toolMode === "text"}
                    onclick={() => engine.setToolMode("text")}
                    title="Text — tap canvas to insert text"
                    aria-label="Text tool"
                >
                    <md-icon>title</md-icon>
                </button>

                <button
                    type="button"
                    class="tool-btn"
                    class:selected={engine.toolMode === "eraser"}
                    onclick={() => engine.setToolMode("eraser")}
                    title="Eraser — tap a stroke or text to remove it"
                    aria-label="Eraser tool"
                >
                    <md-icon>ink_eraser</md-icon>
                </button>
            </div>

            <div class="m3-divider"></div>

            <!-- Brush Size Selector -->
            <div class="brush-size-group">
                <div class="brush-preview-container">
                    {#if engine.toolMode === "text"}
                        <span class="brush-text-preview" style="font-size: {14 + engine.brushSize}px; color: {engine.currentColor};">A</span>
                    {:else if engine.toolMode === "eraser"}
                        <span class="eraser-preview" style="width: {engine.brushSize}px; height: {engine.brushSize}px;"></span>
                    {:else}
                        <span class="brush-preview" style="width: {engine.brushSize}px; height: {engine.brushSize}px; background: {engine.currentColor};"></span>
                    {/if}
                </div>

                <md-slider min="2" max="20" value={engine.brushSize} step="2" labeled oninput={handleSliderInput} class="m3-slider"></md-slider>
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
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
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
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .drawing-canvas.interactive {
        pointer-events: auto;
        cursor: crosshair;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .drawing-canvas.eraser-mode {
        cursor:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/%3E%3Cpath d='M22 21H7'/%3E%3Cpath d='m5 11 9 9'/%3E%3C/svg%3E")
                4 20,
            crosshair;
    }

    .drawing-canvas.text-mode {
        cursor: text;
    }

    /* Top Right Floating Bar */
    .m3-top-right-bar {
        position: absolute;
        top: calc(1rem + env(safe-area-inset-top, 0px));
        right: calc(1rem + env(safe-area-inset-right, 0px));
        display: flex;
        align-items: center;
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
        bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
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
        overflow: visible;
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
        gap: 0;
        flex-shrink: 1;
        min-width: 0;
    }

    .brush-preview-container {
        width: 1.75rem;
        height: 1.75rem;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: -2px;
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

    .eraser-preview {
        border-radius: 50%;
        display: inline-block;
        background-color: #ffffff;
        border: 1.5px solid #000000;
        box-sizing: border-box;
        max-width: 1.75rem;
        max-height: 1.75rem;
        transition:
            width 0.15s ease,
            height 0.15s ease;
    }

    .brush-text-preview {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        line-height: 1;
        user-select: none;
        transition:
            font-size 0.15s ease,
            color 0.2s ease;
    }

    .m3-slider {
        width: 5.5rem;
        flex-shrink: 1;
        min-width: 3.5rem;
        --md-slider-active-track-color: var(--md-sys-color-primary, #6750a4);
        --md-slider-handle-color: var(--md-sys-color-primary, #6750a4);
    }

    /* Inline text editor input overlay */
    .active-text-wrapper {
        position: absolute;
        z-index: 30;
        pointer-events: auto;
        transform: translate(0, -2px);
        display: flex;
        align-items: center;
        background: var(--md-sys-color-surface-container-high, #ece6f0);
        border: 1.5px solid var(--md-sys-color-primary, #6750a4);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        padding: 2px 4px 2px 8px;
        gap: 4px;
    }

    .active-text-input {
        background: transparent;
        border: none;
        padding: 4px 0;
        font-family: inherit;
        font-weight: bold;
        outline: none;
        flex: 1 1 auto;
        min-width: 60px;
    }

    .active-text-submit-btn {
        width: 1.875rem;
        height: 1.875rem;
        border-radius: 50%;
        border: none;
        background: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary, #ffffff);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
        transition: opacity 0.15s ease;
        --md-icon-size: 1.125rem;
        font-size: 1.125rem;
    }

    .active-text-submit-btn:hover {
        opacity: 0.88;
    }

    /* Tool Mode Group (Pen, Text, Eraser) */
    .tool-mode-group {
        display: flex;
        align-items: center;
        gap: 0.125rem;
        flex-shrink: 0;
    }

    /* Tool button (Pen, Text, Eraser) */
    .tool-btn {
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

    .tool-btn:hover {
        background-color: rgba(0, 0, 0, 0.08);
    }

    .tool-btn.selected {
        background-color: var(--md-sys-color-secondary-container, #e8def8);
        color: var(--md-sys-color-on-secondary-container, #1d192b);
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
