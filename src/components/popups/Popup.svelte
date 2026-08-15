<script lang="ts">
    import { confirmState } from "$lib/state/confirm.svelte"
    import { popupState } from "$lib/state/menu.svelte"
    import ConfirmDialog from "./ConfirmDialog.svelte"
    import { popups } from "./popups"
</script>

{#if popupState.popupId && popups[popupState.popupId]}
    <svelte:component this={popups[popupState.popupId].component} />
{/if}

{#if confirmState.isOpen}
    <ConfirmDialog />
{/if}
