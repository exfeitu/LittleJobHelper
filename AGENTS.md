# AGENTS.md — Little Job Helper

体制内人事科办公助手：单人浏览器端工具，Next.js 16 静态导出 + GitHub Pages 部署。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16 (App Router)，`output: 'export'` |
| 语言 | TypeScript 5.8，strict 模式 |
| 样式 | 手写 CSS，`globals.css`，无框架 |
| 存储 | LocalStorage + GitHub Gist 云同步（纯 fetch） |
| 部署 | GitHub Pages（`.github/workflows/deploy.yml`） |

**本项目没有**：数据库、后端、SSR、API Routes、Tailwind、组件库、测试框架、新 npm 依赖。

> 没有的东西和有的东西同等重要。不要擅自引入。

## 常用命令

```bash
npm run dev     # localhost:10352
npm run build   # 静态导出到 out/
npm run lint    # ESLint
```

## 硬约束

| # | 禁令 | 原因 |
|---|---|---|
| 1 | 不引入 CSS 框架 / 组件库 | 已有完整手写体系 |
| 2 | 不用 SSR / API Routes / Middleware | `output: 'export'` 不支持 |
| 3 | 不加数据库或后端依赖 | Gist API 已覆蓋 |
| 4 | 不改 `types.ts` 已有字段 | 破坏数据兼容，改字段必须加 migration |
| 5 | 不改 `dev` 端口（10352） | 硬编码约定 |
| 6 | 不改 `next.config.mjs` 的 `output` | 会导致部署失败 |
| 7 | 不直接操作 LocalStorage | 必须通过 `lib/storage.ts` |
| 8 | 不在组件中直接修改 events/todos 数组 | 必须经 `setData()` + `syncLinkedItems()` |
| 9 | 直接执行任务不提供确认框 | 保持高效开发 |
| 10 | 不引入测试框架 | 当前无测试体系 |

## 关键文件速查

| 文件 | 职责 |
|---|---|
| `types.ts` | 数据契约，所有类型定义 |
| `app/page.tsx` | 首页，状态中心，使用 `useAppData()` hook |
| `app/calendar/page.tsx` | 日历页，共享 `useAppData()` hook |
| `components/day-timeline.tsx` | 横向时间轴（缩放、虚拟化、拖拽） |
| `lib/storage.ts` | 所有副作用：LocalStorage、Gist API、迁移 |
| `lib/utils.ts` | 纯函数：`syncLinkedItems`、树构建、格式化 |
| `hooks/use-app-data.ts` | 共享 hook：数据加载、持久化、云同步 |

## 详细文档

- `docs/ARCHITECTURE.md` — 完整架构：数据流、组件约定、CSS 规范、标签系统、时间轴系统、版本迁移
- `docs/PATTERNS.md` — 常见改动模式：加字段、加页面、加组件、加弹窗、改存储结构
- `docs/AI-DEVELOPMENT.md` — AI 辅助开发方法论和流程
- `README.md` — 用户文档
