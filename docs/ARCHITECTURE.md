# 🏗 LittleJobHelper 系统架构文档

## 📐 整体架构

### 技术架构图

```
┌─────────────────────────────────────────────┐
│              Next.js App Router              │
│  (app/page.tsx, app/calendar/page.tsx)      │
──────────────┬──────────────────────────────┘
               │ 调用
┌──────────────▼──────────────────────────────┐
│          React Components Layer             │
│  components/day-timeline.tsx                │
│  components/diary-timeline.tsx              │
│  components/search-panel.tsx                │
│  components/todo-tree.tsx                   │
└──────────────┬──────────────────────────────┘
               │ 读取
┌──────────────▼──────────────────────────────┐
│           Data & Utils Layer                │
│  lib/sample-data.ts (模拟数据源)            │
│  lib/storage.ts (LocalStorage 持久化)       │
│  lib/utils.ts (工具函数)                    │
│  types.ts (TypeScript 类型定义)             │
└─────────────────────────────────────────────┘
```

### 部署架构图

```
开发环境                    生产环境
┌──────────────┐         ┌──────────────────────┐
│  Localhost   │         │  GitHub Pages        │
│  :10352      │         │  (静态托管)          │
│              │         │                      │
│ npm run dev  │         │ npm run build        │
│              │         │ ↓                    │
│              │         │ out/ (静态文件)      │
│              │         │ ↓                    │
│              │         │ GitHub Actions       │
│              │         │ ↓                    │
│              │         │ https://exfeitu.     │
│              │         │ github.io/           │
│              │         │ LittleJobHelper/     │
└──────────────┘         └──────────────────────┘
```

## 🔄 数据流设计

### 当前阶段(LocalStorage 持久化)

```
用户操作 → 组件状态更新 → setData() → LocalStorage
                ↑                          ↓
          UI 重新渲染 ←────────── 自动同步保存
                ↑
         lib/storage.ts (读写封装)
                ↑
         lib/sample-data.ts (初始化数据)
```

**特点**:
- ✅ 数据持久化到浏览器本地
- ✅ 支持 JSON 文件导入/导出备份
- ✅ 无需后端服务器
-  数据不跨设备同步
- ❌ 清除浏览器缓存会丢失数据

**存储键名**:
- `little-job-helper-events` - 事件数据
- `little-job-helper-todos` - 待办数据

### 未来阶段(Supabase 集成)

```
用户操作 → 组件状态更新 → Supabase API → PostgreSQL 数据库
                ↓                          ↓
          乐观更新 UI ←────────── 实时订阅推送
                ↓
          LocalStorage (离线缓存)
```

## 🧩 核心组件职责

### 1. 页面组件 (`app/`)

| 文件 | 路由 | 职责 |
|------|------|------|
| `app/page.tsx` | `/` | 主页:左侧导航 + 今日待办面板 + 多天时间轴 |
| `app/calendar/page.tsx` | `/calendar` | 日历视图:月历展示 + 日程标记 |
| `app/layout.tsx` | 全局 | 根布局:全局样式、元数据、Provider 包裹 |

**约束**:
- 含状态的组件必须声明 `"use client"`
- 禁止在页面组件中直接操作 DOM
- 所有业务逻辑下沉到 `lib/` 或自定义 Hook

### 2. UI 组件 (`components/`)

#### `day-timeline.tsx` - 天时间轴组件
- **输入**: `EventItem[]` (按日期过滤的事件列表)
- **输出**: 纵向时间轴可视化
- **特性**: 支持多级子任务展开/折叠

#### `diary-timeline.tsx` - 日记时间轴组件
- **输入**: `DiaryEntry[]` (日记条目列表)
- **输出**: 文字日记的 chronological 展示
- **特性**: 支持富文本渲染、图片预览

#### `search-panel.tsx` - 搜索面板组件
- **输入**: 搜索关键词、过滤条件
- **输出**: 搜索结果列表(Event/Todo/Diary 混合)
- **特性**: 实时搜索、高亮匹配文本

#### `todo-tree.tsx` - 待办树形列表组件
- **输入**: `TodoItem[]` (支持嵌套结构)
- **输出**: 可折叠的树形待办列表
- **特性**: 拖拽排序、批量操作、优先级标记

