# 验证记录

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
