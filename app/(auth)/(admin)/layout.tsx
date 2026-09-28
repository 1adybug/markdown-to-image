import type { FC } from "react"

import { Navigate, Outlet } from "react-router"

import { Role } from "@/apis/login"

import { useGetAccount } from "@/hooks/useGetAccount"

const Layout: FC = () => {
    const { data } = useGetAccount()
    if (data?.role !== Role.管理员) return <Navigate to="/" />
    return <Outlet />
}

export default Layout
