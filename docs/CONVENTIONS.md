# 📝 LittleJobHelper 编码规范

## 🎯 核心原则

1. **类型安全优先**: 所有代码必须通过 TypeScript 严格模式检查
2. **组件纯度**: UI 组件不应包含业务逻辑,仅负责渲染
3. **数据不可变**: 禁止直接修改 state/props,使用 immutable 更新模式
4. **语义化命名**: 变量/函数名应清晰表达意图,避免缩写

---

## 📦 TypeScript 规范

### 1. 类型定义

#### ✅ 推荐做法

```typescript
// types.ts - 集中定义
export interface EventItem {
  id: string
  title: string
  date: Date
  linkedTodoIds?: string[]
  priority: Priority
}

export type Priority = 'high' | 'medium' | 'low'

// 组件中使用
const MyComponent: React.FC<{ events: EventItem[] }> = ({ events }) => {
  // ...
}
```

#### ❌ 禁止做法

```typescript
// 使用 any 绕过类型检查
const data: any = fetchData()

// 内联复杂类型(降低可读性)
const Component: React.FC<{ items: Array<{ id: string; name: string }> }> = ...
```

### 2. 泛型使用

```typescript
// ✅ 工具函数使用泛型提高复用性
export function filterByPriority<T extends { priority: Priority }>(
  items: T[],
  level: Priority
): T[] {
  return items.filter(item => item.priority === level)
}

// ❌ 为每个类型写重复函数
export function filterEventsByPriority(events: EventItem[], level: Priority): EventItem[]
export function filterTodosByPriority(todos: TodoItem[], level: Priority): TodoItem[]
```

### 3. 可选链与空值合并

```typescript
// ✅ 安全访问嵌套属性
const eventId = event?.linkedTodoIds?.[0] ?? 'default-id'

// ❌ 冗长的条件判断
const eventId = event && event.linkedTodoIds && event.linkedTodoIds[0] ? event.linkedTodoIds[0] : 'default-id'
```

---

## ⚛️ React 组件规范

### 1. 组件结构

```tsx
'use client'  // 如需使用状态/事件

import { useState, useMemo } from 'react'
import { EventItem } from '@/types'
import { formatDate } from '@/lib/utils'

// 1️⃣ 类型定义(若为局部类型)
interface DayTimelineProps {
  events: EventItem[]
  onEventClick?: (event: EventItem) => void
}

// 2️⃣ 组件声明
export default function DayTimeline({ events, onEventClick }: DayTimelineProps) {
  // 3️⃣ State 声明
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 4️⃣ Memo 计算
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events])

  // 5️⃣ 事件处理函数
  const handleToggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 6️⃣ 渲染逻辑
  return (
    <div className="day-timeline">
      {sortedEvents.length === 0 ? (
        <p className="empty-note">暂无日程</p>
      ) : (
        sortedEvents.map(event => (
          <EventCard
            key={event.id}
            event={event}
            isExpanded={expandedIds.has(event.id)}
            onToggle={() => handleToggle(event.id)}
            onClick={() => onEventClick?.(event)}
          />
        ))
      )}
    </div>
  )
}
```

### 2. Props 传递规范

```tsx
// ✅ 解构 props,明确声明默认值
function TodoItem({ 
  title, 
  priority = 'medium', 
  completed = false,
  onComplete 
}: TodoItemProps) {
  // ...
}

// ❌ 直接传递整个 props 对象
function TodoItem(props: TodoItemProps) {
  const title = props.title  // 冗余
}
```

### 3. 条件渲染

```tsx
// ✅ 三元表达式(简单条件)
{isLoading ? <Spinner /> : <Content />}

// ✅ 短路求值(可选渲染)
{showDetails && <DetailsPanel />}

// ❌ 避免在 JSX 中使用 if-else
{
  if (isLoading) {
    return <Spinner />
  }
  return <Content />
}
```

---

## 🎨 样式规范

### 1. Tailwind CSS 优先级

```tsx
// ✅ 按布局 → 尺寸 → 间距 → 视觉 的顺序排列类名
<div className="
  flex items-center gap-2        /* 布局 */
  w-full h-12                    /* 尺寸 */
  p-4 mx-2 my-1                  /* 间距 */
  bg-white rounded-lg shadow-sm  /* 视觉 */
  hover:bg-gray-50 transition    /* 交互 */
">
```

