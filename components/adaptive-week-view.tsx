"use client";

import { useMemo } from "react";
import type { EventItem, TodoItem } from "@/types";
import { buildDaySummaries } from "@/lib/timeline-adaptive";

type Props = {
  startDate: Date;
  events: EventItem[];
  todos: TodoItem[];
  onDayClick?: (dateKey: string) => void;
};

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function weekDayLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
  }).format(date);
}

export function AdaptiveWeekView({
  startDate,
  events,
  todos,
  onDayClick,
}: Props) {
  const startMs = useMemo(() => {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [startDate]);

  const days = useMemo(
    () => buildDaySummaries(startMs, 7, todos, events),
    [startMs, todos, events],
  );

  return (
    <div className="adaptive-week-view">
      <div className="adaptive-week-labels">
        <span />
        <strong>待办</strong>
        <strong>工作记录</strong>
      </div>
      <div className="adaptive-week-grid">
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            className="adaptive-week-day"
            onClick={() => onDayClick?.(day.dateKey)}
          >
            <div className="adaptive-week-day-head">
              <strong>{dayLabel(day.date)}</strong>
              <span>{weekDayLabel(day.date)}</span>
            </div>
            <div className="adaptive-week-priorities">
              <span className="high"><i />{day.priorityCounts.high}</span>
              <span className="medium"><i />{day.priorityCounts.medium}</span>
              <span className="low"><i />{day.priorityCounts.low}</span>
            </div>
            <div className="adaptive-week-work">
              <strong>{day.events.length} 条</strong>
              <span>{day.eventHours.toFixed(1)}h</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
