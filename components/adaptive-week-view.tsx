"use client";
import type { DayTimelineSummary } from "@/lib/timeline-adaptive";
import { PRIORITY_COLORS, PRIORITY_LABEL } from "@/lib/timeline-adaptive";
import { TimelineSummaryNow } from "./timeline-summary-now";
export function AdaptiveWeekView({ days, onDayClick, now }: { days: DayTimelineSummary[]; onDayClick: (key: string) => void; now: number }) {
  return <div className="at-week">{days.map(day => <button type="button" key={day.dateKey} className="at-week-day"
    aria-label={day.dateKey + "，查看当天"} onClick={() => onDayClick(day.dateKey)}>
    <div className="at-week-date"><strong>{day.date.getMonth() + 1}/{day.date.getDate()}</strong><small>{day.date.toLocaleDateString("zh-CN", { weekday: "short" })}</small></div>
    <div className="at-week-todos">{(["high", "medium", "low"] as const).map(priority => <span key={priority}>
      <i style={{ background: PRIORITY_COLORS[priority] }} />{PRIORITY_LABEL[priority]} {day.priorityCounts[priority]}
    </span>)}</div>
    <div className="at-week-events"><strong>{day.events.length} 条</strong><span>{day.eventHours.toFixed(1)}h</span></div>
    <TimelineSummaryNow date={day.date} now={now} />
  </button>)}</div>;
}
