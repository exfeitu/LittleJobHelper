# AGENTS.md — Little Job Helper

## 项目身份

体制内人事科办公助手：单人使用的浏览器端工作回溯 + 待办管理工具。核心能力：精确到秒的时间轴记录、多级任务树、跨事件与待办的全局搜索。

## 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 16 (App Router) | `output: 'export'` 静态导出 |
| 语言 | TypeScript 5.8 | strict 模式 |
| 样式 | 手写 CSS | `globals.css`，约 1055 行，CSS 自定义属性 |
| 存储 | 浏览器 LocalStorage | 两个 key，无数据库 |
| 部署 | GitHub Pages | `.github/workflows/deploy.yml` |
| 包管理 | npm | `package-lock.json` |
| Lint | ESLint 8 | `next/core-web-vitals` |

**本项目没有**：数据库、后端服务、用户认证、CSS 框架（无 Tailwind）、组件库（无 MUI/Ant Design）、自动化测试（无 Jest/Vitest）、SSR、API Routes、Middleware。

> 没有的东西和有的东西同等重要。不要擅自引入上述任何一项。

## 配置文件速览

| 文件 | 关键约束 |
|---|---|
| `next.config.mjs` | `output: 'export'` → 禁用 SSR/API Routes/Middleware/Image Optimization |
| `tsconfig.json` | `strict: true`，路径别名 `@/*` 映射到项目根目录 |
| `.eslintrc.json` | 继承 `next/core-web-vitals` |
| `.github/workflows/deploy.yml` | push `master` → 构建 → 部署 GitHub Pages |
| `package.json` | 开发端口 `10352`（`next dev -p 10352`） |

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # localhost:10352（端口在 package.json 中硬编码）
npm run build        # 静态导出到 out/
npm run lint         # ESLint
```

## 目录结构

```
.eslintrc.json              # ESLint 配置
next.config.mjs             # Next.js 配置（静态导出 + 图片不优化）
tsconfig.json               # TypeScript 配置（strict，路径别名 @/*）
types.ts                    # 全局类型：EventItem, TodoItem, TodoTreeNode 等
app/
  layout.tsx                # 根布局：lang="zh-CN"，导入 globals.css
  globals.css               # 全部样式（CSS 变量 + 手写类，无 Tailwind）
  page.tsx                  # 首页（"use client"）：数据管理、今日待办、时间轴、日记、待办树、搜索
  calendar/
    page.tsx                # 日历页（"use client"）：按天查看日程/待办 + 添加日程表单
components/
  day-timeline.tsx          # 多天纵向时间轴（缩放 0.32x~5.2x、左右避让、紧凑卡片）
  diary-timeline.tsx        # 文字日记时间轴（按时间段展示工作记录）
  search-panel.tsx          # 搜索结果面板（类型筛选项 + 关键词匹配）
  todo-tree.tsx             # 递归待办树（status 状态提升、step 进度展示）
lib/
  storage.ts                # 副作用函数：LocalStorage 读写、JSON 文件导入/导出
  utils.ts                  # 纯函数：双向关联同步、树构建、排序、格式化
  sample-data.ts            # 开发用示例数据（11 事件 + 7 待办），仅当 LocalStorage 为空时使用
.github/workflows/
  deploy.yml                # CI/CD：checkout → npm ci → npm run build → deploy-pages
