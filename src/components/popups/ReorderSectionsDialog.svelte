<script lang="ts">
    import { cloneSection, getUniqueSections, parseSongSections, serializeSections, type SongSection } from "$lib/chords/sectionManager"
    import { t } from "$lib/state/i18n.svelte"
    import { applyBatchMove, getDisplayList, handleContainerDragOver, handleContainerDrop, handleItemDragOver, handleItemDragStart, handleItemDrop, handlePointerDragStart, resetDragState, type ReorderState } from "$lib/utils/rearrange"

    interface Props {
        open: boolean
        initialText: string
        onApply: (newText: string) => void
        onClose: () => void
    }

    let { open, initialText, onApply, onClose }: Props = $props()

    let sections = $state<SongSection[]>([])
    let availableTemplates = $derived(getUniqueSections(sections))
    let reorderState = $state<ReorderState>({ draggedIdx: null, draggedIndices: [], dragOverIdx: null })
    let displaySections = $derived(getDisplayList(sections, reorderState))

    $effect(() => {
        if (open) {
            sections = parseSongSections(initialText)
            resetDragState(reorderState)
        }
    })

    function onMoveSection(fromIndices: number[], targetIdx: number) {
        if (!fromIndices.length) return
        sections = applyBatchMove(sections, fromIndices, targetIdx).updatedList
    }

    function deleteSection(originalIdx: number) {
        const sec = sections[originalIdx]
        if (sec && getMatchCount(sec.canonicalKey) > 1) {
            sections = sections.filter((_, idx) => idx !== originalIdx)
        }
    }

    function handleDone() {
        onApply(serializeSections(sections))
        onClose()
    }

    function getMatchCount(key: string): number {
        return sections.filter((s) => s.canonicalKey === key).length
    }
</script>

