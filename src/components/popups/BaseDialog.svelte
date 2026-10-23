<script lang="ts">
    import type { Snippet } from "svelte"

    interface Props {
        open?: boolean
        title?: string
        icon?: string
        class?: string
        maxWidth?: string
        onclose?: () => void
        oncancel?: (e: Event) => void
        children?: Snippet
        headline?: Snippet
        actions?: Snippet
    }

    let { open = true, title = "", icon = "", class: className = "", maxWidth, onclose, oncancel, children, headline, actions }: Props = $props()

    function handleClosed() {
        if (onclose) onclose()
    }

    function handleCancel(e: Event) {
        if (oncancel) oncancel(e)
        else if (onclose) onclose()
    }
</script>

{#if open}
    <md-dialog {open} class="base-dialog {className}" style={maxWidth ? `--md-dialog-container-max-width: ${maxWidth}; max-width: ${maxWidth}; width: 100%;` : undefined} onclosed={handleClosed} oncancel={handleCancel}>
        <div slot="headline">
            {#if headline}
                {@render headline()}
            {:else}
                <div class="dialog-header">
                    {#if icon}
                        <span class="material-symbols-outlined headline-icon">{icon}</span>
                    {/if}
                    {#if title}
                        <span class="dialog-title">{title}</span>
                    {/if}
                </div>
            {/if}
        </div>

        {#if children}
            <div slot="content" class="dialog-content">
                {@render children()}
            </div>
        {/if}

        {#if actions}
            <div slot="actions">
                {@render actions()}
            </div>
        {/if}
    </md-dialog>
{/if}

<style>
    .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--md-sys-color-on-surface, #2b2930);
        font-size: 1.35rem;
    }

    .headline-icon {
        color: var(--md-sys-color-primary, #6750a4);
        font-size: 26px;
        flex-shrink: 0;
    }

    .dialog-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dialog-content {
        color: var(--md-sys-color-on-surface, #1d1b20);
    }
</style>