```

## 核心类型

所有类型定义在 `types.ts`，是项目的数据契约。

```typescript
EventItem {
  id: string; startTime: string; endTime: string; title: string;
  detail?: string; tags: string[]; linkedTodoIds?: string[];
}
TodoItem {
  id: string; title: string; startTime?: string; dueDate?: string;
  priority: "high" | "medium" | "low"; status: "pending" | "in_progress" | "completed" | "cancelled";
  tags: string[]; department?: string; contactPerson?: string; remarks?: string;
  parentId: string | null; pinnedToToday?: boolean;
  linkedEventIds?: string[]; steps?: TodoStep[];
}
TodoTreeNode extends TodoItem { children: TodoTreeNode[]; computedStatus: TodoStatus }
TodoStep { id: string; content: string; completed: boolean; scheduledTime?: string }
SearchResult { id: string; kind: "event" | "todo"; title: string; snippet: string; dateLabel: string; tags: string[] }
```

**关键约束**：Event ↔ Todo 通过 `linkedTodoIds` ↔ `linkedEventIds` 双向关联。任何修改关联关系的操作都必须经过 `syncLinkedItems()`（位于 `lib/utils.ts`）来保持两端一致，否则会出现悬空引用。

## 架构模式

### 数据流（读 + 写）

```
读取：
  LocalStorage.getItem() ──有数据──→ useState 初始化
         │                                  │
          └──无数据──→ sample-data.ts ──────┘
                              │
                    syncLinkedItems(events, todos)   ← 双向关联同步
                              │
                    ┌─────────┼──────────┐
                    ↓         ↓          ↓
              filteredTodos  events   searchResults
                    ↓
              buildTodoTree()
                    ↓
              getTodayFocus()
                    ↓
              组件渲染（所有派生计算通过 useMemo）

写回：
  用户操作 → setData() → syncLinkedItems() → useState 更新
                                              │
  useEffect（isInitialized 守卫为 true 时）→ LocalStorage.setItem()
