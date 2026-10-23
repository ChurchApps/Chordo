<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import BaseDialog from "./BaseDialog.svelte"

    interface Props {
        open: boolean
        initialText?: string
        onApply: (newText: string) => void
        onClose: () => void
    }

    let { open, initialText = "", onApply, onClose }: Props = $props()

    let findText = $state("")
    let replaceText = $state("")
    let matchCase = $state(false)
    let currentWorkingText = $state("")
    let findInputEl = $state<HTMLElement | null>(null)

    $effect(() => {
        if (open) {
            currentWorkingText = initialText
            // Auto focus find input on open
            setTimeout(() => {
                const innerInput = findInputEl?.querySelector("input") || (findInputEl as unknown as HTMLInputElement)
                if (innerInput && typeof innerInput.focus === "function") {
                    innerInput.focus()
                    if (typeof (innerInput as HTMLInputElement).select === "function") {
                        ;(innerInput as HTMLInputElement).select()
                    }
                }
            }, 100)
        }
    })

    function escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }

    function buildRegex(global = true): RegExp | null {
        if (!findText) return null
        const pattern = escapeRegExp(findText)
        const flags = `${global ? "g" : ""}${matchCase ? "" : "i"}`
        try {
            return new RegExp(pattern, flags)
        } catch {
            return null
        }
    }

    let matchCount = $derived.by(() => {
        if (!findText || !currentWorkingText) return 0
        const regex = buildRegex(true)
        if (!regex) return 0
        const matches = currentWorkingText.match(regex)
        return matches ? matches.length : 0
    })

    function handleReplaceAll() {
        if (!findText) return
        const regex = buildRegex(true)
        if (!regex) return
        if (matchCount === 0) return
        const updated = currentWorkingText.replace(regex, replaceText)
        currentWorkingText = updated
        onApply(updated)
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault()
            handleReplaceAll()
        }
    }
</script>

{#if open}
    <BaseDialog {open} icon="find_replace" title={t("find_replace", "title")} maxWidth="min(440px, calc(100vw - 32px))" onclose={onClose}>
        <div class="dialog-content">
            <div class="input-row">
                <md-outlined-text-field bind:this={findInputEl} id="find-input" label={t("find_replace", "find")} value={findText} oninput={(e: Event) => (findText = (e.target as HTMLInputElement).value)} onkeydown={handleKeyDown} style="flex: 1;">
                    <span class="material-symbols-outlined" slot="leading-icon">search</span>
                </md-outlined-text-field>
            </div>

            <div class="input-row">
                <md-outlined-text-field id="replace-input" label={t("find_replace", "replace")} value={replaceText} oninput={(e: Event) => (replaceText = (e.target as HTMLInputElement).value)} onkeydown={handleKeyDown} style="flex: 1;">
                    <span class="material-symbols-outlined" slot="leading-icon">find_replace</span>
                </md-outlined-text-field>
            </div>

            <div class="options-and-stats">
                <label class="checkbox-label" for="match-case-checkbox">
                    <md-checkbox id="match-case-checkbox" checked={matchCase} onchange={(e: Event) => (matchCase = Boolean((e.target as HTMLInputElement).checked))}></md-checkbox>
                    <span>{t("find_replace", "match_case")}</span>
                </label>

                <div class="stats-badge" class:has-matches={matchCount > 0} class:no-matches={findText.length > 0 && matchCount === 0}>
                    <span class="material-symbols-outlined status-icon">
                        {matchCount > 0 ? "check_circle" : findText.length > 0 ? "info" : "search"}
                    </span>
                    <span>{matchCount}</span>
                </div>
            </div>
        </div>

        {#snippet actions()}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-text-button role="button" tabindex="0" onclick={onClose}>{t("common", "close")}</md-text-button>
            <md-filled-tonal-button type="button" disabled={!findText || matchCount === 0} onclick={handleReplaceAll}>
                <span class="material-symbols-outlined" slot="icon">done_all</span>
                {t("find_replace", "replace_all")}
            </md-filled-tonal-button>
        {/snippet}
    </BaseDialog>
{/if}

<style>
    .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-top: 6px;
        width: 100%;
        box-sizing: border-box;
    }

    .input-row {
        display: flex;
        width: 100%;
    }

    .options-and-stats {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 2px;
    }

    .checkbox-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        cursor: pointer;
        user-select: none;
    }

    .stats-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85rem;
        padding: 4px 10px;
        border-radius: 12px;
        background: var(--md-sys-color-surface-container-high, #f2ecf4);
        color: var(--md-sys-color-outline, #79747e);
        font-variant-numeric: tabular-nums;
    }

    .stats-badge.has-matches {
        background: color-mix(in srgb, var(--md-sys-color-primary, #6750a4) 15%, transparent);
        color: var(--md-sys-color-primary, #6750a4);
        font-weight: 600;
    }

    .stats-badge.no-matches {
        background: color-mix(in srgb, var(--md-sys-color-error, #ba1a1a) 15%, transparent);
        color: var(--md-sys-color-error, #ba1a1a);
    }

    .status-icon {
        font-size: 16px;
    }
</style>
