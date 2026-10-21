# 验证记录

## 2026-10-21：Vercel PWA 构建修复

- PWA 生成器改用 Next.js 构建完成钩子提供的首页和静态文件路径，不再假设 `.next/server/app/index.html` 存在；生成 Worker 后才调用平台适配器打包。
- 回归测试覆盖本地与适配器目录、首页和资源变更后的缓存版本、缺失或动态首页拒绝生成、首次部署的 Worker 打包顺序，以及通过 `NEXT_ADAPTER_PATH` 加载 ESM / CommonJS 平台适配器和保留配置钩子。
- `pnpm typecheck`、`pnpm lint`、`pnpm test`（10 个文件、253 项测试）及 `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts` 通过；锁文件纳入项目，Vercel 使用 Corepack 和冻结安装。
- 本轮未执行生产构建、启动服务或部署；Vercel 实际部署产物与线上离线行为尚未重新验收。

## 2026-10-21：Next.js Serverless 迁移

- 使用 Node.js 24、Next.js 16.4.2 的本地生产实例验证，首页静态生成，`/api/image` 为动态 Route Handler。
- 公共测试图片原站返回 `image/png`，没有 `Access-Control-Allow-Origin`；Markdown 和 HTML 图片均通过代理显示，成功导出 PNG / JPG / WebP，复制得到 PNG 剪贴板内容。已人工查看导出的 PNG，图片与中文均完整。
- 失效图片显示持久错误并阻止缺图导出；修改地址后恢复。刷新恢复源文和格式，390px 视口验证编辑 / 预览切换、主题及无横向溢出。
- 停止本地服务后重新加载页面，成功恢复中文草稿并导出 WebP，验证首页、字体及导出动态脚本可离线使用。API 与 RSC 的缓存排除另有自动测试覆盖。
- 本机 DNS 将公网域名解析为 `198.18.x.x`，按生产安全策略被拒绝。远程图片验收使用仅限验证进程、仅对两个测试域名生效的真实公网 DNS 解析；未放开生产地址校验或修改系统网络。
- `pnpm typecheck`、`pnpm lint`、`pnpm test`（10 个文件、246 项测试）、`pnpm build`、`pnpm icons:check` 与差异检查通过；设计静态审计为 0 个问题。未部署或提交；线上 Vercel 网络、Windows / Android 安装和 iOS 真机启动仍需独立验收。

下方保留迁移前的历史记录。

2026-09-24，本轮中文 Markdown 转图片功能验收。

## 自动检查

- `pnpm typecheck`：路由生成和 TypeScript 检查通过。
- `pnpm exec eslint features app scripts tests vitest.config.ts rsbuild.config.ts`：通过。
- `pnpm test`：5 个文件、110 项回归测试通过。覆盖中文解析和安全清理、文件编码、草稿、输入法及工作台操作、图片重试、导出尺寸与失败恢复。
- 本次文件的 Prettier 检查和 `git diff --check` 通过。
- `designmd lint DESIGN.md`：0 个错误；5 个 token 引用提示，运行时映射已在 DESIGN.md 和共享 CSS 中逐项核对。

## 浏览器与 PNG

使用本地 Rsbuild 开发实例和 Chromium 实际操作，没有执行生产构建。

- 同一中文示例在全部 9 个主题下成功导出 PNG；人工检查标题、强调、表格、代码、简繁体、Emoji 和末尾脚注，无缺失或截断。
- 验证 360 / 720 / 1200px 画布及 1 / 2 / 3 倍输出。1200px 的最新文稿输出为 1200 × 580；360px、3 倍输出为 1080 × 2859，与预览尺寸相符。
- 验证改稿、改宽度、切主题后立即导出，以及刷新恢复草稿后立即导出。
- 390px 嵌入视口中检查主题、编辑 / 预览切换；从编辑视图直接导出成功，并切换到可见预览。与桌面的默认示例 PNG 文件一致。
- 同地址图片首次加载失败时导出被阻止；资源恢复后点击重试，图片显示并成功进入 PNG。
- 检查界面浅深色及关闭单次换行后的标准段落模式。编码选择与输入法组合事件由真实 React 控件交互测试覆盖。

## 设计扫描边界

技能提供的 `audit_project.py --mode strict` 已执行，未把脚本结果写成全部通过：

- 默认范围发现原有 `app/login/page.tsx` 的表单缺少 `noValidate`，HEAD 中已存在，未扩大任务修改登录验证契约。
- 显式扫描 `features` 和 `components/ui` 时，脚本把 JSX 的 `Select`、`Textarea` 标签转成小写，分别误认成原生 select 和缺少 resize-none 的原生 textarea。实际代码导入共享 shadcn / Base UI 组件；Textarea 在共享实现中有 `resize-none`，Select 使用 Base UI 弹层，并通过工作台交互测试。

临时窄屏页面和图片测试资源已清理。没有提交、推送、生产构建或部署。