### 2. 响应式设计

```tsx
// ✅ 移动优先,从小到大断点
<div className="
  grid grid-cols-1              /* 移动端:单列 */
  md:grid-cols-2                /* 平板:双列 */
  lg:grid-cols-3                /* 桌面:三列 */
">
```

### 3. 自定义类名(仅当 Tailwind 无法满足时)

```css
/* components/day-timeline.module.css */
.timelineContainer {
  @apply relative overflow-hidden;
  scroll-behavior: smooth;
}

/* ❌ 禁止全局样式污染 */
.day-timeline div {  /* 影响所有子元素 */
  margin: 0;
}
```

---

## 🔧 工具函数规范

### 1. 纯函数原则

```typescript
// ✅ 纯函数:相同输入永远得到相同输出
export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// ❌ 含副作用的函数
export function logAndFormat(date: Date): string {
  console.log(date)  // 副作用
  return formatDate(date)
}
```

### 2. 日期处理(统一使用 date-fns)

```typescript
import { format, parseISO, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// ✅ 格式化
export function formatChineseDate(date: Date): string {
  return format(date, 'yyyy年MM月dd日', { locale: zhCN })
}

// ❌ 硬拼日期字符串
const dateString = `${year}-${month}-${day}T00:00:00`
```

### 3. 数据同步函数

```typescript
// lib/utils.ts
export function syncLinkedItems(
  events: EventItem[],
  todos: TodoItem[]
): { events: EventItem[]; todos: TodoItem[] } {
  // 返回新数组,不修改原数据
  const syncedEvents = events.map(event => {
    // ...同步逻辑
    return { ...event, linkedTodoIds: updatedIds }
  })
  
  return { events: syncedEvents, todos: syncedTodos }
}
```

---

## 📝 注释规范

### 1. JSDoc 注释(公共 API)

```typescript
/**
 * 过滤指定优先级的项目
 * @param items - 待过滤的项目列表
 * @param level - 目标优先级
 * @returns 过滤后的新数组
 * @example
 * ```ts
 * const highPriority = filterByPriority(events, 'high')
 * ```
 */
export function filterByPriority<T extends { priority: Priority }>(
  items: T[],
  level: Priority
): T[] {
  return items.filter(item => item.priority === level)
}
```

### 2. 行内注释(解释"为什么"而非"是什么")

```tsx
// ✅ 解释业务逻辑
const sortedEvents = useMemo(() => {
  // 按时间升序排列,确保时间轴从早到晚显示
  return [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
}, [events])

// ❌ 冗余注释(代码已自解释)
const sortedEvents = useMemo(() => {
  // 排序事件
  return [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
}, [events])
```

### 3. TODO 注释格式

```typescript
// TODO(exfeitu): 接入 Supabase 实时订阅 - 2026-06-01
// FIXME: 修复跨天事件显示错误 #123
// NOTE: 此处使用浅拷贝因为嵌套结构不会变化
```

---

## 🧪 测试规范(待实现)

### 1. 单元测试结构

```typescript
// __tests__/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatDate, syncLinkedItems } from '@/lib/utils'

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2026-05-27')
    expect(formatDate(date)).toBe('2026-05-27')
  })
})
```

### 2. 组件测试

```typescript
// __tests__/DayTimeline.test.tsx
import { render, screen } from '@testing-library/react'
import DayTimeline from '@/components/day-timeline'

describe('DayTimeline', () => {
  it('should show empty note when no events', () => {
    render(<DayTimeline events={[]} />)
    expect(screen.getByText('暂无日程')).toBeInTheDocument()
  })
})
```

---

## 🚫 禁止事项清单

| 规则 | 说明 | 后果 |
|------|------|------|
| 禁止使用 `any` | 必须声明明确类型 | ESLint 报错 |
| 禁止直接修改 state | 使用 setState 或 immer | 视图不更新 |
| 禁止在 render 中执行副作用 | 使用 useEffect | 无限循环 |
| 禁止硬编码魔法数字 | 提取为常量 | 可维护性差 |
| 禁止全局 CSS | 使用 Tailwind 或 CSS Modules | 样式冲突 |
| 禁止跳过类型检查 | `// @ts-ignore` 需附理由 | 隐藏潜在 bug |

---

**最后更新**: 2026-05-27  
**维护者**: LittleJobHelper 团队
