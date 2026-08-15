import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

// https://vite.dev/config/
export default defineConfig({
    root: rootDir,
    publicDir: path.resolve(rootDir, "public"),
    build: {
        outDir: path.resolve(rootDir, "dist"),
        emptyOutDir: true
    },
    plugins: [
        svelte({
            configFile: path.resolve(__dirname, "svelte.config.js")
        }),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icons/icon.svg", "icons/maskable-icon.svg"],
            manifest: {
                name: "Chord Sheet Manager",
                short_name: "Sheets",
                description: "Organize, transpose, annotate, and view chord sheets offline",
                theme_color: "#67b6b6",
                background_color: "#c1e9e9",
                display: "standalone",
                orientation: "any",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "icons/icon.svg",
                        sizes: "192x192 512x512",
                        type: "image/svg+xml",
                        purpose: "any"
                    },
                    {
                        src: "icons/maskable-icon.svg",
                        sizes: "512x512",
                        type: "image/svg+xml",
                        purpose: "maskable"
                    }
                ]
            },
            workbox: {
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,ttf,wasm,mjs}"],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "google-fonts-stylesheets"
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-webfonts",
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        })
    ]
})
