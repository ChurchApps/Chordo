<script lang="ts">
    import { onMount, tick } from "svelte"

    let {
        padding = 20, // mm
        headerText = "",
        children
    } = $props<{
        padding?: number
        headerText?: string
        children: any
    }>()

    // A4 aspect ratio is 210mm / 297mm
    const ASPECT_RATIO = 210 / 297

    let containerEl: HTMLElement
    let sourceEl: HTMLElement
    let pagesContainerEl: HTMLElement

    /**
     * Measures slotted DOM elements and distributes them across A-paper page containers.
     * Handles vertical overflow, CSS multi-column horizontal overflow, and recursive container splitting.
     */
    async function paginate() {
        if (!sourceEl || !pagesContainerEl || !containerEl) return

        await tick()

        // Clear previously generated pages
        pagesContainerEl.innerHTML = ""

        const nodes = Array.from(sourceEl.childNodes)
        if (nodes.length === 0) return

        // Helper: Constructs a new page shell
        const createPage = (pageNum: number) => {
            const page = document.createElement("div")
            page.className = "paper-page"
            page.style.aspectRatio = `${ASPECT_RATIO}`
            page.style.padding = `${padding}mm`

            // Top Center Header (not on first page)
            if (headerText && pageNum > 1) {
                const header = document.createElement("div")
                header.className = "page-header"
                header.textContent = headerText
                page.appendChild(header)
            }

            const content = document.createElement("div")
            content.className = "page-content"
            page.appendChild(content)

            const footer = document.createElement("div")
            footer.className = "page-number"
            footer.setAttribute("data-page", pageNum.toString())
            page.appendChild(footer)

            return { page, content }
        }

        let currentPageNum = 1
        let { page: currentPage, content: currentContent } = createPage(currentPageNum)
        pagesContainerEl.appendChild(currentPage)

        /**
         * Checks if content exceeds either vertical height OR multi-column width capacity.
         * Uses a +1px tolerance buffer for subpixel calculation rounding.
         */
        const isOverflowing = (container: HTMLElement): boolean => {
            return container.scrollHeight > container.clientHeight + 1 || container.scrollWidth > container.clientWidth + 1
        }

        /**
         * Recursively appends nodes to the page. If a container element overflows,
         * it shallow-clones the container onto the current page and splits its children across pages.
         */
        const appendNodeWithSplitting = (node: Node, targetContainer: HTMLElement) => {
            // Ignore empty whitespace text nodes between HTML tags
            if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
                return
            }

            const clone = node.cloneNode(true) as HTMLElement
            targetContainer.appendChild(clone)

            // If it fits within page bounds, finish
            if (!isOverflowing(currentContent)) {
                return
            }

            // Overflow detected: remove deep clone
            targetContainer.removeChild(clone)

            // If the node is a container element with children (e.g. .chordpro-container or a wrapper div),
            // shallow-clone its outer structure and split its child elements individually.
            if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
                let currentShell = node.cloneNode(false) as HTMLElement
                targetContainer.appendChild(currentShell)

                for (const childNode of Array.from(node.childNodes)) {
                    if (childNode.nodeType === Node.TEXT_NODE && !childNode.textContent?.trim()) {
                        continue
                    }

                    const childClone = childNode.cloneNode(true) as HTMLElement
                    currentShell.appendChild(childClone)

                    if (isOverflowing(currentContent)) {
                        // If the shell already contains previous children on this page, move this child to a new page
                        if (currentShell.childNodes.length > 1) {
                            currentShell.removeChild(childClone)

                            // Create new page
                            currentPageNum++
                            const nextPage = createPage(currentPageNum)
                            currentPage = nextPage.page
                            currentContent = nextPage.content
                            pagesContainerEl.appendChild(currentPage)

                            // Re-create the container shell on the new page
                            currentShell = node.cloneNode(false) as HTMLElement
                            currentContent.appendChild(currentShell)

                            // Recursively add the child node to the new page container
                            appendNodeWithSplitting(childNode, currentShell)
                        } else {
                            // First child in shell overflows. Move whole shell to new page if current page isn't empty.
                            if (targetContainer.childNodes.length > 1) {
                                targetContainer.removeChild(currentShell)

                                currentPageNum++
                                const nextPage = createPage(currentPageNum)
                                currentPage = nextPage.page
                                currentContent = nextPage.content
                                pagesContainerEl.appendChild(currentPage)

                                currentShell = node.cloneNode(false) as HTMLElement
                                currentContent.appendChild(currentShell)

                                appendNodeWithSplitting(childNode, currentShell)
                            } else {
                                // Node naturally exceeds a single page height on its own; leave to prevent infinite loops
                            }
                        }
                    }
                }
            } else {
                // Leaf element (single line, image, text) overflowed; spin up a new page and append
                currentPageNum++
                const nextPage = createPage(currentPageNum)
                currentPage = nextPage.page
                currentContent = nextPage.content
                pagesContainerEl.appendChild(currentPage)

                currentContent.appendChild(clone)
            }
        }

        // Run pagination across all root nodes in the slot
        for (const node of nodes) {
            appendNodeWithSplitting(node, currentContent)
        }

        // Update "Page X / Y" footers
        const pageNumbers = pagesContainerEl.querySelectorAll(".page-number")
        pageNumbers.forEach((el) => {
            const num = el.getAttribute("data-page")
            el.textContent = `${num} / ${currentPageNum}`
        })
    }

    $effect(() => {
        padding
        headerText
        paginate()
    })

    onMount(() => {
        // Re-paginate when container size changes
        const resizeObserver = new ResizeObserver(() => paginate())
        if (containerEl) resizeObserver.observe(containerEl)

        // Re-paginate when inner DOM or slotted content mutates
        const mutationObserver = new MutationObserver(() => paginate())
        if (sourceEl) {
            mutationObserver.observe(sourceEl, {
                childList: true,
                subtree: true,
                characterData: true
            })
        }

        // Trigger pagination when embedded images complete loading
        const handleImageLoad = () => paginate()
        sourceEl?.addEventListener("load", handleImageLoad, true)

        paginate()

        return () => {
            resizeObserver.disconnect()
            mutationObserver.disconnect()
            sourceEl?.removeEventListener("load", handleImageLoad, true)
        }
    })
