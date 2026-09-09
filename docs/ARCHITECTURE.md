# 架构文档

## 目录结构

```
types.ts                    # 全局类型：EventItem, TodoItem, TodoTreeNode 等
app/
  layout.tsx                # 根布局：lang="zh-CN"、ErrorBoundary
  globals.css               # 样式入口：@import styles/ 模块 + 新增功能样式
  page.tsx                  # 首页：时间轴、待办树、搜索、今日记录、统计
  calendar/page.tsx         # 日历页：按天查看 + 添加日程
  memo/page.tsx             # 备忘录页：复盘心得 + 周期备忘
styles/                     # CSS 按功能模块拆分（顺序即级联顺序）
  variables.css             # 根变量、基础元素、滚动条、body
  layout.css                # 页面骨架、header、面板、通用布局
  timeline.css              # 横向时间轴
  components.css            # 日记、标签、搜索、待办、日历、响应式
  modal.css                 # 模态弹窗、各面板、按钮
components/
  app-header.tsx            # 三页共用顶部导航栏（含同步状态指示）
  day-timeline.tsx          # 横向时间轴（缩放、虚拟化、拖拽、密度自适应）
  diary-timeline.tsx        # 文字日记时间轴
  search-panel.tsx          # 搜索结果（命中高亮）
  todo-tree.tsx             # 递归待办树（紧凑摘要、详情展开、批量选择）
  archived-todos-panel.tsx  # 已完成/已取消待办归档与恢复
  memo-list.tsx             # 备忘录列表
  memo-form-panel.tsx       # 备忘录编辑弹窗
  memo-detail-panel.tsx     # 备忘录详情与 checklist 勾选
  memo-steps-editor.tsx     # 周期备忘步骤编辑器
  rich-text-editor.tsx      # 复盘心得富文本编辑器
  work-record-panel.tsx     # 工作记录编辑弹窗（含内联标签管理）
  task-form-panel.tsx       # 任务编辑弹窗（含子步骤编辑）
  settings-panel.tsx        # 云同步设置
  export-panel.tsx          # 导出 JSON/CSV + 导入 JSON
  backup-reminder.tsx       # 周一/周五首开"记得备份"气泡
  stats-dashboard.tsx       # 数据统计概览
  help-icon.tsx             # 可复用 ⓘ 帮助图标
  error-boundary.tsx        # 顶层错误边界
hooks/
  use-app-data.ts           # 共享 hook：数据加载、持久化、云同步、撤销
  use-keyboard-shortcuts.ts # 全局键盘快捷键
  use-focus-trap.ts         # 模态弹窗焦点锁定
  use-backup-reminder.ts    # 备份提醒（周一周五首开去重）
lib/
  storage.ts                # 存储层统一出口（re-export）
  storage-migrate.ts        # 数据版本迁移系统
  storage-local.ts          # LocalStorage、自定义标签、JSON 导入导出
  storage-gist.ts           # Gist 云同步、同步状态
  utils.ts                  # 纯函数：syncLinkedItems、树构建、格式化、拼音、genId
  timeline-layout.ts        # 时间轴纯布局逻辑（密度降级、聚合、二维装箱、lane/周聚合）
  memo.ts                   # 备忘录纯函数（正文转文本、搜索、排序、进度）
  constants.ts              # 共享常量（BASE_TAGS）
  sample-data.ts            # 示例数据（当前未使用，保留作参考）
```

## 核心类型 (`types.ts`)

```typescript
EventItem {
  id, startTime, endTime, title, detail?, tags[], linkedTodoIds?[], updatedAt
}
TodoItem {
  id, title, startTime?, dueDate?, priority(high|medium|low),
  status(pending|in_progress|completed|cancelled), tags[],
  department?, contactPerson?, remarks?, parentId|null,
  pinnedToToday?, linkedEventIds?[], steps?[], updatedAt
}
TodoTreeNode extends TodoItem { children[], computedStatus }
TodoStep { id, content, completed, scheduledTime? }
MemoItem { id, type("note"|"checklist"), title, tags[], date?, content?, steps?[], createdAt, updatedAt }
MemoStep { id, content, completed, isWarning? }
SearchResult { id, kind("event"|"todo"|"memo"), title, snippet, dateLabel, tags[] }
```

**关键约束**：Event ↔ Todo 通过 `linkedTodoIds` ↔ `linkedEventIds` 双向关联。任何修改关联的操作必须经过 `syncLinkedItems()` 保持两端一致。Memo 独立于 Event/Todo 关联模型，但与它们共用标签、LocalStorage、导入导出和 Gist 云同步。

## 数据流

### 读取

```
loadAndMigrateFromStorage() → 有数据 → useState 初始化
                              ↓ 无数据
                          返回空数组
                              ↓
                    syncLinkedItems(events, todos)
                              ↓
          ┌───────────────────┼───────────────────┬───────────────────┐
          ↓                   ↓                   ↓                   ↓
    filteredTodos          events              memos          allSearchItems(含拼音)
          ↓                   ↓                   ↓                   ↓
    buildTodoTree()     todayRecords       sort/filter        searchResults(过滤)
          ↓
    getTodayFocus()
          ↓
    组件渲染（主要派生计算通过 useMemo）
```

### 写回

```
Event/Todo 操作 → setData()（记录撤销历史）→ syncLinkedItems() → useState 更新
                                                     │
Memo 操作 → setMemos()（独立撤销历史）───────────────┤
                                                     ↓
  useEffect（isInitialized 守卫） → 保存 events / todos / memos / customTags 到 LocalStorage
                                                     │
  useEffect（3s 防抖，离线跳过） → pushToCloud(events, todos, customTags, memos)
```

