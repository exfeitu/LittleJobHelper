"use client";
import type { EventItem, TodoItem } from "@/types";
import { PRIORITY_COLORS, PRIORITY_LABEL, STATUS_LABEL, eventInterval } from "@/lib/timeline-adaptive";
export type TimelineSelection = { kind: "todo" | "event"; id: string } | null;
type Props = {
  selection: TimelineSelection; todos: TodoItem[]; events: EventItem[];
  onEditTodo?: (todo: TodoItem) => void; onEditEvent?: (event: EventItem) => void;
  onSelect: (selection: TimelineSelection) => void;
};
const dateTime = (value?: string) => value && Number.isFinite(+new Date(value))
  ? new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "未设置";
export function TimelineDetailPanel({ selection, todos, events, onEditTodo, onEditEvent, onSelect }: Props) {
  const todo = selection?.kind === "todo" ? todos.find(t => t.id === selection.id) : undefined;
  const event = selection?.kind === "event" ? events.find(e => e.id === selection.id) : undefined;
  const entity = todo ?? event;
  if (!entity) return <aside className="at-detail at-detail-empty" aria-label="时间轴详情"><strong>选择一个待办或工作记录</strong><p>先查看详情，再按需编辑。</p></aside>;
  const interval = event ? eventInterval(event) : null;
  const linked = todo
    ? events.filter(e => todo.linkedEventIds?.includes(e.id) || e.linkedTodoIds?.includes(todo.id))
    : todos.filter(t => event!.linkedTodoIds?.includes(t.id) || t.linkedEventIds?.includes(event!.id));
  return <aside className="at-detail" aria-label="时间轴详情">
    <header><span>{todo ? "待办任务" : "工作记录"}</span><button type="button" onClick={() => onSelect(null)} aria-label="关闭详情">×</button></header>
    <h3>{entity.title}</h3>
    <dl>
      {todo ? <>
        <dt>安排时间</dt><dd>{dateTime(todo.startTime)}</dd>
        <dt>截止时间</dt><dd>{dateTime(todo.dueDate)}</dd>
        <dt>优先级</dt><dd style={{ color: PRIORITY_COLORS[todo.priority] }}>{PRIORITY_LABEL[todo.priority]}优先级</dd>
        <dt>状态</dt><dd>{STATUS_LABEL[todo.status]}</dd>
        <dt>部门</dt><dd>{todo.department || "未设置"}</dd>
        <dt>联系人</dt><dd>{todo.contactPerson || "未设置"}</dd>
        <dt>备注</dt><dd className="at-detail-copy">{todo.remarks || "无"}</dd>
      </> : <>
        <dt>开始时间</dt><dd>{dateTime(event!.startTime)}</dd>
        <dt>结束时间</dt><dd>{dateTime(event!.endTime)}</dd>
        <dt>持续时间</dt><dd>{interval ? ((interval.end - interval.start) / 3_600_000).toFixed(2) + " 小时" : "时间无效"}</dd>
        <dt>详情</dt><dd className="at-detail-copy">{event!.detail || "无"}</dd>
      </>}
      <dt>标签</dt><dd>{entity.tags.length ? entity.tags.map(tag => <span className="at-tag" key={tag}>{tag}</span>) : "无"}</dd>
      <dt>{todo ? "关联工作记录" : "关联待办"}</dt>
      <dd>{linked.length ? linked.map(item => <button className="at-link" type="button" key={item.id} onClick={() => onSelect({ kind: todo ? "event" : "todo", id: item.id })}>{item.title}</button>) : "无"}</dd>
    </dl>
    <button className="at-edit" type="button" onClick={() => { if (todo) onEditTodo?.(todo); if (event) onEditEvent?.(event); }}>编辑</button>
  </aside>;
}
