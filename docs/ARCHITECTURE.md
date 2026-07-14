# 架构文档

## 目录结构

```
types.ts                    # 全局类型：EventItem, TodoItem, TodoTreeNode 等
app/
  layout.tsx                # 根布局：lang="zh-CN"
  globals.css               # 全部样式（CSS 变量 + 手写类，~1900 行）
  page.tsx                  # 首页：时间轴、待办树、搜索、今日记录
  calendar/page.tsx         # 日历页：按天查看 + 添加日程
components/
  day-timeline.tsx          # 横向时间轴（缩放、虚拟化、拖拽平移）
  diary-timeline.tsx        # 文字日记时间轴
  search-panel.tsx          # 搜索结果
  todo-tree.tsx             # 递归待办树
  work-record-panel.tsx     # 工作记录编辑弹窗（含内联标签管理）
  task-form-panel.tsx       # 任务编辑弹窗
  settings-panel.tsx        # 云同步设置
  export-panel.tsx          # 导出 JSON/CSV
  tag-manager-panel.tsx     # 自定义标签管理面板
  help-icon.tsx             # 可复用 ⓘ 帮助图标
hooks/
  use-app-data.ts           # 共享 hook：数据加载、持久化、云同步
lib/
  storage.ts                # 副作用：LocalStorage、Gist API、迁移
  utils.ts                  # 纯函数：syncLinkedItems、树构建、格式化
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
SearchResult { id, kind("event"|"todo"), title, snippet, dateLabel, tags[] }
```

**关键约束**：Event ↔ Todo 通过 `linkedTodoIds` ↔ `linkedEventIds` 双向关联。任何修改关联的操作必须经过 `syncLinkedItems()` 保持两端一致。

## 数据流

### 读取

```
loadAndMigrateFromStorage() → 有数据 → useState 初始化
                              ↓ 无数据
                          返回空数组
                              ↓
                    syncLinkedItems(events, todos)
                              ↓
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
    filteredTodos          events            searchResults
          ↓
    buildTodoTree()
          ↓
    getTodayFocus()
          ↓
    组件渲染（所有派生计算通过 useMemo）
```

### 写回

```
用户操作 → setData() → syncLinkedItems() → useState 更新
                                              │
  useEffect（isInitialized 守卫） → saveEventsToStorage / saveTodosToStorage
                                              │
  useEffect（3s 防抖） → pushToCloud()（若已配置云同步）
```

**isInitialized 守卫**：防止首次渲染时覆盖 LocalStorage。`isInitialized` 在 `useEffect` 中设为 `true`，确保 hydration 完成前不写存储。

## 组件约定

- 所有组件以 `"use client"` 开头 — 静态导出无 SSR
- Props 类型定义在组件文件内，用 `type` 不用 `interface`
- **展示型组件**：纯展示 + 回调，状态集中在 `page.tsx`
- **模态弹窗组件**：自管理表单状态，通过 `onSave`/`onClose` 回调通信
- **派生数据**：全部用 `useMemo`

## CSS 规范

- 颜色/间距用 CSS 自定义属性：`var(--text)`, `var(--muted)`, `var(--border-color)` 等
- 类名语义化：`.line-timeline`, `.todo-card`, `.search-results-wrap`
- 内联 `style` 仅用于运行时动态值（位置、颜色变量），静态样式放 `globals.css`
- **禁止 Tailwind 或任何 CSS 框架**

## 工具函数分工

- `lib/utils.ts`：纯函数，无副作用，无 `window`/`document`/`localStorage`
- `lib/storage.ts`：有副作用函数 — `localStorage`、`FileReader`、`Blob`、`fetch`
- 日期格式化统一用 `Intl.DateTimeFormat("zh-CN", ...)`，不用 `moment`/`dayjs`

## 标签系统

- 预设标签：`["党建", "人事", "纪检", "编制", "档案", "外出", "会议", "其他"]`
- 交互：`.chip-button.chip-tag` 点击切换选中态
- 自定义标签：输入框 + 回车添加，内联 ✕ 删除
- 保存时合并预设 + 自定义为 `tags: string[]`，无标签默认 `["其他"]`
- 自定义标签存 LocalStorage + 云端同步

## 时间轴缩放系统

- **公式**：`visibleDays = BASE_VISIBLE_DAYS / scale`（BASE_VISIBLE_DAYS = 1）
- **范围**：scale 0.03（~33 天）到 24（~1 小时）
- **光标中心缩放**：RAF 批处理 + useLayoutEffect 同步 scrollLeft
- **视口虚拟化**：仅渲染可见范围 ±0.5 屏幕宽的元素（~300 DOM vs 原来 ~12K）
- **卡片定位**：水平偏移用 `transform: translateX()`（GPU Composite，不触发 Layout）
- **紧凑模式**：重叠超过阈值时卡片缩为 8px 色条
- **拖拽平移**：鼠标左键按住拖动

## 数据版本迁移

- `CURRENT_DATA_VERSION` 定义在 `storage.ts` 顶部
- `migrations[]` 数组存放各版本的转换函数
- 所有数据入口自动调用 `migrateData()`

**加字段流程**：
1. 在 `types.ts` 加字段（用 `?` 可选）
2. `CURRENT_DATA_VERSION` 加 1
3. 在 `migrations` 末尾追加迁移函数
4. 组件中做好 `undefined` 兜底（`??` 默认值）