**isInitialized 守卫**：防止首次渲染时覆盖 LocalStorage。`isInitialized` 在 `useEffect` 中设为 `true`，确保 hydration 完成前不写存储。

**撤销**：`use-app-data.ts` 为 Event/Todo 和 Memo 维护两套独立历史栈，分别通过 `setData`/`undo` 与 `setMemos`/`undoMemos` 操作；每套上限 20 步。

## 存储层（lib/storage-*）

| 模块 | 职责 |
|------|------|
| `storage-migrate.ts` | `CURRENT_DATA_VERSION`、`migrateData`、`parseVersion`、`migrations[]`（纯函数） |
| `storage-local.ts` | Event/Todo/Memo LocalStorage 读写、版本号、自定义标签、JSON 导入导出（含结构校验） |
| `storage-gist.ts` | Gist API、Event/Todo/Memo ID 级合并、`initCloudSync`/`pushToCloud`/`pullAndMerge`、同步状态订阅 |
| `storage.ts` | 统一 re-export，既有调用方无感 |

**模块级同步状态**：`syncStatus` / `syncError` / `lastSyncAt` 存在 `storage-gist.ts`，通过 `onSyncChange()` 订阅广播（`use-app-data` 和设置面板都会监听）。

## 组件约定

- 所有组件以 `"use client"` 开头 — 静态导出无 SSR
- Props 类型定义在组件文件内，用 `type` 不用 `interface`
- **展示型组件**：纯展示 + 回调；共享数据状态集中在 `useAppData()`，页面级 UI 状态留在各自 `page.tsx`
- **模态弹窗组件**：自管理表单状态，通过 `onSave`/`onClose` 回调通信；带 `role="dialog"` + `useFocusTrap`
- **派生数据**：全部用 `useMemo`

## CSS 规范

- 颜色/间距用 CSS 自定义属性：`var(--text)`, `var(--muted)`, `var(--border-color)` 等
- 类名语义化：`.line-timeline`, `.todo-card`, `.search-results-wrap`
- 内联 `style` 仅用于运行时动态值（位置、颜色变量），静态样式放 CSS
- **禁止 Tailwind 或任何 CSS 框架**
- 样式按模块拆分到 `styles/`，`globals.css` 仅做 `@import`（顺序即级联顺序，新增模块追加在末尾）+ 少量新增样式
## 工具函数分工

- `lib/utils.ts`：纯函数，无副作用（`syncLinkedItems`、`buildTodoTree`、格式化、拼音、`genId`）
- `lib/timeline-layout.ts`：时间轴纯布局逻辑（可单测）
- `lib/storage-*.ts`：有副作用（`localStorage`、`fetch`、`FileReader`、`Blob`）
- 日期格式化统一用 `Intl.DateTimeFormat("zh-CN", ...)`，不用 `moment`/`dayjs`

## 标签系统

- 预设标签：`lib/constants.ts` 的 `BASE_TAGS` = `["党建", "人事", "纪检", "编制", "档案", "外出", "会议", "其他"]`
- 交互：`.chip-button.chip-tag` 点击切换选中态
- 自定义标签：在新建/编辑工作记录或任务的弹窗内联管理（输入框 + 回车添加，内联 ✕ 删除）
- 保存时合并预设 + 自定义为 `tags: string[]`，无标签默认 `["其他"]`
- 自定义标签存 LocalStorage + 云端同步

## 时间轴缩放与密度自适应

- **公式**：`visibleDays = BASE_VISIBLE_DAYS / scale`（BASE_VISIBLE_DAYS = 1）
- **范围**：scale 0.03（~33 天）到 24（~1 小时）
- **密度分级**：`visibleDays <= 2` 为 low，`<= 10` 为 medium，`> 10` 为 high
- **优先级降级**：高优先级待办保留 full；中优先级使用 compact；低优先级在 medium 按日、high 按周聚合为 marker
- **真实时间锚点**：轴上菱形/圆点不移动；卡片可围绕锚点向左、居中或向右展开
- **二维装箱**：重要条目优先放置，在轴线上/下和不同离轴距离中寻找不重叠位置
- **光标中心缩放**：RAF 批处理 + useLayoutEffect 同步 scrollLeft
- **视口虚拟化**：仅渲染可见范围 ±0.5 屏幕宽的元素
- **拖拽平移**：鼠标左键按住拖动
- **布局逻辑**：`lib/timeline-layout.ts` 保持纯函数，覆盖密度、聚合、lane、二维装箱与周计数，便于单测

## 数据版本迁移

- `CURRENT_DATA_VERSION` 定义在 `lib/storage-migrate.ts` 顶部
- `migrations[]` 数组存放各版本的转换函数
- 所有数据入口自动调用 `migrateData()`

**加字段流程**：
1. 在 `types.ts` 加字段（用 `?` 可选）
2. `CURRENT_DATA_VERSION` 加 1
3. 在 `migrations` 末尾追加迁移函数
4. 组件中做好 `undefined` 兜底（`??` 默认值）

## 质量保障

- `npm run build`：类型检查 + 静态导出
- `npm run lint`：ESLint 9 + `eslint-config-next`（关闭 React Compiler 专属规则）
- `npm test`：Vitest 单元测试（纯函数 + buildCsv）
- `npm run test:e2e`：Playwright 冒烟测试（需先 `npx playwright install chromium`）
- CI（deploy.yml）：lint → test → build → 部署
