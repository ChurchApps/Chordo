let timerId: ReturnType<typeof setInterval> | null = null

self.onmessage = (e: MessageEvent) => {
    if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
    }
    if (e.data?.action === "start") {
        timerId = setInterval(() => self.postMessage("tick"), e.data.interval || 25)
    }
}
