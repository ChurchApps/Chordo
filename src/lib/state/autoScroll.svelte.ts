export interface AutoScrollState {
    isActive: boolean
    isPlaying: boolean
    speed: number // e.g. 1 to 10 (or px per second factor)
}

export const autoScrollState = $state<AutoScrollState>({
    isActive: false,
    isPlaying: false,
    speed: 3
})

let animationFrameId: number | null = null
let lastTimestamp: number | null = null
let targetScrollElement: HTMLElement | null = null
let targetContentElement: HTMLElement | null = null
let currentExactScrollTop: number | null = null

// Converts speed (1-10) to pixels per second.
// Super gentle, realistic performance/sing-along speeds:
// 1 = ~2.5px/s, 2 = ~4px/s, 3 = ~6px/s, 4 = ~8px/s, 5 = ~11px/s, 6 = ~14px/s, 7 = ~18px/s, 8 = ~22px/s, 9 = ~27px/s, 10 = ~33px/s
export function getPixelsPerSecond(speed: number): number {
    return Number((1.5 + speed * 1.1 + Math.pow(speed, 1.45) * 0.75).toFixed(2))
}

function clearSubpixelTransform() {
    if (targetContentElement) {
        targetContentElement.style.transform = ""
    }
}

function scrollStep(timestamp: number) {
    if (!autoScrollState.isActive || !autoScrollState.isPlaying || !targetScrollElement) {
        animationFrameId = null
        lastTimestamp = null
        currentExactScrollTop = null
        clearSubpixelTransform()
        return
    }

    if (lastTimestamp != null) {
        const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1)
        const pxPerSec = getPixelsPerSecond(autoScrollState.speed)

        const baseScroll = targetScrollElement.scrollTop
        if (currentExactScrollTop == null || Math.abs(currentExactScrollTop - baseScroll) > 4) {
            currentExactScrollTop = baseScroll
        }

        currentExactScrollTop += delta * pxPerSec

        const baseInt = Math.floor(currentExactScrollTop)
        const fraction = currentExactScrollTop - baseInt

        // Apply integer scroll to the native scroll container
        targetScrollElement.scrollTop = baseInt

        // Apply smooth sub-pixel interpolation on the content via GPU transform
        if (targetContentElement) {
            targetContentElement.style.transform = `translate3d(0, ${-fraction}px, 0)`
        }

        // Stop if reached the bottom
        const maxScroll = targetScrollElement.scrollHeight - targetScrollElement.clientHeight
        if (targetScrollElement.scrollTop >= maxScroll - 1) {
            pauseAutoScroll()
            currentExactScrollTop = null
            clearSubpixelTransform()
            return
        }
    }

    lastTimestamp = timestamp
    animationFrameId = requestAnimationFrame(scrollStep)
}

export function registerScrollElement(container: HTMLElement | null, content?: HTMLElement | null): void {
    targetScrollElement = container
    targetContentElement = content ?? null
}

export function startAutoScroll(el?: HTMLElement | null): void {
    if (el) targetScrollElement = el
    autoScrollState.isActive = true
    autoScrollState.isPlaying = true
    lastTimestamp = null
    if (animationFrameId != null) {
        cancelAnimationFrame(animationFrameId)
    }
    animationFrameId = requestAnimationFrame(scrollStep)
}

export function pauseAutoScroll(): void {
    autoScrollState.isPlaying = false
    if (animationFrameId != null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
    }
    lastTimestamp = null
    currentExactScrollTop = null
    clearSubpixelTransform()
}

export function resumeAutoScroll(): void {
    if (!autoScrollState.isActive) {
        autoScrollState.isActive = true
    }
    autoScrollState.isPlaying = true
    lastTimestamp = null
    if (animationFrameId != null) {
        cancelAnimationFrame(animationFrameId)
    }
    animationFrameId = requestAnimationFrame(scrollStep)
}

export function toggleAutoScrollPlay(): void {
    if (autoScrollState.isPlaying) {
        pauseAutoScroll()
    } else {
        resumeAutoScroll()
    }
}

export function setAutoScrollSpeed(speed: number): void {
    autoScrollState.speed = Math.max(1, Math.min(10, speed))
}

export function stopAutoScroll(): void {
    autoScrollState.isActive = false
    autoScrollState.isPlaying = false
    if (animationFrameId != null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
    }
    lastTimestamp = null
    currentExactScrollTop = null
    clearSubpixelTransform()
}
