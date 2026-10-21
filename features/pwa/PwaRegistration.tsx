"use client"

import { useEffect } from "react"

import { registerServiceWorker } from "./register"

export function PwaRegistration() {
    useEffect(registerServiceWorker, [])
    return null
}