### 3. 工具层 (`lib/`)

#### `storage.ts` - 数据持久化层
```typescript
// 核心功能
export function loadEvents(): EventItem[]      // 从 LocalStorage 加载
export function saveEvents(events: EventItem[]) // 保存到 LocalStorage
export function exportData(): string            // 导出为 JSON
export function importData(json: string): void  // 从 JSON 导入
```

**特性**:
- 自动同步: 每次数据修改后自动保存
- 降级策略: LocalStorage 无数据时使用 sample-data.ts
- 备份支持: JSON 文件导入/导出

#### `sample-data.ts` - 模拟数据源
```typescript
export const sampleEvents: EventItem[] = [...]
export const sampleTodos: TodoItem[] = [...]
export const sampleDiaries: DiaryEntry[] = [...]
```

**用途**:
- 开发阶段提供完整测试数据
- 演示数据结构关系(Event ↔ Todo 双向引用)
- LocalStorage 为空时的初始化数据

#### `utils.ts` - 纯工具函数
```typescript
// 示例功能
export function formatDate(date: Date): string
export function syncLinkedItems(events: EventItem[], todos: TodoItem[]): void
export function filterByPriority<T extends { priority: Priority }>(items: T[], level: Priority): T[]
```

**约束**:
- 必须是纯函数(无副作用)
- 禁止直接修改传入参数
- 所有函数必须有明确返回类型

## 🔗 关键数据关系

### EventItem ↔ TodoItem 双向引用

```typescript
interface EventItem {
  id: string
  linkedTodoIds?: string[]  // 关联的 Todo ID 列表
  // ...
}

interface TodoItem {
  id: string
  linkedEventId?: string    // 关联的 Event ID
  steps?: TodoStep[]        // 任务步骤列表
  startTime?: string        // 起始时间
  // ...
}

interface TodoStep {
  id: string
  content: string
  completed: boolean
  scheduledTime?: string
}
```

**同步规则**:
1. 创建 Event 时若关联 Todo,需同时更新 `TodoItem.linkedEventId`
2. 删除 Todo 时需从所有 `EventItem.linkedTodoIds` 中移除该 ID
3. 调用 `syncLinkedItems()` 确保数据一致性
4. 任务步骤变更时自动保存到 LocalStorage

## 🎨 样式架构

### Tailwind CSS 使用规范

```tsx
// ✅ 推荐:直接在 className 中使用
<div className="flex items-center gap-2 p-4 bg-white rounded-lg shadow-sm">

//  禁止:硬编码 style 属性
<div style={{ display: 'flex', padding: '16px' }}>
```

### CSS Modules 使用场景

当需要复杂动画或伪类时:

```tsx
// components/day-timeline.module.css
.timelineItem {
  transition: all 0.3s ease;
}

.timelineItem:hover::before {
  content: '';
  position: absolute;
  /* ... */
}
```

## 🚀 性能优化策略

### 1. 组件级别
- 使用 `React.memo` 包裹纯展示组件
- 大列表使用虚拟滚动(待实现)
- 避免在 render 中创建新对象/数组

### 2. 数据级别
- 使用 `useMemo` 缓存过滤/排序结果
- 避免不必要的深拷贝
- 分页加载大数据集(待实现)

### 3. 路由级别
- Next.js 自动代码分割
- 动态导入重型组件:`const HeavyComponent = dynamic(() => import(...))`

### 4. 构建优化
- 静态导出: `output: 'export'` 生成纯静态文件
- 图片优化禁用: `images.unoptimized: true` (适配静态托管)
- Tree Shaking: 自动移除未使用的代码

##  未来扩展方向

### Phase 2: 云端同步
- [ ] 集成 Supabase Client
- [ ] 实现 CRUD API
- [ ] 多设备数据同步
- [ ] 离线优先策略

### Phase 3: 实时协作
- [ ] Supabase Realtime 订阅
- [ ] 多用户权限管理
- [ ] 冲突解决机制

### Phase 4: AI 增强
- [ ] 自然语言创建事件("明天下午3点开会")
- [ ] 智能任务分类建议
- [ ] 工作模式分析报表

---

**最后更新**: 2026-05-27  
**维护者**: LittleJobHelper 团队  
**在线演示**: https://exfeitu.github.io/LittleJobHelper/
