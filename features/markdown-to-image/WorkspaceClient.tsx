"use client"

import dynamic from "next/dynamic"

const Workspace = dynamic(() => import("./MarkdownWorkspace").then(module => module.MarkdownWorkspace), {
    ssr: false,
    loading: () => (
        <main className="p-9" role="status">
            正在打开工作台…
        </main>
    ),
})

export function WorkspaceClient() {
    return <Workspace />
}
