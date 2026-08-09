import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
    appId: "com.sheetmanager.app",
    appName: "Chord Sheet Manager",
    webDir: "dist",
    server: {
        androidScheme: "https"
    }
}

export default config