</script>

<div class="paper-viewer" bind:this={containerEl}>
    <!-- Offscreen Slot Container (used for layout reference & reading DOM nodes) -->
    <div class="source-container" bind:this={sourceEl}>
        {@render children()}
    </div>

    <!-- Paginated DOM Container -->
    <div class="pages-stack" bind:this={pagesContainerEl}></div>
</div>

<style>
    .paper-viewer {
        width: 100%;
        position: relative;
        box-sizing: border-box;

        user-select: none;
    }

    :global(.page-header) {
        position: absolute;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);

        color: black;
        font-size: 0.8rem;
        opacity: 0.4;

        z-index: 1;
    }

    /* Keep source hidden offscreen while ensuring image/CSS layouts calculate */
    .source-container {
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 100%;
        visibility: hidden;
        pointer-events: none;
    }

    .pages-stack {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        width: 100%;
    }

    :global(.paper-page) {
        width: 100%;
        background: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-radius: 2px;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        color: #111111;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    :global(.page-content) {
        height: 100%;
        overflow: hidden;
        box-sizing: border-box;
    }

    :global(.page-content > *:first-child) {
        margin-top: 0;
    }

    :global(.page-content img) {
        max-width: 100%;
        height: auto;
    }

    :global(.page-number) {
        position: absolute;
        bottom: 8mm;
        right: 12mm;
        font-size: 0.75rem;
        color: #888888;
        font-family: system-ui, sans-serif;
    }

    @media print {
        :global(body) {
            background: white;
        }

        .pages-stack {
            gap: 0;
        }

        :global(.paper-page) {
            box-shadow: none;
            page-break-after: always;
            break-after: page;
            height: 100vh;
            width: 100vw;
        }

        :global(.page-number) {
            display: none;
        }
    }
</style>
