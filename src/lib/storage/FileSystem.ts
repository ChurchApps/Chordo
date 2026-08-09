import { Filesystem, Directory, Encoding } from "@capacitor/filesystem"
import { Capacitor } from "@capacitor/core"

type ConfigNames = "data"

export class FileSystem {
    // deleted on uninstall
    private static DIR_DATA = Directory.Data

    private static getJSONFilePath(folderName: string, name: string): string {
        return name.endsWith(".json") ? `${folderName}/${name}` : `${folderName}/${name}.json`
    }

    // --- JSON ---

    static async writeJSONFile<T extends object>(folderName: string, name: string, data: T): Promise<boolean> {
        const path = this.getJSONFilePath(folderName, name)
        let dataString: string
        try {
            dataString = JSON.stringify(data, null, 2) // Pretty-print JSON with 2 spaces indentation
        } catch (err) {
            console.error(`Failed to stringify data for file "${path}":`, err)
            return false
        }

        try {
            await Filesystem.writeFile({ path, data: dataString, directory: this.DIR_DATA, encoding: Encoding.UTF8, recursive: true })
        } catch (err) {
            console.error(`Failed to write file "${path}":`, err)
            return false
        }

        return true
    }

    static async readJSONFile<T extends object>(folderName: string, name: string): Promise<T | null> {
        const path = this.getJSONFilePath(folderName, name)
        let file: any
        try {
            file = await Filesystem.readFile({ path, directory: this.DIR_DATA, encoding: Encoding.UTF8 })
        } catch (err: any) {
            if (!err.message || !err.message.includes("File does not exist")) {
                console.error(`Failed to read file "${path}":`, err)
            }
            return null
        }

        try {
            return JSON.parse(file.data as string)
        } catch (err) {
            console.error(`Failed to parse JSON from file "${path}":`, err)
            return null
        }
    }

    // --- Binary & Media Operations (Images, PDFs) ---

    static async writeFile(folderName: string, name: string, base64Data: string): Promise<boolean> {
        const path = `${folderName}/${name}`

        // remove any 'data:image/png;base64,' prefix
        const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data

        try {
            await Filesystem.writeFile({ path, data: cleanBase64, directory: this.DIR_DATA, recursive: true })
            // return result.uri // Returns the native file path (file://...)
            return true
        } catch (err) {
            console.error(`Failed to write file "${path}":`, err)
            return false
        }
    }

    // static async readFile(folderName: string, name: string): Promise<string | null> {
    //     const path = `${folderName}/${name}`
    //     try {
    //         const file = await Filesystem.readFile({ path, directory: this.DIR_DATA })
    //         return file.data as string
    //     } catch (err) {
    //         console.error(`Failed to read file "${path}":`, err)
    //         return null
    //     }
    // }

    static async getFileWebUrl(folderName: string, name: string): Promise<string | null> {
        const path = `${folderName}/${name}`
        try {
            const fileInfo = await Filesystem.getUri({ path, directory: this.DIR_DATA })
            // Converts native file:// path to a webview-friendly url (capacitor:// or http://localhost)
            return Capacitor.convertFileSrc(fileInfo.uri)
        } catch (err) {
            console.error(`Failed to get web URL for file "${path}":`, err)
            return null
        }
    }

    ///

    static async saveConfig<T extends object>(config: ConfigNames, data: T): Promise<boolean> {
        return this.writeJSONFile<T>("config", config, data)
    }

    static async loadConfig<T extends object>(config: ConfigNames): Promise<T | null> {
        return this.readJSONFile<T>("config", config)
    }

    static async saveMedia(name: string, base64Data: string): Promise<boolean> {
        return this.writeFile("media", name, base64Data)
    }

    static async getMediaWebUrl(name: string): Promise<string | null> {
        return this.getFileWebUrl("media", name)
    }
}