```

**isInitialized 守卫的作用**：防止组件首次挂载时将 sample data 覆盖进 LocalStorage。在 `isInitialized` 变为 `true` 之前，useEffect 不会执行写回。

### 组件约定

- 所有组件文件以 `"use client"` 开头 — 因为静态导出无 SSR，服务端渲染没有意义
- 组件 Props 类型定义在组件文件内部（不放入 `types.ts`），用 `type` 而非 `interface`
- 状态集中在 `page.tsx` 管理，子组件纯展示 + 回调 — 原因：数据变更需要统一经过 `syncLinkedItems` + 写回 LocalStorage
- 派生数据全部用 `useMemo` — 避免每次渲染重新构建树、排序、过滤

### CSS 约定

- 颜色/间距等令牌使用 CSS 自定义属性：`var(--text)`, `var(--muted)`, `var(--border-color)` 等，定义在 `globals.css` 的 `:root` 中
- 类名语义化：`.line-timeline`, `.todo-card`, `.search-results-wrap`
- 内联 `style` 仅用于运行时动态值（位置 `top`、颜色 `--event-color` 等），静态样式一律放 `globals.css`
- **禁止引入 Tailwind 或任何 CSS 框架** — 原因：已有 1055 行手写 CSS，混用会破坏一致性

### 工具函数约定

- `lib/utils.ts` 必须是纯函数 — 无副作用、无 `window`/`document` 访问、无 `localStorage`。便于测试和复用。
- `lib/storage.ts` 存放有副作用的函数 — `localStorage`、`FileReader`、`Blob`、`URL.createObjectURL`
- 日期格式化统一用 `Intl.DateTimeFormat("zh-CN", ...)`，不引入 `moment`/`dayjs`

## 禁止事项

| # | 禁令 | 原因 |
|---|---|---|
| 1 | **不要引入任何 CSS 框架**（Tailwind、styled-components 等） | 项目已有完整的手写 CSS 体系，混用导致不可维护 |
| 2 | **不要使用 SSR / API Routes / Middleware / Image Optimization** | `next.config.mjs` 设置了 `output: 'export'`，这些特性在静态导出下不可用 |
| 3 | **不要添加数据库或后端依赖**（Supabase、Prisma 等） | 当前架构为纯前端 + LocalStorage，引入后端需要整体重构 |
| 4 | **不要修改 `types.ts` 中已有字段的类型或语义** | 这是数据契约，修改会导致 LocalStorage 中的历史数据不兼容 |
| 5 | **不要修改 `package.json` 中的 `dev` 端口（10352）** | 端口已固定，改动会影响团队开发习惯 |
| 6 | **不要修改 `next.config.mjs` 中的 `output` 配置** | 改为非静态模式会导致 GitHub Pages 部署失败 |
| 7 | **不要直接操作 LocalStorage 读写数据** | 必须通过 `lib/storage.ts` 中的函数，以保证 key 名一致和异常处理 |
| 8 | **不要在组件中直接修改 events/todos 数组** | 必须通过 `setData()` + `syncLinkedItems()`，否则双向关联会断裂 |
| 9 | **不要引入新的第三方依赖**（npm install） | 需评估是否与静态导出的束体积限制冲突，且当前依赖集已足够覆盖需求 |
| 10 | **不要引入测试框架或写测试文件** | 项目目前无测试体系，单独加测试文件不会被 CI 运行，反而造成维护负担 |

## 常见改动模式

### 1. 给 EventItem 或 TodoItem 加字段

1. 在 `types.ts` 中加字段（可选字段用 `?`）
2. 在 `lib/sample-data.ts` 中给示例数据补充该字段
3. 在用到该类型的组件中处理新字段的展示
4. **容易遗漏**：`lib/utils.ts` 的 `exportRows()` 函数需要在导出映射中加上新字段
5. **容易遗漏**：`lib/storage.ts` 的 `importDataFromFile()` 不做字段校验，旧数据导入时新字段为 `undefined`，组件代码需要做好空值兜底

### 2. 新增一个页面

1. 在 `app/` 下创建目录 + `page.tsx`（必须以 `"use client"` 开头）
2. 在 `app/page.tsx` 的导航区加 `<Link>` 入口
3. **不要**创建 `layout.tsx`（除非该路由有独立的布局需求）
4. **不要**使用 `generateStaticParams` 或 `generateMetadata` — 静态导出下动态路由不适用

### 3. 新增一个组件

1. 在 `components/` 下创建文件，以 `"use client"` 开头
2. Props 类型定义在组件文件内
3. 样式加在 `app/globals.css` 中
4. **不要**为组件创建独立 CSS 文件 — 所有样式集中在 `globals.css`

### 4. 修改数据后需要同步双向关联

1. 修改 events 或 todos 后，必须调用 `syncLinkedItems(nextEvents, nextTodos)`
2. 新创建的 TodoItem 如果关联了 Event，需要同时更新对应 Event 的 `linkedTodoIds`
3. **参考实现**：`app/page.tsx` 中的 `handleAddTask()` 函数

### 5. 修改 LocalStorage 数据结构

1. 先在 `types.ts` 中改类型
2. 在 `lib/storage.ts` 中加版本检测或迁移逻辑
3. **不要**直接改 LocalStorage key 名 — 会导致用户历史数据丢失
4. **注意**：`importDataFromFile()` 验证只检查 `events` 和 `todos` 字段存在，不校验字段完整性

## 部署

- 触发条件：push 到 `master` 分支 或 手动触发 `workflow_dispatch`
- 构建流程：`npm ci` → `npm run build`（产出 `out/`） → `upload-pages-artifact` → `deploy-pages`
- 约束来源：`next.config.mjs` 的 `output: 'export'` 决定了构建产物是完全静态的
- **这意味着**：没有服务端运行时、不能用动态路由参数、图片必须设为 `unoptimized: true`
- 配置文件：`.github/workflows/deploy.yml`

## 当前状态

以下功能**已完成**，修改时需保持兼容：

- 多天纵向时间轴（缩放、左右避让、紧凑卡片、hover 展开）
- 多级待办树（status 提升、step 进度、部门/联系人/备注字段）
- Event ↔ Todo 双向关联
- 文字日记视图
- 全局搜索（关键词匹配 + 类型筛选）
- 日历视图（按天查看日程/待办）
- LocalStorage 自动持久化
- JSON 文件导入/导出
- GitHub Pages 自动部署

以下功能**明确不实现**，不要主动补全：

- 数据库接入（Supabase 等）— 暂不实现
- 用户登录/认证 — 暂不实现
- Excel 真正导出 — 暂不实现
- iOS/Android App — 暂不实现
- 编辑/删除/状态变更 UI — 暂不实现（添加已有，其余 CRUD 操作尚未开始）
