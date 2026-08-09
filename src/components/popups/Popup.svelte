<script lang="ts">
    import { popupState } from "../../lib/state/menu.svelte"
    import { popups } from "./popups"
</script>

{#if popupState.popupId && popups[popupState.popupId]}
    <svelte:component this={popups[popupState.popupId].component} />
{/if}
