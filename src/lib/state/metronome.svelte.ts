export type MetronomeSoundType = "digital" | "metal" | "silent"

export interface MetronomeState {
    isPlaying: boolean
    bpm: number
    beatsPerBar: number
    currentBeat: number
    soundType: MetronomeSoundType
}

export const metronomeState = $state<MetronomeState>({
    isPlaying: false,
    bpm: 120,
    beatsPerBar: 4,
    currentBeat: 0,
    soundType: (typeof localStorage !== "undefined" && (localStorage.getItem("chordo_metronome_sound") as MetronomeSoundType)) || "digital"
})

let audioCtx: AudioContext | null = null
let hiBuffer: AudioBuffer | null = null
let loBuffer: AudioBuffer | null = null
let worker: Worker | null = null
let nextNoteTime = 0
let currentBeatCounter = 0

async function getAudioContext(): Promise<AudioContext> {
    if (!audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        audioCtx = new AudioCtx()
    }
    if (audioCtx.state === "suspended") {
        await audioCtx.resume()
    }
    return audioCtx
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
    try {
        const ctx = await getAudioContext()
        const res = await fetch(url)
        return await ctx.decodeAudioData(await res.arrayBuffer())
    } catch {
        return null
    }
}

function playClick(ctx: AudioContext, time: number, isAccent: boolean) {
    if (metronomeState.soundType === "silent") return

    if (metronomeState.soundType === "metal") {
        const buffer = isAccent ? hiBuffer || loBuffer : loBuffer || hiBuffer
        if (buffer) {
            const source = ctx.createBufferSource()
            source.buffer = buffer
            source.connect(ctx.destination)
            source.start(time)
            return
        }
    }

    // Built-in digital oscillator sound
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time)
    gain.gain.setValueAtTime(1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.04)
}

function scheduleNotes() {
    if (!audioCtx || !metronomeState.isPlaying) return
    const secondsPerBeat = 60 / metronomeState.bpm
    const beats = metronomeState.beatsPerBar

    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        const beat = currentBeatCounter % beats
        playClick(audioCtx, nextNoteTime, beat === 0)

        const delay = Math.max(0, (nextNoteTime - audioCtx.currentTime) * 1000)
        setTimeout(() => {
            if (metronomeState.isPlaying) metronomeState.currentBeat = beat
        }, delay)

        nextNoteTime += secondsPerBeat
        currentBeatCounter++
    }
}

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(new URL("../metronome/metronome.worker.ts", import.meta.url), { type: "module" })
        worker.onmessage = () => scheduleNotes()
    }
    return worker
}

export async function startMetronome(bpm?: number, beats?: number): Promise<void> {
    if (bpm) setMetronomeBpm(bpm)
    if (beats) setMetronomeBeatsPerBar(beats)

    const ctx = await getAudioContext()
    if (!hiBuffer) hiBuffer = await loadBuffer("/metronome/beat-metal-hi.webm")
    if (!loBuffer) loBuffer = await loadBuffer("/metronome/beat-metal-lo.webm")

    currentBeatCounter = 0
    metronomeState.currentBeat = 0
    nextNoteTime = ctx.currentTime + 0.05
    metronomeState.isPlaying = true

    getWorker().postMessage({ action: "start", interval: 25 })
}

export function stopMetronome(): void {
    metronomeState.isPlaying = false
    metronomeState.currentBeat = 0
    worker?.postMessage({ action: "stop" })
}

export function toggleMetronome(bpm?: number, beats?: number): void {
    metronomeState.isPlaying ? stopMetronome() : startMetronome(bpm, beats)
}

export function setMetronomeBpm(bpm: number): void {
    metronomeState.bpm = Math.max(20, Math.min(300, Math.round(bpm)))
}

export function setMetronomeBeatsPerBar(beats: number): void {
    metronomeState.beatsPerBar = Math.max(1, Math.min(16, Math.round(beats)))
    if (metronomeState.currentBeat >= metronomeState.beatsPerBar) metronomeState.currentBeat = 0
}

export function setMetronomeSoundType(type: MetronomeSoundType): void {
    metronomeState.soundType = type
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("chordo_metronome_sound", type)
        }
    } catch {
        // Ignore localStorage error in private mode
    }
}
