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

## 安装与离线

部署到 HTTPS 域名根路径后，可使用 Chrome / Edge 浏览器菜单中的“安装应用”；iPhone / iPad 在 Safari 的分享菜单中选择“添加到主屏幕”，macOS Safari 可使用“添加到程序坞”。安装后以独立窗口打开“字里成图”。安装操作由浏览器提供。

正式版本首次联网打开后，会准备首页、脚本、样式、图标和本地字体的离线缓存；准备完成后可离线重新打开首页、编辑和导出不含远程图片的文稿。远程图片仍需联网，不缓存账号接口或后台页面。新版本等待旧窗口全部关闭后生效，不强制刷新正在编辑的文稿。草稿仍保存在当前浏览器或已安装应用的本地存储中，不承诺跨设备或不同安装实例同步。

产品 Logo 源文件为 `assets/logo.svg`：界面、favicon 和支持的 PWA 图标使用 SVG；Apple 主屏幕使用 180px PNG，PWA 提供 192 / 512px PNG 兼容图标及满版 maskable 图标，旧浏览器使用包含 16 / 32 / 48px 的 ICO。所有派生图标由同一 SVG 生成：

```sh
pnpm icons:generate
pnpm icons:check
```

`pnpm build` 会先重新生成图标，再从最终资源生成带内容版本的 `sw.js`，包含导出所需的字体和动态脚本。服务器需原样提供 `/sw.js`（JavaScript MIME 类型，建议 `Cache-Control: no-cache`）、`/manifest.webmanifest` 及图标，不能将这些资源重写为 HTML；首页与 `sw.js` 不应设置长期不可变缓存。开发模式不注册 Service Worker，避免缓存干扰热更新。安装与离线验收应使用正式构建和 HTTPS（本机可用 localhost）。

配置参考：[MDN PWA 图标](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)、[Apple Web App 配置](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)。

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
