export const MarkdownTheme = {
    "AI 风格": "ai",
    简约: "simple",
    暗色: "dark",
    纸张: "paper",
    极简: "minimal",
    科技: "tech",
    "Notion 风格": "notion",
    日落渐变: "sunset",
    终端主题: "terminal",
} as const

export type MarkdownTheme = (typeof MarkdownTheme)[keyof typeof MarkdownTheme]

export const PixelRatio = {
    一倍: 1,
    二倍: 2,
    三倍: 3,
    四倍: 4,
} as const

export type PixelRatio = (typeof PixelRatio)[keyof typeof PixelRatio]

export function isPixelRatio(value: unknown): value is PixelRatio {
    return Object.values(PixelRatio).some(ratio => ratio === value)
}

export interface DocumentSettings {
    theme: MarkdownTheme
    width: number
    fontSize: number
    lineHeight: number
    padding: number
    preserveLineBreaks: boolean
    pixelRatio: PixelRatio
}

export interface MarkdownDraft {
    source: string
    settings: DocumentSettings
}

export const defaultSettings: DocumentSettings = {
    theme: MarkdownTheme["AI 风格"],
    width: 720,
    fontSize: 18,
    lineHeight: 1.8,
    padding: 48,
    preserveLineBreaks: true,
    pixelRatio: PixelRatio.二倍,
}

export const settingRanges = {
    width: { min: 360, max: 1600, step: 20 },
    fontSize: { min: 12, max: 32, step: 1 },
    lineHeight: { min: 1.2, max: 2.4, step: 0.1 },
    padding: { min: 16, max: 96, step: 4 },
} as const

export const exampleMarkdown = `# 把文字，变成值得分享的图片

一份笔记、一段灵感，或者刚刚写完的文章。
让每一个汉字，都有舒服的位置。

## 中文表达，完整保留

这是**“值得被看见的想法”**，也是**（认真记录的日常）**。
记住**这一点：**好的排版，让阅读更轻松。
试着写下*「一点灵感」*，再划去~~「不再需要的句子」~~。

> 文字的意义，不只在于写下。
> 更在于它被读到的那一刻。

## 写作，也可以很简单

- [x] 粘贴或写下 Markdown
- [x] 选一个喜欢的主题
- [ ] 导出一张清晰的图片

| 排版细节 | 我们在意的事 |
| --- | --- |
| 中文标点 | 引号、括号与强调自然相处 |
| 中英混排 | 用 Markdown 记录新的 idea |
| 高清导出 | 让小小的文字，也清晰可读 |

### 给代码一点颜色

\`\`\`typescript
const greeting = "你好，世界。"
console.log(greeting) // 从一句问候开始
\`\`\`

简体、繁體，和一点好心情 🌿

---

在左侧编辑，右侧会同步呈现。[^note]

[^note]: 内容仅保存在当前浏览器，不上传正文。`
