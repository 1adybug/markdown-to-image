---
version: alpha
name: 字里成图
description: 面向中文写作者的本地 Markdown 转图片工作台，以安静的编辑区衬托可分享的文稿。
colors:
    primary: "oklch(0.491 0.27 292.581)"
    background: "oklch(1 0 0)"
    foreground: "oklch(0.145 0 0)"
    muted: "oklch(0.97 0 0)"
    muted-foreground: "oklch(0.556 0 0)"
    border: "oklch(0.922 0 0)"
    destructive: "oklch(0.577 0.245 27.325)"
typography:
    sans:
        fontFamily: '"Inter Variable", "Noto Sans SC Variable", sans-serif'
    mono:
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", "Inter Variable", "Noto Sans SC Variable", sans-serif, monospace'
rounded:
    DEFAULT: "0.45rem"
    panel: "12px"
    thumbnail: "8px"
spacing:
    page-max: "1680px"
    page-inline: "36px"
    mobile-inline: "16px"
    panel-gap: "20px"
components:
    button: {}
    input: {}
    textarea: {}
    select: {}
    radio-group: {}
    toggle-group: {}
    switch: {}
    alert: {}
    empty: {}
    collapsible: {}
---

# 字里成图 Design System

## Overview

视觉参考是桌面上的文稿校样：工具安静，纸面清晰，主题缩略图像一排不同的纸样。首页是产品工作台，主要用户是需要分享笔记、教程和中文长文的写作者。目标来自本轮用户需求，界面语言为简体中文；正文允许简繁体、中英混排、Emoji，不自动转换内容。

“文”字折角标志与纸样主题条是主要识别点。编辑器、设置和反馈沿用项目 shadcn / Base UI；避免营销大屏、装饰性渐变背景和占据工作空间的卡片堆叠。渐变仅用于用户选择的图片主题。

运行时样式是唯一 token 来源，本文件记录已实现的约定，不生成 CSS。`index.css` 的 `:root` / `.dark` → Tailwind `@theme inline` → `components/ui` 是应用控件的映射路径。`features/markdown-to-image/document.css` 的 `--doc-*` → `MarkdownDocument` 与主题缩略图是文稿颜色的映射路径。缩略图不维护第二套配色。`workspace.css` 只负责工作台布局和产品元素。

## Colors

应用沿用项目白灰底色、紫色主按钮、语义错误色和浅深色 ThemeProvider。正文与界面主题独立，切换界面深浅色不会改变导出的图片。

图片保留简约、AI 风格、暗色、纸张、极简、科技、Notion 风格、日落渐变和终端共九种主题。颜色由 `data-document-theme` 选择，标题、引用、边框、表格与代码高亮共用该主题的 `--doc-*`。纸张以暖纸色表达，终端以绿色和直角表达，不额外替换中文字体。

选中状态同时使用 Radio 状态和缩略图外框；焦点有独立轮廓。错误同时提供文字，不只依赖颜色。滚动条统一采用前景色混合的 thumb / hover / active、透明轨道；强制颜色模式恢复系统色。

## Typography

遵循用户最新要求，全部主题使用项目默认 `--font-sans`。沿用入口中已有的字体依赖，不添加字体、不指定本机中文字体名称。正文默认 18px、行高 1.8、400 字重，标题和强调使用 700 字重。代码使用平台等宽栈，保留浏览器的缺字后备能力。

文稿标记 `lang="zh-CN"`，正文左对齐、自然字距、`line-break: strict`、正常断词；`text-autospace` 为浏览器渐进增强，代码关闭自动间距。不向原文插入空格或隐藏字符。长链接、行内代码、表格单元格可以必要换行，围栏代码软换行并保留缩进。

中文断行依赖浏览器能力，不承诺完整出版排版标准。字体加载和导出嵌入失败必须显示错误，不能以替代字体导出后显示成功。

## Layout

桌面内容最大宽 1680px、横向留白 36px；1100px 以下留白 24px；767px 以下留白 16px。主题桌面九列，手机五列。设置默认折叠，摘要保留画布宽度、字号和导出倍率。

