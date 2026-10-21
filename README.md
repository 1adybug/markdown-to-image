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

缓存存储被拒绝、读取失败或资源被清理后，受控页面会尝试正常网络请求；网络错误和服务器错误保持原有语义，不伪装成离线成功。注册失败不阻塞普通网页使用。首次离线缓存未完成或被系统清理时，需要重新联网打开；本地存储不是文稿备份。

`public/manifest.webmanifest` 是安装元信息的唯一来源，HTML 的应用名称、介绍、主题色和 Apple 标题从中读取；已有 `id`、`scope`、`start_url` 均保持 `/`。品牌补底色为 `#6D28D9`，启动背景色为 `#FFFFFF`，两者分别用于图标与启动界面。

产品 Logo 唯一源文件为 `assets/logo.svg`，界面、SVG favicon 和包含 16 / 32 / 48px 的 ICO 保留原图。安装图标按用途派生：

- Windows / 桌面使用 192 / 512px PNG，先补齐紫底，再按 `scripts/lib/ios-mask.mjs` 的 iOS 连续曲线裁切，轮廓外透明。Manifest 的 `any` 仅引用这两张 PNG，避免浏览器改选原始 SVG 轮廓。
- Android 保留独立的不透明 512px maskable PNG 及 SVG，原图缩放至 62% 并居中补紫底，核心图形位于中心半径 40% 的安全圆内。
- Apple 主屏幕使用不透明的 180px 正方形 PNG，由系统裁切。

项目生成脚本复用已安装的 `@resvg/resvg-js`，轮廓数据随项目保存，不依赖个人 Skill 或其他项目目录。生成与一致性检查：

```sh
pnpm icons:generate
pnpm icons:check
```

`pnpm build` 会先重新生成图标，再从最终资源生成带内容版本的 `sw.js`，包含导出所需的字体和动态脚本。服务器需原样提供 `/sw.js`（JavaScript MIME 类型）、`/manifest.webmanifest`（`application/manifest+json`）及图标，不能将这些资源重写为 HTML；首页、Manifest 与 `sw.js` 建议使用 `Cache-Control: no-cache`，不能统一设置长期不可变缓存。开发模式不注册 Service Worker，避免缓存干扰热更新。安装与离线验收应使用正式构建和 HTTPS（本机可用 localhost）。

沿用 `.browserslistrc` 的 Chrome / Edge 111+、Firefox 128+、Safari 16.4+ 基线。页面声明 `viewport-fit=cover`，四边安全区由共享根布局消费一次，固定通知在自身边界处理；保留自然页面滚动与缩放。文件导入、图片下载和复制继续沿用现有能力检测与错误反馈。以上源码与自动检查不能替代 Windows / Android 安装、iOS 主屏幕启动、软键盘和横竖屏真机验收。

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
