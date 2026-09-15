"use client";

import type { EventItem, TodoItem } from "@/types";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  formatClock,
} from "@/lib/timeline-layout";

export type TimelineSelection =
  | { kind: "todo"; todo: TodoItem }
  | { kind: "event"; event: EventItem }
  | null;

type TimelineDetailPanelProps = {
  selection: TimelineSelection;
  linkedTodoTitles?: Record<string, string>;
  onEditTodo?: (todo: TodoItem) => void;
  onEditEvent?: (event: EventItem) => void;
  onClear?: () => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}
export function TimelineDetailPanel({
  selection,
  linkedTodoTitles = {},
  onEditTodo,
  onEditEvent,
  onClear,
}: TimelineDetailPanelProps) {
  if (!selection) {
    return (
      <aside className="timeline-detail-panel timeline-detail-empty">
        <div className="timeline-detail-empty-icon">⌁</div>
        <strong>选择时间轴上的项目</strong>
        <p>点击待办或工作记录，在这里查看完整信息。</p>
      </aside>
    );
  }

  const isTodo = selection.kind === "todo";
  const todo = isTodo ? selection.todo : null;
  const event = !isTodo ? selection.event : null;
  const title = todo?.title ?? event?.title ?? "";
  const primaryTime = todo
    ? (todo.startTime || todo.dueDate)
    : event?.startTime;

  return (
    <aside className="timeline-detail-panel">
      <div className="timeline-detail-head">
        <span className={isTodo ? "timeline-detail-kind todo" : "timeline-detail-kind event"}>
          {isTodo ? "待办" : "工作记录"}
        </span>
        <button type="button" className="timeline-detail-close" onClick={onClear} aria-label="关闭详情">×</button>
      </div>
      <h3>{title}</h3>
      {primaryTime ? (
        <div className="timeline-detail-time">
          <strong>{formatDate(primaryTime)}</strong>
          <span>
            {todo
              ? formatClock(primaryTime)
              : `${formatClock(event!.startTime)} — ${formatClock(event!.endTime)}`}
          </span>
        </div>
      ) : null}

      {todo ? (
        <div className="timeline-detail-badges">
          <span className={`priority priority-${todo.priority}`}>
            {PRIORITY_LABEL[todo.priority]}优先级
          </span>
          <span>{STATUS_LABEL[todo.status] ?? todo.status}</span>
        </div>
      ) : null}

      <div className="timeline-detail-body">
        {todo?.department ? <p><small>部门</small><strong>{todo.department}</strong></p> : null}
        {todo?.contactPerson ? <p><small>联系人</small><strong>{todo.contactPerson}</strong></p> : null}
        {todo?.remarks ? <p className="timeline-detail-copy"><small>备注</small><span>{todo.remarks}</span></p> : null}
        {event?.detail ? <p className="timeline-detail-copy"><small>记录内容</small><span>{event.detail}</span></p> : null}
      </div>
      {(todo?.tags.length || event?.tags.length) ? (
        <div className="timeline-detail-tags">
          {(todo?.tags ?? event?.tags ?? []).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      {event?.linkedTodoIds?.length ? (
        <div className="timeline-detail-links">
          <small>关联待办</small>
          {event.linkedTodoIds.map((id) => (
            <span key={id}>{linkedTodoTitles[id] ?? id}</span>
          ))}
        </div>
      ) : null}

      {todo?.linkedEventIds?.length ? (
        <div className="timeline-detail-links">
          <small>关联工作记录</small>
          <span>{todo.linkedEventIds.length} 条</span>
        </div>
      ) : null}

      <button
        type="button"
        className="timeline-detail-edit"
        onClick={() => {
          if (todo) onEditTodo?.(todo);
          if (event) onEditEvent?.(event);
        }}
      >
        编辑
      </button>
    </aside>
  );
}
