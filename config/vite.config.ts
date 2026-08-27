import { svelte } from "@sveltejs/vite-plugin-svelte"
import fs from "node:fs"
import type { IncomingMessage } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, "package.json"), "utf-8"))

function loadDevVars(): Record<string, string> {
    const file = path.resolve(rootDir, ".dev.vars")
    if (!fs.existsSync(file)) return {}
    const env: Record<string, string> = {}
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const eq = trimmed.indexOf("=")
        if (eq === -1) continue
        env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return env
}

async function readRequestBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
    const method = req.method || "GET"
    if (method === "GET" || method === "HEAD") return undefined
    const chunks: Buffer[] = []
    for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    return new Uint8Array(Buffer.concat(chunks))
}

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
        // Serve the Cloudflare Worker at /api/* during dev, so localhost matches production.
        // Without this Vite's SPA fallback answers /api/proxy and /api/share with index.html.
        {
            name: "dev-api-worker",
            configureServer(server) {
                const env = loadDevVars()
                server.middlewares.use(async (req, res, next) => {
                    const url = req.originalUrl || req.url || ""
                    if (!url.startsWith("/api/proxy") && !url.startsWith("/api/share")) return next()
                    try {
                        const worker = (await server.ssrLoadModule("/workers/index.ts")).default
                        const body = await readRequestBody(req)
                        const headers = new Headers()
                        for (const [key, value] of Object.entries(req.headers)) {
                            if (value == null) continue
                            headers.set(key, Array.isArray(value) ? value.join(", ") : value)
                        }
                        const request = new Request(`http://localhost${url}`, {
                            method: req.method,
                            headers,
                            body: body && body.length ? new Blob([Buffer.from(body)]) : undefined
                        })
                        const response = await worker.fetch(request, env)
                        res.statusCode = response.status
                        response.headers.forEach((value: string, key: string) => res.setHeader(key, value))
                        res.end(Buffer.from(await response.arrayBuffer()))
                    } catch (err: any) {
                        res.statusCode = 502
                        res.end(`API error: ${err?.message || err}`)
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
