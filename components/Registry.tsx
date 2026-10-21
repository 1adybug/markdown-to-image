"use client"

import type { FC, ReactNode } from "react"

import { ThemeProvider } from "next-themes"

import { Toaster } from "@/components/Toaster"

import { TooltipProvider } from "./ui/tooltip"

export interface RegistryProps {
    children?: ReactNode
}

export const Registry: FC<RegistryProps> = ({ children }) => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
            {children}
            <Toaster />
        </TooltipProvider>
    </ThemeProvider>
)
