<script lang="ts">
    interface Props {
        id?: string
        value?: string
        label?: string
        placeholder?: string
        rows?: number
        disabled?: boolean
        readonly?: boolean
        style?: string
        class?: string
        oninput?: (e: Event) => void
        onkeydown?: (e: KeyboardEvent) => void
        onchange?: (e: Event) => void
    }

    let {
        id,
        value: propValue = $bindable(""),
        label,
        placeholder = "",
        rows = 8,
        disabled = false,
        readonly = false,
        style = "",
        class: className = "",
        oninput,
        onkeydown,
        onchange
    }: Props = $props()

    let textareaEl = $state<HTMLTextAreaElement | null>(null)
    let backdropEl = $state<HTMLDivElement | null>(null)
    let isFocused = $state(false)

    // Expose utility methods on component instance
    export function getTextarea(): HTMLTextAreaElement | null {
        return textareaEl
    }

    export function focus(): void {
        textareaEl?.focus()
    }

    function escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    let highlightedHtml = $derived.by(() => {
        const text = propValue || ""
        if (!text) return ""
        const escaped = escapeHtml(text)
        // Highlight anything within square brackets [...] and curly braces {...}
        const highlighted = escaped
            .replace(/(\[[^\]\n]+\])/g, '<span class="chord-highlight">$1</span>')
            .replace(/(\{[^\}\n]+\})/g, '<span class="directive-highlight">$1</span>')
        // Append a trailing newline if present to match textarea wrapping/scrolling behavior
        return text.endsWith("\n") ? highlighted + "\n" : highlighted
    })

    function handleScroll() {
        if (backdropEl && textareaEl) {
            backdropEl.scrollTop = textareaEl.scrollTop
            backdropEl.scrollLeft = textareaEl.scrollLeft
        }
    }

    function handleInput(e: Event) {
        const target = e.target as HTMLTextAreaElement
        propValue = target.value
        if (oninput) oninput(e)
    }

    $effect(() => {
        if (textareaEl && propValue !== undefined && textareaEl.value !== propValue) {
            textareaEl.value = propValue
            handleScroll()
        }
    })
</script>

<div
    class="highlighted-field-container {className}"
    class:focused={isFocused}
    class:disabled
    class:has-label={Boolean(label)}
    {style}
>
    {#if label}
        <label for={id} class="field-label" class:floating={isFocused || Boolean(propValue)}>
            {label}
        </label>
    {/if}

    <div class="editor-viewport">
        <!-- Backdrop container rendering highlighted markup -->
        <div
            bind:this={backdropEl}
            class="editor-backdrop"
            aria-hidden="true"
        >{@html highlightedHtml}</div>

        <!-- Transparent textarea for user input -->
        <textarea
            {id}
            bind:this={textareaEl}
            class="editor-textarea"
            {placeholder}
            {rows}
            {disabled}
            {readonly}
            value={propValue}
            oninput={handleInput}
            onkeydown={onkeydown}
            onchange={onchange}
            onscroll={handleScroll}
            onfocus={() => (isFocused = true)}
            onblur={() => (isFocused = false)}
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
        ></textarea>
    </div>
</div>

<style>
    .highlighted-field-container {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        border-radius: 8px;
        border: 1px solid var(--md-sys-color-outline, #79747e);
        background: transparent;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .highlighted-field-container:hover:not(.disabled) {
        border-color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .highlighted-field-container.focused {
        border-color: var(--md-sys-color-primary, #6750a4);
        border-width: 2px;
        margin: -1px; /* Prevent layout shift when border width changes */
    }

    .highlighted-field-container.disabled {
        opacity: 0.38;
        cursor: not-allowed;
    }

    .field-label {
        position: absolute;
        top: -9px;
        left: 12px;
        padding: 0 4px;
        background: var(--md-sys-color-primary-container, transparent);
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        pointer-events: none;
        z-index: 2;
        border-radius: 4px;
        transition: color 0.2s ease;
    }

    .highlighted-field-container.focused .field-label {
        color: var(--md-sys-color-primary, #6750a4);
        font-weight: 600;
    }

    .editor-viewport {
        position: relative;
        width: 100%;
        height: 100%;
        flex: 1;
        display: flex;
        overflow: hidden;
        border-radius: inherit;
    }

    .editor-backdrop,
    .editor-textarea {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 14px 16px;
        box-sizing: border-box;
        font-family: "Open Sans", system-ui, sans-serif;
        font-size: 0.95rem;
        font-weight: 400;
        line-height: 1.5;
        letter-spacing: 0;
        word-spacing: 0;
        text-transform: none;
        text-indent: 0;
        text-shadow: none;
        text-align: start;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        tab-size: 4;
        border: 0;
        outline: none;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
    }

    .editor-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        color: var(--md-sys-color-on-surface, #2b2930);
        background: transparent;
        overflow: hidden;
        pointer-events: none;
        user-select: none;
    }

    .editor-textarea {
        position: relative;
        color: transparent;
        background: transparent;
        caret-color: var(--md-sys-color-primary, #6750a4);
        resize: none;
        z-index: 1;
        overflow-y: auto;
    }

    .editor-textarea::selection {
        background-color: color-mix(in srgb, var(--md-sys-color-primary, #6750a4) 38%, transparent);
        color: var(--md-sys-color-on-surface, #2b2930);
    }

    .editor-textarea::placeholder {
        color: var(--md-sys-color-on-surface-variant, #49454f);
        opacity: 0.6;
    }

    /* Highlight style for chord brackets [...] - Deep Blue */
    :global(.chord-highlight) {
        color: var(--chord-color, #1565c0);
        background: color-mix(in srgb, var(--chord-color, #1565c0) 12%, transparent);
        border-radius: 2px;
        padding: 0;
        margin: 0;
        font-weight: inherit;
    }

    /* Highlight style for directives / comments {...} - Warm Amber */
    :global(.directive-highlight) {
        color: var(--comment-color, #d96500);
        background: color-mix(in srgb, var(--comment-color, #d96500) 12%, transparent);
        border-radius: 2px;
        padding: 0;
        margin: 0;
        font-weight: inherit;
    }
</style>
