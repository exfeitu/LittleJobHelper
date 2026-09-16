"use client";
import { useState } from "react";
import { dateLabel, densityLevel, type DayTimelineSummary } from "@/lib/timeline-adaptive";
import { TimelineSummaryNow } from "./timeline-summary-now";
export function AdaptiveMonthView({ days, onDayClick, now }: { days: DayTimelineSummary[]; onDayClick: (key: string) => void; now: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const day = days.find(d => d.dateKey === hovered);
  const maxTodos = Math.max(1, ...days.map(d => d.todos.length));
  const maxHours = Math.max(1, ...days.map(d => d.eventHours));
  return <div className="at-month">
    <div className="at-month-grid">{days.map(day => <button type="button" key={day.dateKey} className="at-month-day"
      aria-label={day.dateKey + "，" + day.todos.length + "项待办，" + day.events.length + "条记录，" + day.eventHours.toFixed(1) + "小时，查看当天"}
      onMouseEnter={() => setHovered(day.dateKey)} onMouseLeave={() => setHovered(null)}
      onFocus={() => setHovered(day.dateKey)} onBlur={() => setHovered(null)} onClick={() => onDayClick(day.dateKey)}>
      <span className="at-month-date">{day.date.getDate() === 1 ? day.date.getMonth() + 1 + "/" : ""}{day.date.getDate()}<small>{"日一二三四五六"[day.date.getDay()]}</small></span>
      <span className={"at-heat at-heat-todo level-" + densityLevel(day.todos.length, maxTodos)} />
      <span className={"at-heat at-heat-event level-" + densityLevel(day.eventHours, maxHours)} />
      <TimelineSummaryNow date={day.date} now={now} />
    </button>)}</div>
    <div className="at-month-tooltip" role="status">
      {day ? <><strong>{dateLabel(day.date)}</strong><span>待办 {day.todos.length} 项（高 {day.priorityCounts.high} / 中 {day.priorityCounts.medium} / 低 {day.priorityCounts.low}）</span>
        <span>工作记录 {day.events.length} 条 · {day.eventHours.toFixed(1)}h</span><small>点击日期查看 1 天详情</small></>
        : <><span>悬停或聚焦日期查看当天统计，点击进入 1 天视图</span><small>浅 → 深：0—5 级；待办按数量、工作按总工时，相对当前时间段计算</small></>}
    </div>
  </div>;
}
