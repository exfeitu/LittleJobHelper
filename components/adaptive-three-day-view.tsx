"use client";

import { type CSSProperties, useMemo } from "react";
import type { EventItem, TodoItem } from "@/types";
import {
  buildDaySummaries,
  buildDetailedTodoMarkers,
  layoutDetailedEvents,
  timeOfDayPercent,
} from "@/lib/timeline-adaptive";
import { TODO_PRIORITY_COLORS, formatClock } from "@/lib/timeline-layout";

type Props = {
  startDate: Date;
  events: EventItem[];
  todos: TodoItem[];
  onEventClick?: (event: EventItem) => void;
  onTodoClick?: (todo: TodoItem) => void;
};

const EVENT_COLORS = ["#65cfab", "#68b7f0", "#a78cf0", "#f2b866", "#ef8fa6"];

function colorFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
export function AdaptiveThreeDayView({
  startDate,
  events,
  todos,
  onEventClick,
  onTodoClick,
}: Props) {
  const startMs = useMemo(() => {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [startDate]);

  const days = useMemo(
    () => buildDaySummaries(startMs, 3, todos, events),
    [startMs, todos, events],
  );

  return (
    <div className="adaptive-three-view">
      <div className="adaptive-three-header">
        <div className="adaptive-three-label-spacer" />
        {days.map((day) => (
          <div key={day.dateKey} className="adaptive-three-day-head">
            <strong>{dayLabel(day.date)}</strong>
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
        ))}
      </div>
      <div className="adaptive-three-body">
        <div className="adaptive-three-row-labels">
          <strong>待办</strong>
          <strong>工作记录</strong>
        </div>
        {days.map((day) => {
          const dayStart = new Date(day.date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          const markers = buildDetailedTodoMarkers(day.todos, 90, 4);
          const layout = layoutDetailedEvents(
            day.events,
            dayStart.getTime(),
            dayEnd.getTime(),
            3,
          );

          return (
            <div key={day.dateKey} className="adaptive-three-day-column">
              <div className="adaptive-three-task-row">
                <i className="adaptive-three-midline" />
                {markers.map((marker) => {
                  const left = timeOfDayPercent(new Date(marker.anchorMs));
                  if (marker.kind === "cluster") {
                    return (
                      <button
                        key={marker.id}
                        type="button"
                        className="adaptive-three-task-cluster"
                        style={{ left: `${left}%` }}
                        title={marker.todos.map((todo) => todo.title).join("\n")}
                      >
                        {marker.todos.length}项
                      </button>
                    );
                  }
                  const style = {
                    left: `${left}%`,
                    "--task-color": TODO_PRIORITY_COLORS[marker.todo.priority],
                    "--task-lane": marker.lane,
                  } as CSSProperties;
                  return (
                    <button
                      key={marker.id}
                      type="button"
                      className="adaptive-three-task-dot"
                      style={style}
                      title={marker.todo.title}
                      onClick={() => onTodoClick?.(marker.todo)}
                    >
                      <span />
                    </button>
                  );
                })}
              </div>

              <div className="adaptive-three-event-row">
                <i className="adaptive-three-midline" />
                {layout.visible.map((band) => {
                  const style = {
                    left: `${band.leftPercent}%`,
                    width: `${band.widthPercent}%`,
                    "--event-color": colorFor(band.event.id),
                    "--event-lane": band.lane,
                  } as CSSProperties;
                  return (
                    <button
                      key={band.event.id}
                      type="button"
                      className="adaptive-three-event-band"
                      style={style}
                      onClick={() => onEventClick?.(band.event)}
                      title={`${formatClock(band.event.startTime)}–${formatClock(band.event.endTime)} ${band.event.title}`}
                    />
                  );
                })}
                {layout.overflow.length ? (
                  <div className="adaptive-three-overflow">
                    +{layout.overflow.reduce((sum, group) => sum + group.events.length, 0)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
