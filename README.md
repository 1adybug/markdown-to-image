# 字里成图 · Markdown 转图片

免登录、浏览器本地处理的中文 Markdown 转 PNG 工作台。首页提供编辑与预览、九种图片主题、排版设置、文件导入和本地草稿恢复。

## 使用

- 在左侧编写 Markdown，或导入 `.md`、`.markdown`、`.txt`（最大 2 MB）。UTF-8 / BOM 默认识别，解码失败后可明确选择 GB18030 重试；失败不会覆盖正文。
- 选择主题，按需要展开“排版设置”。默认宽 720px、字号 18px、行高 1.8、边距 48px，保留正文单次换行。
- 点击“导出 PNG”，或按 Ctrl / ⌘ + Enter；输入法组词时快捷键不生效。支持 1 / 2 / 3 倍，预览缩放不影响输出尺寸。
- 修改会保存到当前浏览器。清空、载入示例和导入后可以“撤销替换”。保存失败时页面会显示错误并保留当前文稿。

支持标题、强调、删除线、列表、任务列表、引用、表格、链接、图片、脚注及代码高亮。数学公式、Mermaid 和分页导出不在首版范围。

## 中文与导出约定

`react-markdown` 按序应用 GFM、CJK 强调、CJK 删除线的 `parseOnly` 插件，再根据设置保留单次换行；反斜杠、代码和 URL 不经文本替换。原始 HTML 依次经过 `rehype-raw`、`rehype-sanitize`、`rehype-highlight`。

全部主题沿用项目默认字体，不额外增加字体。使用中文语言标记、严格断行、自然字距和可用时的 `text-autospace`，长链接和代码允许必要换行。浏览器断行能力不等同于完整出版排版标准。全角 Markdown 标记保持原文；裸链接紧贴中文句读时建议使用 `[文字](地址)` 消除歧义。

正文和配置只保存在浏览器，不请求账号接口。远程图片会从原地址加载，需要允许跨域访问；不提供图片代理，也不会自动读取 Markdown 文件旁的本地图片。PNG 导出等待字体、图片和布局完成，资源失败明确报错；上限为单边 16384 像素、总计 16777216 像素，超限需降低倍率或缩短文稿。

## 开发与验证

```sh
pnpm install
pnpm typecheck
pnpm exec eslint features app scripts tests vitest.config.ts rsbuild.config.ts
pnpm test
```

`typecheck` 会先通过 sdrr 生成被 Git 忽略的路由文件。测试覆盖解析与 HTML 清理、文件编码、草稿验证、字素统计、输入法、工作台交互、导出尺寸及资源失败恢复。样式与组件所有权见 [DESIGN.md](DESIGN.md)。

需要运行时使用 `pnpm dev`；开发端口读取 `PORT`，默认 5173。PowerShell 指定端口：

```powershell
$env:PORT = "5174"
pnpm dev
```

首页 `/` 公开，原有 `(auth)` 路由和登录流程保留鉴权。项目基于 Rsbuild / React / Tailwind / shadcn；保留原模板的其他能力。