桌面左编辑右预览，间隔 20px；两个面板分别拥有滚动区域，预览底部保留尺寸信息。窄屏通过“编辑 / 预览”切换，避免双栏压缩。预览适应可见宽度，实际文稿保持用户指定像素宽度；输出不截取滚动区域，也不继承预览缩放。

默认文稿宽 720px、内边距 48px、2 倍导出。可设宽 360–1600px、字号 12–32px、行高 1.2–2.4、边距 16–96px，以及 1 / 2 / 3 倍。数值输入允许完整编辑，离开输入框或按 Enter 后提交；非法输入保留原值并提示。

## Elevation & Depth

工作面板通过细边框区分，不使用重阴影。预览纸面使用轻阴影表现边界，点状灰底区分画布和工作区；这些只属于预览容器，不进入 PNG。Select 弹层沿用共享组件定位与层级，不挤压正文布局。

## Shapes

控件继承 `--radius: 0.45rem` 及 Tailwind 派生值；工作面板为 12px 圆角，纸样为 8px 圆角。标志允许折角这一局部例外。终端图片的代码块与引用使用直角，不修改应用控件。

## Components

| 能力       | 唯一所有者                               | 行为约定                                                                                   |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| 控件与表单 | `components/ui`                          | 使用 Button、Input、Field、Select、Switch、RadioGroup、ToggleGroup；选项值与显示标签分离。 |
| 源文编辑   | `Textarea` 的 `editor` variant           | 完全受控；组词期间不改写内容、不抢光标、不触发导出快捷键。                                 |
| 文稿状态   | `MarkdownWorkspace` / `MarkdownDraft`    | 源文、主题、设置和换行模式为单一状态；不保存 HTML。                                        |
| 渲染       | `MarkdownDocument` / `markdown-pipeline` | 预览和导出共用，语法修复发生在分词阶段，原始 HTML 经过清理。                               |
| 导出       | `exportDocument`                         | 锁定编辑与参数，等待布局、字体、图片解码；失败恢复操作，成功才触发下载。                   |
| 草稿       | `draft.ts`                               | 浏览器本地保存；恢复失败、配额不足或不可用时保留当前内容并显示持久错误。                   |
| 替换与撤销 | `MarkdownWorkspace`                      | 清空、示例、导入保留上一次源文，使用“撤销替换”恢复；普通输入沿用文本框撤销。               |
| 反馈       | `Alert` / 现有 Toaster                   | 错误留在页面；成功使用现有通知；状态栏表达保存和输入状态。                                 |
| 空状态     | `Empty`                                  | 空文稿显示“从一句话开始”，禁用导出，示例入口仍可使用。                                     |

导出按钮是主要动作，固定最小宽度容纳忙碌标签和转圈图标；辅助动作使用 ghost / outline。不可用控件显式 disabled，保留焦点轮廓。图片主题使用 radio 键盘交互；缩放和视图使用 ToggleGroup。

导入失败保留正文，在错误附近选择 UTF-8 或 GB18030 并重试。文件始终在浏览器读取，不上传；远程图片仍由浏览器请求。用户可见文案说明操作结果和下一步，不暴露内部解析器名称。

图标统一使用 Lucide。关键动作保留文字，纯图标按钮提供可访问名称。动画仅用于操作状态和轻微 hover，尊重 `prefers-reduced-motion`；该规则中的局部 `!important` 用于覆盖共享控件动画时长。数字和字符计数使用中文 locale，字符计数按 Unicode 字素。

本工具只有一个主要工作流，行为约定保存在这里，不额外维护重复的 UX-CONTRACT。原有登录和后台路由继续沿用既有组件和鉴权。

## Do's and Don'ts

- 优先保持纸面可读和工作区安静；新主题必须覆盖标题、引用、表格和代码 token。
- 修改主题 token 时同步检查缩略图、预览及 PNG，字体继续复用项目默认设置。
- 不使用全局星号替换、隐藏字符或渲染后 HTML 修补中文强调。
- 不裁剪长文、吞掉资源失败或把低分辨率回退当作成功导出。
- 不把工作台外框、工具提示、滚动条、选中轮廓或编辑器主题写入 PNG。
