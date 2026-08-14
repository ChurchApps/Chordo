<script lang="ts">
    import "@material/web/button/filled-button.js"
    import "@material/web/button/outlined-button.js"
    import "@material/web/button/text-button.js"
    import "@material/web/dialog/dialog.js"
    import "@material/web/elevation/elevation.js"
    import "@material/web/fab/fab.js"
    import "@material/web/icon/icon.js"
    import "@material/web/iconbutton/icon-button.js"
    import "@material/web/list/list-item.js"
    import "@material/web/list/list.js"
    import "@material/web/textfield/outlined-text-field.js"
    import Header from "./components/header/Header.svelte"
    import Page from "./components/pages/Page.svelte"
    import Popup from "./components/popups/Popup.svelte"

    // DEBUG: clear data
    // storage.resetAll()
</script>

<!-- Material 3 Style -->
<div class="app-layout">
    <Header />

    <Page />

    <Popup />
</div>

<style>
    .app-layout {
        position: relative;

        display: flex;
        flex-direction: column;

        height: 100vh;
        overflow: hidden;

        background-color: var(--background);
        color: var(--on-background);
    }
</style>
