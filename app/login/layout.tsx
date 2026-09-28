import { Outlet } from "react-router"

import { Auth } from "@/components/Auth"

export default function Layout() {
    return (
        <Auth>
            <Outlet />
        </Auth>
    )
}
