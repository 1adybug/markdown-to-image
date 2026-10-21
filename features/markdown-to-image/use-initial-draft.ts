import { useState, useSyncExternalStore } from "react"

import { type LoadDraftResult, loadDraft } from "./draft"

// Draft restoration is a single read per workspace, not cross-tab synchronization.
const subscribe = () => () => {}

const getServerSnapshot = () => null

export function useInitialDraft() {
    const [getSnapshot] = useState(() => {
        let snapshot: LoadDraftResult | undefined
        return () => (snapshot ??= loadDraft())
    })

    // The server and hydration both start without a browser draft. React reads
    // the cached browser snapshot after hydration, before edits become available.
    return useSyncExternalStore<LoadDraftResult | null>(subscribe, getSnapshot, getServerSnapshot)
}
