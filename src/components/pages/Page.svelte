<script lang="ts">
    import { menuState } from "$lib/state/menu.svelte"
    import { pages } from "./pages"
</script>

{#if menuState.activePage && pages[menuState.activePage]}
    <div data-vt="page" style="view-transition-name: page;">
        <svelte:component this={pages[menuState.activePage].component} />
    </div>
{/if}

<style>
    div {
        display: flex;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
</style>
