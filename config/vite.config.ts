import { svelte } from "@sveltejs/vite-plugin-svelte"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, "package.json"), "utf-8"))

// https://vite.dev/config/
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version || "0.0.0")
    },
    root: rootDir,
    publicDir: path.resolve(rootDir, "public"),
    build: {
        outDir: path.resolve(rootDir, "dist"),
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("node_modules/@material/web")) {
                        return "material-web"
                    }
                    if (id.includes("node_modules/pdfjs-dist")) {
                        return "pdfjs"
                    }
                }
            }
        }
    },
    resolve: {
        alias: {
            $lib: path.resolve(rootDir, "src/lib"),
            $components: path.resolve(rootDir, "src/components")
        }
    },
    plugins: [
        // Serve the Cloudflare Worker at /api/proxy during dev, so localhost matches production.
        // Without this Vite's SPA fallback answers /api/proxy with index.html and a 200.
        {
            name: "dev-proxy-worker",
            configureServer(server) {
                server.middlewares.use("/api/proxy", async (req, res) => {
                    try {
                        const worker = (await server.ssrLoadModule("/workers/proxy.ts")).default
                        const response = await worker.fetch(new Request(`http://localhost${req.originalUrl}`))
                        res.statusCode = response.status
                        res.setHeader("Content-Type", response.headers.get("Content-Type") ?? "text/plain")
                        res.end(await response.text())
                    } catch (err: any) {
                        res.statusCode = 502
                        res.end(`Proxy error: ${err?.message || err}`)
                    }
                })
            }
        },
        svelte({
            configFile: path.resolve(__dirname, "svelte.config.js")
        }),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icons/icon.svg", "icons/maskable-icon.svg"],
            manifest: {
                name: "Chordo: Chords Manager",
                short_name: "Chordo",
                description: "Organize, transpose, annotate, and view chord sheets",
                theme_color: "#f5aa67",
                background_color: "#feddc2",
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
