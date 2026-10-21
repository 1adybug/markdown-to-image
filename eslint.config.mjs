import config from "@1adybug/eslint"

const eslintConfig = [
    {
        ignores: ["components/ui/**", ".next/**", ".verification/**", "next-env.d.ts", "public/sw.js"],
    },
    ...config,
]

export default eslintConfig
