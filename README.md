# 字里成图 · Markdown 转图片

基于 Next.js App Router、部署到 Vercel 的中文 Markdown 转图片工作台，无需登录。首页提供编辑与预览、九种图片主题、PNG / JPG / WebP 导出、复制图片、文件导入和本地草稿恢复。文稿编辑和图片生成在浏览器完成，远程图片通过同源服务端代理获取。

## 使用

- 在左侧编写 Markdown，或导入 `.md`、`.markdown`、`.txt`（最大 2 MB）。UTF-8 / BOM 默认识别，解码失败后可明确选择 GB18030 重试；失败不会覆盖正文。
- 选择主题，按需要展开“排版设置”。默认宽 720px、字号 18px、行高 1.8、边距 48px，保留正文单次换行。
- 选择 PNG、JPG 或 WebP 后导出，或按 Ctrl / ⌘ + Enter；输入法组词时快捷键不生效。支持 1 / 2 / 3 / 4 倍，预览缩放不影响输出尺寸。
- 修改会保存到当前浏览器。清空、载入示例和导入后可以“撤销替换”。保存失败时页面会显示错误并保留当前文稿。

支持标题、强调、删除线、列表、任务列表、引用、表格、链接、图片、脚注及代码高亮。数学公式、Mermaid 和分页导出不在首版范围。

## 中文与导出约定

`react-markdown` 按序应用 GFM、CJK 强调、CJK 删除线的 `parseOnly` 插件，再根据设置保留单次换行；反斜杠、代码和 URL 不经文本替换。原始 HTML 依次经过 `rehype-raw`、`rehype-sanitize`、`rehype-highlight`。

全部主题沿用项目默认字体，不额外增加字体。使用中文语言标记、严格断行、自然字距和可用时的 `text-autospace`，长链接和代码允许必要换行。浏览器断行能力不等同于完整出版排版标准。全角 Markdown 标记保持原文；裸链接紧贴中文句读时建议使用 `[文字](地址)` 消除歧义。

正文和配置只保存在浏览器，不上传 Markdown，不请求账号接口。Markdown 和安全 HTML 中的远程图片统一通过 `/api/image?url=<编码后的地址>` 获取，预览与导出共用同源图片地址，原站不必提供 CORS 授权；原文和草稿保留原始地址。同源图片、安全栅格 data 图片和 blob 图片保持原有处理，也不会自动读取 Markdown 文件旁的本地图片。所有格式导出均等待字体、图片和布局完成，资源失败明确报错；上限为单边 16384 像素、总计 16777216 像素，超限需降低倍率或缩短文稿。

代理仅访问公开的 HTTP / HTTPS 图片，支持 PNG、JPEG、GIF、WebP、AVIF、SVG，保持原始字节和尺寸。默认总超时 15 秒、最多 3 次重定向、单图上限 20 MiB；超限或传输中断时会终止响应，页面阻止缺图导出。每次跳转均检查 DNS 和公网地址，连接固定到已验证的 IP；禁止本站递归、本机、内网、保留网络、非标准端口及包含账号密码的 URL。代理不转发 Cookie、Authorization 或 Referer，不缓存图片。需要登录、已过期、防盗链或原站拒绝服务端访问的图片仍可能失败。

## 安装与离线

部署到 HTTPS 域名根路径后，可使用 Chrome / Edge 浏览器菜单中的“安装应用”；iPhone / iPad 在 Safari 的分享菜单中选择“添加到主屏幕”，macOS Safari 可使用“添加到程序坞”。安装后以独立窗口打开“字里成图”。安装操作由浏览器提供。

正式版本首次联网打开后，会准备首页、脚本、样式、图标和本地字体的离线缓存；准备完成后可离线重新打开首页、编辑和导出不含远程图片的文稿。远程图片仍需联网，不缓存账号接口或后台页面。新版本等待旧窗口全部关闭后生效，不强制刷新正在编辑的文稿。草稿仍保存在当前浏览器或已安装应用的本地存储中，不承诺跨设备或不同安装实例同步。

缓存存储被拒绝、读取失败或资源被清理后，受控页面会尝试正常网络请求；网络错误和服务器错误保持原有语义，不伪装成离线成功。注册失败不阻塞普通网页使用。首次离线缓存未完成或被系统清理时，需要重新联网打开；本地存储不是文稿备份。

`public/manifest.webmanifest` 是安装元信息的唯一来源，HTML 的应用名称、介绍、主题色和 Apple 标题从中读取；已有 `id`、`scope`、`start_url` 均保持 `/`。Manifest 联网时优先重新验证网络内容并更新缓存，网络失败时才使用缓存；安装名称等元信息独立于页面版本更新，不必等待旧工作区关闭。品牌补底色为 `#6D28D9`，启动背景色为 `#FFFFFF`，两者分别用于图标与启动界面。

