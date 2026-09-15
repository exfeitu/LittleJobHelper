"use client";

import { type CSSProperties, useMemo, useState } from "react";
import type { EventItem, TodoItem } from "@/types";
import {
  buildDetailedTodoMarkers,
  layoutDetailedEvents,
  startOfLocalDay,
  timeOfDayPercent,
} from "@/lib/timeline-adaptive";
import {
  TODO_PRIORITY_COLORS,
  formatClock,
} from "@/lib/timeline-layout";

type AdaptiveDayViewProps = {
  date: Date;
  events: EventItem[];
  todos: TodoItem[];
  onEventClick?: (event: EventItem) => void;
  onTodoClick?: (todo: TodoItem) => void;
};

const EVENT_PALETTE = ["#68b7f0", "#65cfab", "#a78cf0", "#f2b866", "#ef8fa6"];

function eventColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EVENT_PALETTE[hash % EVENT_PALETTE.length];
}
export function AdaptiveDayView({
  date,
  events,
  todos,
  onEventClick,
  onTodoClick,
}: AdaptiveDayViewProps) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const dayStart = useMemo(() => startOfLocalDay(date), [date]);
  const dayEnd = useMemo(() => {
    const end = new Date(dayStart);
    end.setDate(end.getDate() + 1);
    return end;
  }, [dayStart]);

  const dayTodos = useMemo(
    () => todos.filter((todo) => {
      const value = todo.startTime || todo.dueDate;
      if (!value || todo.status === "cancelled") return false;
      const time = new Date(value).getTime();
      return time >= dayStart.getTime() && time < dayEnd.getTime();
    }),
    [todos, dayStart, dayEnd],
  );

  const dayEvents = useMemo(
    () => events.filter((event) => {
      const start = new Date(event.startTime).getTime();
      const end = new Date(event.endTime).getTime();
      return start < dayEnd.getTime() && end > dayStart.getTime();
    }),
    [events, dayStart, dayEnd],
  );
  const markers = useMemo(() => buildDetailedTodoMarkers(dayTodos), [dayTodos]);
  const eventLayout = useMemo(
    () => layoutDetailedEvents(dayEvents, dayStart.getTime(), dayEnd.getTime(), 3),
    [dayEvents, dayStart, dayEnd],
  );

  const now = new Date();
  const isToday = startOfLocalDay(now).getTime() === dayStart.getTime();
  const nowPercent = isToday ? timeOfDayPercent(now) : null;
  const hourMarks = Array.from({ length: 13 }, (_, index) => index * 2);

  return (
    <div className="adaptive-day-view">
      <div className="adaptive-day-axis-header">
        <div className="adaptive-day-axis-spacer" />
        <div className="adaptive-day-axis-scale">
          {hourMarks.map((hour) => (
            <span key={hour} style={{ left: `${(hour / 24) * 100}%` }}>
              {String(hour).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>

      <div className="adaptive-day-body">
        <div className="adaptive-day-row-labels">
          <strong>待办任务</strong>
          <strong>工作记录<small>最多显示3层</small></strong>
        </div>
        <div className="adaptive-day-canvas">
          {hourMarks.map((hour) => (
            <i
              key={hour}
              className="adaptive-day-gridline"
              style={{ left: `${(hour / 24) * 100}%` }}
            />
          ))}
          {nowPercent !== null ? (
            <div className="adaptive-now-line" style={{ left: `${nowPercent}%` }}>
              <span>{formatClock(now.toISOString())}</span>
            </div>
          ) : null}

          <div className="adaptive-task-zone">
            {markers.map((marker) => {
              const left = (marker.anchorMs - dayStart.getTime()) / (24 * 60 * 60 * 1000) * 100;
              if (marker.kind === "cluster") {
                const isOpen = openGroupId === marker.id;
                return (
                  <div key={marker.id} className="adaptive-task-marker adaptive-task-cluster" style={{ left: `${left}%` }}>
                    <button type="button" onClick={() => setOpenGroupId(isOpen ? null : marker.id)}>
                      <span className="adaptive-cluster-dot" />
                      <strong>{marker.todos.length} 项</strong>
                    </button>
                    {isOpen ? (
                      <div className="adaptive-overlap-popover">
                        <strong>{marker.todos.length} 个重叠待办</strong>
                        {marker.todos.map((todo) => (
                          <button key={todo.id} type="button" onClick={() => onTodoClick?.(todo)}>
                            <span style={{ background: TODO_PRIORITY_COLORS[todo.priority] }} />
                            <b>{todo.title}</b>
                            <small>{formatClock((todo.startTime || todo.dueDate)!)}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              const color = TODO_PRIORITY_COLORS[marker.todo.priority];
              const style = {
                left: `${left}%`,
                "--task-color": color,
                "--task-lane": marker.lane,
              } as CSSProperties;
              return (
                <button
                  key={marker.id}
                  type="button"
                  className="adaptive-task-marker adaptive-task-item"
                  style={style}
                  onClick={() => onTodoClick?.(marker.todo)}
                  title={marker.todo.title}
                >
                  <span className="adaptive-task-pin" />
                  <span className="adaptive-task-copy">
                    <small>{formatClock((marker.todo.startTime || marker.todo.dueDate)!)}</small>
                    <strong>{marker.todo.title}</strong>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="adaptive-event-zone">
            {eventLayout.visible.map((band) => {
              const color = eventColor(band.event.id);
              const style = {
                left: `${band.leftPercent}%`,
                width: `${band.widthPercent}%`,
                "--event-color": color,
                "--event-lane": band.lane,
              } as CSSProperties;
              return (
                <button
                  key={band.event.id}
                  type="button"
                  className="adaptive-event-band"
                  style={style}
                  onClick={() => onEventClick?.(band.event)}
                  title={band.event.title}
                >
                  <small>{formatClock(band.event.startTime)} — {formatClock(band.event.endTime)}</small>
                  <strong>{band.event.title}</strong>
                </button>
              );
            })}

            {eventLayout.overflow.map((group) => {
              const left = (group.anchorMs - dayStart.getTime()) / (24 * 60 * 60 * 1000) * 100;
              const isOpen = openGroupId === group.id;
              return (
                <div key={group.id} className="adaptive-event-overflow" style={{ left: `${left}%` }}>
                  <button type="button" onClick={() => setOpenGroupId(isOpen ? null : group.id)}>
                    +{group.events.length} 记录
                  </button>
                  {isOpen ? (
                    <div className="adaptive-overlap-popover adaptive-event-popover">
                      <strong>{group.events.length} 条重叠记录</strong>
                      {group.events.map((event) => (
                        <button key={event.id} type="button" onClick={() => onEventClick?.(event)}>
                          <span style={{ background: eventColor(event.id) }} />
                          <b>{event.title}</b>
                          <small>{formatClock(event.startTime)}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
