import { type ChangeEvent, type FC, useEffect, useState } from "react"

import type { LoginParams } from "@/apis/login"

import loginBackground from "@/assets/login.webp"
import logo from "@/assets/logo.svg?url"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useLogin } from "@/hooks/useLogin"
import { useSendCaptcha } from "@/hooks/useSendCaptcha"

const Page: FC = () => {
    const [values, setValues] = useState<LoginParams>({
        usernameOrPhone: "",
        code: "",
    })

    const [left, setLeft] = useState(0)

    const { mutateAsync: login, isPending: isLoginPending } = useLogin()

    const { mutateAsync: sendCaptcha, isPending: isSendCaptchaPending } = useSendCaptcha({
        onSuccess() {
            setLeft(60)
        },
    })

    useEffect(() => {
        if (left <= 0) return
        const timeout = setTimeout(() => setLeft(current => current - 1), 1000)
        return () => clearTimeout(timeout)
    }, [left])

    const isRequesting = isLoginPending || isSendCaptchaPending
    const usernameOrPhone = values.usernameOrPhone.trim()
    const code = values.code.trim()

    function onUsernameOrPhoneChange(event: ChangeEvent<HTMLInputElement>) {
        setValues(current => ({ ...current, usernameOrPhone: event.target.value }))
    }

    function onCodeChange(event: ChangeEvent<HTMLInputElement>) {
        setValues(current => ({ ...current, code: event.target.value }))
    }

    async function loginAction() {
        await login({ usernameOrPhone, code })
    }

    return (
        <main className="grid h-full grid-cols-1 sm:grid-cols-2">
            <title>登录</title>
            <div className="relative p-8">
                <div className="flex items-center gap-2">
                    <div className="flex">
                        <img className="size-10" src={logo} width={40} height={40} alt="" />
                    </div>
                    <h1 className="text-2xl font-bold">字里成图</h1>
                </div>
                <div className="absolute top-1/2 left-1/2 w-72 -translate-x-1/2 -translate-y-1/2">
                    <form className="grid gap-4" action={loginAction}>
                        <label className="sr-only" htmlFor="usernameOrPhone">
                            用户名或手机号
                        </label>
                        <Input
                            id="usernameOrPhone"
                            className="h-10"
                            name="usernameOrPhone"
                            value={values.usernameOrPhone}
                            placeholder="用户名或手机号"
                            autoComplete="off"
                            onChange={onUsernameOrPhoneChange}
                        />
                        <div className="flex items-center gap-2">
                            <label className="sr-only" htmlFor="code">
                                验证码
                            </label>
                            <Input
                                id="code"
                                className="h-10 min-w-0"
                                name="code"
                                value={values.code}
                                placeholder="验证码"
                                autoComplete="off"
                                onChange={onCodeChange}
                            />
                            <Button
                                className="h-10 min-w-24 flex-none"
                                type="button"
                                variant="outline"
                                disabled={isRequesting || left > 0 || !usernameOrPhone}
                                onClick={() => sendCaptcha(usernameOrPhone)}
                            >
                                {left > 0 ? `${left} 秒后重试` : "发送验证码"}
                            </Button>
                        </div>
                        <Button className="h-10 w-full" type="submit" disabled={isRequesting || !usernameOrPhone || !code}>
                            登录
                        </Button>
                    </form>
                </div>
            </div>
            <div className="hidden bg-cover bg-bottom sm:block" style={{ backgroundImage: `url(${loginBackground})` }} />
        </main>
    )
}

export default Page
