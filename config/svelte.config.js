/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
    onwarn: (warning, handler) => {
        if (warning.code.startsWith("a11y_") && warning.message.includes("<md-")) return
        handler(warning)
    },
    compilerOptions: {
        warningFilter: (warning) => {
            if (warning.code.startsWith("a11y_") && warning.message.includes("<md-")) return false
            return true
        }
    }
}
