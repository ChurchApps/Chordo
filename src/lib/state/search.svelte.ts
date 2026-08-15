export const searchState = $state<{
    isOpen: boolean
    query: string
}>({
    isOpen: false,
    query: ""
})

export function openSearch() {
    searchState.isOpen = true
}

export function closeSearch() {
    searchState.isOpen = false
    searchState.query = ""
}

export function setSearchQuery(query: string) {
    searchState.query = query
}
