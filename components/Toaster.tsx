import type { FC } from "react"

import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, XIcon } from "lucide-react"
import { Toaster as HotToaster, toast, ToastBar } from "react-hot-toast"

export const Toaster: FC = () => (
    <HotToaster
        containerStyle={{
            top: "calc(12px + env(safe-area-inset-top, 0px))",
            right: "calc(12px + env(safe-area-inset-right, 0px))",
            bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            left: "calc(12px + env(safe-area-inset-left, 0px))",
        }}
        gutter={6}
        position="top-center"
        reverseOrder={false}
        toastOptions={{
            duration: 4000,
            style: {
                maxWidth: "min(24rem, calc(100vw - 1.5rem))",
                padding: "0.5rem 0.625rem",
                color: "var(--popover-foreground)",
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "calc(var(--radius) * 1.8)",
                boxShadow: "0 4px 12px color-mix(in oklab, var(--foreground) 10%, transparent)",
            },
            success: {
                duration: 3500,
                icon: <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />,
            },
            error: {
                duration: 5000,
                icon: <CircleXIcon className="text-destructive size-4" />,
            },
            loading: {
                duration: Infinity,
                icon: <LoaderCircleIcon className="text-primary size-4 animate-spin" />,
            },
        }}
    >
        {currentToast => (
            <ToastBar toast={currentToast}>
                {({ icon, message }) => (
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-4 flex-none items-center justify-center">{icon}</span>
                        <div className="min-w-0 flex-1 text-sm leading-4 font-medium">{message}</div>
                        {currentToast.type !== "loading" && (
                            <button
                                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring ml-0.5 inline-flex size-6 flex-none items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                type="button"
                                aria-label="关闭通知"
                                onClick={() => toast.dismiss(currentToast.id)}
                            >
                                <XIcon className="size-3" />
                            </button>
                        )}
                    </div>
                )}
            </ToastBar>
        )}
    </HotToaster>
)
