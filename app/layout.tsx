import type { FC } from "react"

import { Outlet } from "react-router"

import { Registry } from "@/components/Registry"

const Layout: FC = () => (
    <Registry>
        <Outlet />
    </Registry>
)

export default Layout