{#if open}
    <md-dialog {open} onclosed={onClose} oncancel={onClose}>
        <div slot="headline">
            <div class="dialog-header">
                <span class="material-symbols-outlined headline-icon">reorder</span>
                <span>{t("song_edit", "reorder_dialog_title")}</span>
            </div>
        </div>

        <div slot="content" class="dialog-content">
            <div
                class="sections-scroll-area scroll-list"
                ondragover={(e) => handleContainerDragOver(e, sections.length, reorderState)}
                ondrop={(e) => handleContainerDrop(e, sections.length, reorderState, onMoveSection)}
            >
                {#if sections.length === 0}
                    <div class="empty-hint">{t("song_edit", "no_sections")}</div>
                {:else}
                    <div class="sections-list">
                        {#each displaySections as { item: section, originalIdx }, idx (section.id + "-" + originalIdx)}
                            {@const matchCount = getMatchCount(section.canonicalKey)}
                            {@const isGhost = reorderState.draggedIdx === originalIdx}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="section-card"
                                class:is-dragging={isGhost}
                                data-reorder-idx={idx}
                                draggable="true"
                                ondragstart={(e) => handleItemDragStart(e, originalIdx, [originalIdx], reorderState)}
                                ondragover={(e) => handleItemDragOver(e, idx, reorderState)}
                                ondrop={(e) => handleItemDrop(e, idx, reorderState, onMoveSection)}
                                ondragend={() => resetDragState(reorderState)}
                            >
                                <span
                                    class="material-symbols-outlined drag-handle"
                                    title="Drag to reorder"
                                    onpointerdown={(e) => handlePointerDragStart(e, originalIdx, [originalIdx], reorderState, onMoveSection, () => resetDragState(reorderState))}
                                >
                                    drag_indicator
                                </span>

                                <div class="section-info">
                                    <div class="section-title-row">
                                        <span class="section-name">{section.name}</span>
                                        {#if matchCount > 1}
                                            <span class="match-badge" title="Repeated section in song">
                                                <span class="material-symbols-outlined" style="font-size: 13px;">repeat</span>
                                                {matchCount}x
                                            </span>
                                        {/if}
                                    </div>
                                    {#if section.preview}
                                        <div class="section-preview" title={section.preview}>{section.preview}</div>
                                    {/if}
                                </div>

                                <div class="section-actions">
                                    <md-icon-button
                                        type="button"
                                        disabled={matchCount <= 1}
                                        onclick={() => deleteSection(originalIdx)}
                                        title={matchCount <= 1 ? t("song_edit", "cant_delete_last_section") : t("song_edit", "delete_section")}
                                    >
                                        <md-icon>delete</md-icon>
                                    </md-icon-button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if availableTemplates.length > 0}
                <div
                    class="add-section-area"
                    ondragover={(e) => handleContainerDragOver(e, sections.length, reorderState)}
                    ondrop={(e) => handleContainerDrop(e, sections.length, reorderState, onMoveSection)}
                >
                    <span class="add-label">{t("song_edit", "add_existing_section")}:</span>
                    <div class="template-chips">
                        {#each availableTemplates as template (template.canonicalKey)}
                            <button type="button" class="add-chip" onclick={() => sections = [...sections, cloneSection(template)]}>
                                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                                <span>{template.name}</span>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <div slot="actions">
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-text-button role="button" tabindex="0" onclick={onClose}>{t("common", "cancel")}</md-text-button>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-filled-button role="button" tabindex="0" onclick={handleDone}>{t("common", "done")}</md-filled-button>
        </div>
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
        color: var(--md-sys-color-primary);
    }

    .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 4px 12px 4px;
        min-width: 320px;
        max-width: 480px;
        box-sizing: border-box;
    }

    .sections-scroll-area {
        display: flex;
        flex-direction: column;
        max-height: 50vh;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 4px 4px 8px 4px;
    }

    .sections-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 48px;
    }

    .section-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: var(--md-sys-color-surface-container-high, #f7f2fa);
        border: 1px solid var(--md-sys-color-outline-variant, #e7e0ec);
        border-radius: 10px;
        padding: 8px 12px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        box-sizing: border-box;
    }

    .section-card:active {
        cursor: grabbing;
    }

    .section-card.is-dragging {
        opacity: 0.35;
        background: var(--md-sys-color-surface-container-lowest, #ffffff);
        border: 1px dashed var(--md-sys-color-primary, #6750a4);
        transform: scale(0.98);
    }

    .drag-handle {
        color: var(--md-sys-color-outline, #79747e);
        font-size: 20px;
        cursor: grab;
        flex-shrink: 0;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .drag-handle:active {
        cursor: grabbing;
    }

    .section-card:hover .drag-handle {
        color: var(--md-sys-color-primary, #6750a4);
    }

    .section-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .section-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .section-name {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--md-sys-color-primary, #6750a4);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .match-badge {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 1px 6px;
        border-radius: 12px;
        background: var(--md-sys-color-secondary-container, #e8def8);
        color: var(--md-sys-color-on-secondary-container, #1d192b);
        font-size: 0.75rem;
        font-weight: 500;
    }

    .section-preview {
        font-size: 0.8rem;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .section-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        --md-icon-button-state-layer-width: 32px;
        --md-icon-button-state-layer-height: 32px;
        --md-icon-button-icon-size: 18px;
    }

    .add-section-area {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 10px;
        padding-left: 4px;
        padding-right: 4px;
        border-top: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        flex-shrink: 0;
    }

    .add-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--md-sys-color-on-surface-variant, #49454f);
    }

    .template-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .add-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: var(--md-sys-color-surface-container-low, #f7f2fa);
        color: var(--md-sys-color-on-surface, #1d1b20);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .add-chip:hover {
        background: var(--md-sys-color-primary-container, #eaddff);
        border-color: var(--md-sys-color-primary, #6750a4);
        color: var(--md-sys-color-on-primary-container, #21005d);
    }

    .empty-hint {
        color: var(--md-sys-color-outline, #79747e);
        font-size: 0.9rem;
        text-align: center;
        padding: 16px;
    }
</style>
