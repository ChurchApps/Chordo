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
    import "@material/web/menu/menu-item.js"
    import "@material/web/menu/menu.js"
    import "@material/web/textfield/outlined-text-field.js"
    import { onMount } from "svelte"
    import Header from "./components/header/Header.svelte"
    import Page from "./components/pages/Page.svelte"
    import Popup from "./components/popups/Popup.svelte"
    import PwaReloadPrompt from "./components/header/PwaReloadPrompt.svelte"
    import PlaybackBar from "./components/playback/PlaybackBar.svelte"
    import Toast from "./components/common/Toast.svelte"
    import { initDialogKeyboardCentering } from "$lib/utils/viewport"
    import { extractSharePayloadFromUrl, resolveSharePayload } from "$lib/share/shareCodec"
    import { setSharePayload } from "$lib/share/share.svelte"
    import { setActivePage } from "$lib/state/menu.svelte"

    async function handleIncomingShare() {
        if (typeof window === "undefined") return
        const rawPayload = extractSharePayloadFromUrl()
        if (rawPayload) {
            const decoded = await resolveSharePayload(rawPayload)
            if (decoded) {
                setSharePayload(decoded, rawPayload)
                const title = decoded.type === "list" ? decoded.list.name : decoded.song.name
                setActivePage("share_preview", null, title, "replace")
            }
        }
    }

    onMount(() => {
        handleIncomingShare()
        window.addEventListener("hashchange", handleIncomingShare)
        const cleanupKeyboard = initDialogKeyboardCentering()

        return () => {
            window.removeEventListener("hashchange", handleIncomingShare)
            if (cleanupKeyboard) cleanupKeyboard()
        }
    })
</script>

<!-- Material 3 Style -->
<div class="app-layout">
    <Header />

    <Page />

    <PlaybackBar />

    <Popup />

    <PwaReloadPrompt />

    <Toast />
</div>

<style>
    .app-layout {
        position: relative;

        display: flex;
        flex-direction: column;

        height: 100vh;
        height: 100dvh;
        overflow: hidden;

        background-color: var(--md-sys-color-primary-background);
        color: var(--md-sys-color-on-primary-container);
    }
</style>