产品 Logo 唯一源文件为 `assets/logo.svg`，界面、SVG favicon 和包含 16 / 32 / 48px 的 ICO 保留原图。安装图标按用途派生：

- Windows / 桌面使用 192 / 512px PNG，先补齐紫底，再按 `scripts/lib/ios-mask.mjs` 的 iOS 连续曲线裁切，轮廓外透明。Manifest 的 `any` 仅引用这两张 PNG，避免浏览器改选原始 SVG 轮廓。
- Android 保留独立的不透明 512px maskable PNG 及 SVG，原图缩放至 62% 并居中补紫底，核心图形位于中心半径 40% 的安全圆内。
- Apple 主屏幕使用不透明的 180px 正方形 PNG，由系统裁切。

项目生成脚本复用已安装的 `@resvg/resvg-js`，轮廓数据随项目保存，不依赖个人 Skill 或其他项目目录。生成与一致性检查：

```sh
pnpm icons:generate
pnpm icons:check
```

`pnpm build` 会先生成图标，再执行 Next.js 生产构建。PWA 适配器在构建完成钩子中，根据 Next.js 提供的首页与静态资源路径、公开品牌资源生成带内容版本的 `public/sw.js`，包含导出所需的字体和动态脚本；随后交给平台适配器打包，确保首次部署也包含 Worker。本地与 Vercel 共用这条流程，不依赖 `.next` 内部目录结构。图片代理、RSC 请求与远程图片不会进入离线缓存。服务器需原样提供 `/sw.js`（JavaScript MIME 类型）、`/manifest.webmanifest`（`application/manifest+json`）及图标，不能将这些资源重写为 HTML；首页、Manifest 与 `sw.js` 建议使用 `Cache-Control: no-cache`，不能统一设置长期不可变缓存。开发模式不注册 Service Worker，避免缓存干扰热更新。安装与离线验收应使用正式构建和 HTTPS（本机可用 localhost）。

沿用 `.browserslistrc` 的 Chrome / Edge 111+、Firefox 128+、Safari 16.4+ 基线。页面声明 `viewport-fit=cover`，四边安全区由共享根布局消费一次，固定通知在自身边界处理；保留自然页面滚动与缩放。文件导入、图片下载和复制继续沿用现有能力检测与错误反馈。以上源码与自动检查不能替代 Windows / Android 安装、iOS 主屏幕启动、软键盘和横竖屏真机验收。

配置参考：[MDN PWA 图标](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)、[Apple Web App 配置](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)。

## 开发与验证

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

`typecheck` 先执行 `next typegen`，不要求预先运行开发服务或生产构建。测试覆盖图片代理和公网边界、解析与 HTML 清理、文件编码、草稿验证、字素统计、输入法、工作台交互、导出尺寸及资源失败恢复。样式与组件所有权见 [DESIGN.md](DESIGN.md)。

使用 Node.js 24 和 pnpm 11。需要运行时使用 `pnpm dev`；开发端口读取 `PORT`，默认 3000，也可使用 `pnpm dev --port 5174`。PowerShell 指定端口：

```powershell
$env:PORT = "5174"
pnpm dev
```

本地生产验收使用 `pnpm build` 后执行 `pnpm start`。仓库的 `vercel.json` 已指定 Next.js、`pnpm build`（包含离线资源生成）及框架默认输出目录，`package.json` 指定 Node.js 24；Vercel 安装时启用 Corepack，按 `packageManager` 中的 pnpm 版本和已纳入版本控制的 `pnpm-lock.yaml` 执行冻结安装。导入 Vercel 时沿用这些配置，不要设置为 `dist` 或纯静态导出。图片代理是 Node.js Serverless Function，不依赖持久磁盘、数据库、账号环境变量或独立后端。线上网络可达性需部署后单独验证。

本机代理软件的 Fake-IP DNS 模式可能把公网图片域名解析成 `198.18.x.x` 等保留地址，此时图片代理会返回 403。开发环境需为目标图片域名使用真实公网 DNS 结果；不要放开保留地址检查。普通浏览器能通过本机代理打开图片，不代表服务端已取得可安全连接的公网地址。

首页 `/` 公开，登录与后台模板已移除。工作台位于明确的客户端边界内；页面外壳和图片接口由 Next.js 管理。草稿存储键和版本保持兼容；更换域名、端口或浏览器安装实例不会自动迁移草稿。
