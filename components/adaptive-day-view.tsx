"use client";
import { type CSSProperties, useMemo } from "react";
import type { EventItem, TodoItem } from "@/types";
import { buildDaySummaries, buildDetailedTodoMarkers, layoutDetailedEvents, shiftDate, startOfLocalDay, PRIORITY_COLORS, STATUS_LABEL, formatClock, eventColor, dateLabel, isTodoOverdue } from "@/lib/timeline-adaptive";
import { TimelinePopover } from "./timeline-popover";

export type AdaptiveDayViewProps = {
  date: Date; events: EventItem[]; todos: TodoItem[]; now: number;
  compact?: boolean; width: number;
  onEventClick: (event: EventItem) => void; onTodoClick: (todo: TodoItem) => void;
};
/** 1 天与 3 天共用同一真实时间坐标和分层算法。 */
export function AdaptiveDayView({ date, events, todos, now, compact = false, width, onEventClick, onTodoClick }: AdaptiveDayViewProps) {
  const start = +startOfLocalDay(date);
  const end = +startOfLocalDay(shiftDate(date, 1));
  const duration = end - start;
  const labelWidth = Math.min(164, Math.max(88, width / 8));
  const day = useMemo(() => buildDaySummaries(start, 1, todos, events)[0], [start, todos, events]);
  const markers = useMemo(() => buildDetailedTodoMarkers(day.todos,
    (compact ? 56 : labelWidth + 16) / width * duration / 60_000, compact ? 2 : 4, end), [day.todos, compact, width, duration, end, labelWidth]);
  const layout = useMemo(() => layoutDetailedEvents(day.events, start, end), [day.events, start, end]);
  const hasOverdue = markers.some(m => m.kind === "item" && isTodoOverdue(m.todo, now));
  const step = compact ? 12 : [1, 2, 3, 4, 6, 12].find(value => width / (24 / value) >= 58) ?? 12;
  const ticks = Array.from({ length: 24 / step + 1 }, (_, i) => i * step);
  return <section className={"at-day" + (compact ? " at-day-compact" : "")} style={{ width }} aria-label={dateLabel(date)}
    data-todo-lanes={Math.max(1, ...markers.map(m => m.lane + 1))} data-overdue={hasOverdue} data-event-lanes={Math.max(1, ...layout.visible.map(b => b.lane + 1))} data-overflow={layout.overflow.length > 0}>
    <div className="at-date-heading"><span>{dateLabel(date)}</span></div>
    <div className="at-hour-axis">
      {ticks.map(hour => {
        const tick = new Date(start);
        tick.setHours(hour);
        return <span key={hour} style={{ left: ((+tick - start) / duration * 100) + "%" }} className={hour === 24 ? "at-last-tick" : ""}>{String(hour).padStart(2, "0")}:00</span>;
      })}
    </div>
    <div className="at-day-body">
      {ticks.map(hour => {
        const tick = new Date(start); tick.setHours(hour);
        return <i key={hour} className="at-gridline" style={{ left: ((+tick - start) / duration * 100) + "%" }} />;
      })}
      {now >= start && now < end && <div className="at-now" style={{ left: (now - start) / duration * 100 + "%" }}><span>{formatClock(now)}</span></div>}
      <div className="at-todos">
        {markers.map(marker => {
          const left = (marker.anchorMs - start) / duration * 100;
          const style = { left: left + "%", top: 18 + marker.lane * (compact ? 20 : hasOverdue ? 76 : 60) } as CSSProperties;
          if (marker.kind === "cluster") return <div key={marker.id} className="at-marker" style={style}>
            <span className="at-pin at-cluster-pin" style={{ "--task-color": PRIORITY_COLORS[marker.todos.some(t => t.priority === "high") ? "high" : marker.todos.some(t => t.priority === "medium") ? "medium" : "low"] } as CSSProperties} />
            <TimelinePopover label={marker.todos.length + "项待办"} className={"at-cluster" + (width * (1 - left / 100) < 56 ? " at-cluster-edge" : "")} trigger={marker.todos.length + "项"}>
              {marker.todos.map(todo => <button type="button" key={todo.id} onClick={() => onTodoClick(todo)}>
                <i style={{ background: PRIORITY_COLORS[todo.priority] }} /><span>{todo.title}{isTodoOverdue(todo, now) && <small className="at-overdue">逾期未完成</small>}</span><small>{formatClock(todo.startTime || todo.dueDate!)}</small>
              </button>)}
            </TimelinePopover>
          </div>;
          const todo = marker.todo;
          const overdue = isTodoOverdue(todo, now);
          return <button key={marker.id} type="button" className={"at-marker at-todo at-status-" + todo.status}
            style={{ ...style, "--task-color": PRIORITY_COLORS[todo.priority] } as CSSProperties}
            aria-label={todo.title + "，" + formatClock(marker.anchorMs) + "，" + STATUS_LABEL[todo.status] + (overdue ? "，逾期未完成" : "")}
            title={todo.title} onClick={() => onTodoClick(todo)}>
            <span className="at-pin">{todo.status === "completed" ? "✓" : ""}</span>
            {!compact && <span className="at-todo-label" style={{ width: labelWidth, marginLeft: Math.min(0, width * (1 - left / 100) - labelWidth - 16) }}>
              <small>{formatClock(marker.anchorMs)}</small><strong>{todo.title}</strong>
              {overdue && <span className="at-overdue">逾期未完成</span>}
            </span>}
          </button>;
        })}
      </div>
      <div className="at-events">
        {layout.visible.map(band => {
          const pixels = band.widthPercent / 100 * width;
          return <button key={band.event.id} type="button" className={"at-event" + (!compact && pixels < 80 ? " at-event-narrow" : "")}
            style={{ left: band.leftPercent + "%", width: band.widthPercent + "%", top: 12 + band.lane * (compact ? 38 : 46), background: eventColor(band.event.id) }}
            data-lane={band.lane} data-event-id={band.event.id}
            aria-label={band.event.title + "，" + formatClock(band.event.startTime) + "至" + formatClock(band.event.endTime)}
            title={band.event.title + " " + formatClock(band.event.startTime) + "–" + formatClock(band.event.endTime)}
            onClick={() => onEventClick(band.event)}>
            {pixels >= (compact ? 65 : 45) && <span>{!compact && pixels >= 80 && <small>{formatClock(band.event.startTime)}–{formatClock(band.event.endTime)}</small>}<strong>{band.event.title}</strong></span>}
          </button>;
        })}
        {layout.overflow.map(group => <div className="at-overflow" key={group.id} style={{ left: Math.min(width - 90, (group.anchorMs - start) / duration * width) }}>
          <TimelinePopover label={"+" + group.events.length + "记录"} trigger={"+" + group.events.length + "记录"}>
            {group.events.map(event => <button type="button" key={event.id} onClick={() => onEventClick(event)}>
              <span>{event.title}</span><small>{formatClock(event.startTime)}–{formatClock(event.endTime)}</small>
            </button>)}
          </TimelinePopover>
        </div>)}
      </div>
    </div>
  </section>;
}
