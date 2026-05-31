"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventItem } from "@/types";

type DayTimelineProps = {
  events: EventItem[];
  linkedTodoTitles?: Record<string, string>;
};

type PositionedEvent = EventItem & {
  color: string;
  lane: number;
  stack: number;
  side: "top" | "bottom";
  leftPercent: number;
  widthPercent: number;
  cardOffsetXPx: number;
  cardWidthPx: number;
  compact: boolean;
};

const MIN_SCALE = 0.16;
const MAX_SCALE = 5.2;
const SCALE_STEP = 0.2;
const BASE_VISIBLE_DAYS = 7;
const EVENT_COLORS = ["#5fa86e", "#8c6fd1", "#d99058", "#4f9d9d", "#c96f91", "#7ea95b"];
const FULL_CARD_MIN_WIDTH = 60;
const FULL_CARD_MAX_WIDTH = 320;
const COMPACT_CARD_WIDTH = 48;
const CARD_HORIZONTAL_GAP = 6;
const COMPACT_SHIFT_THRESHOLD = 40;
const LANE_HEIGHT = 128;
const TRACK_PADDING = 64;

function startOfDay(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

export function DayTimeline({ events, linkedTodoTitles = {} }: DayTimelineProps) {
  const [scale, setScale] = useState(1);
  const [expandedCompactId, setExpandedCompactId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // 测量容器宽度
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [events],
  );

  const todayStart = useMemo(() => startOfDay(new Date().toISOString()), []);

  const timelineDays = useMemo(() => {
    const MIN_DAYS = 7;
    if (!sortedEvents.length) {
      const days: string[] = [];
      const cursor = new Date(todayStart);
      cursor.setDate(cursor.getDate() - 3);
      for (let i = 0; i < MIN_DAYS; i++) {
        days.push(cursor.toISOString());
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }
    const dataStart = startOfDay(sortedEvents[0].startTime);
    const dataEnd = startOfDay(sortedEvents[sortedEvents.length - 1].startTime);
    const dataDays = Math.round((dataEnd.getTime() - dataStart.getTime()) / 86400000) + 1;
    let start: Date;
    let end: Date;
    if (dataDays >= MIN_DAYS) {
      start = dataStart;
      end = dataEnd;
    } else {
      const extraDays = MIN_DAYS - dataDays;
      const beforeDays = Math.floor(extraDays / 2);
      start = new Date(dataStart);
      start.setDate(start.getDate() - beforeDays);
      end = new Date(dataEnd);
      end.setDate(end.getDate() + (extraDays - beforeDays));
    }
    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(cursor.toISOString());
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [sortedEvents, todayStart]);

  // 整个时间轴覆盖的绝对时间范围
  const timeOrigin = useMemo(
    () => (timelineDays.length ? startOfDay(timelineDays[0]).getTime() : todayStart.getTime()),
    [timelineDays, todayStart],
  );
  const timeEnd = useMemo(
    () => (timelineDays.length ? endOfDay(timelineDays[timelineDays.length - 1]).getTime() : timeOrigin + 7 * 86400000),
    [timelineDays, timeOrigin],
  );
  const totalRangeMs = timeEnd - timeOrigin;

  // 缩放决定视口中可见的天数，shell 宽度 = (总天数 / 可见天数) × 容器宽
  const visibleDays = BASE_VISIBLE_DAYS / scale;
  const totalDays = timelineDays.length;
  const shellWidth = Math.max((totalDays / visibleDays) * containerWidth, containerWidth);

  // 初次渲染时滚动到今天居中
  useEffect(() => {
    if (initializedRef.current) return;
    const container = scrollRef.current;
    if (!container || !containerWidth || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollLeft = Math.max(0, todayPx - containerWidth / 2);
    initializedRef.current = true;
  }, [containerWidth, shellWidth, timeOrigin, totalRangeMs, todayStart]);

  // 缩放时也重新居中到今天（当 shell 宽度变化时）
  useEffect(() => {
    if (!initializedRef.current) return;
    const container = scrollRef.current;
    if (!container || !containerWidth || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollLeft = Math.max(0, todayPx - containerWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    if (!timelineDays.length) return [];
    const laneEndMinutes: number[] = [];
    const laneRights = { top: [] as number[], bottom: [] as number[] };

    return sortedEvents.map((event, index) => {
      const startMs = new Date(event.startTime).getTime();
      const endMs = new Date(event.endTime).getTime();
      const startMinute = (startMs - timeOrigin) / 60000;
      const endMinute = (endMs - timeOrigin) / 60000;

      let lane = laneEndMinutes.findIndex((v) => v <= startMinute);
      if (lane === -1) {
        lane = laneEndMinutes.length;
        laneEndMinutes.push(endMinute);
      } else {
        laneEndMinutes[lane] = endMinute;
      }

      const stack = Math.floor(lane / 2);
      const side: "top" | "bottom" = lane % 2 === 0 ? "top" : "bottom";

      // 在整个 shell 中的百分比位置
      const leftPercent = totalRangeMs > 0 ? ((startMs - timeOrigin) / totalRangeMs) * 100 : 0;
      const widthPercent = totalRangeMs > 0 ? (Math.max(60000, endMs - startMs) / totalRangeMs) * 100 : 0;

      const naturalLeftPx = (leftPercent / 100) * shellWidth;
      const naturalWidthPx = Math.max(40, (widthPercent / 100) * shellWidth);
      const regularCardWidth = Math.min(FULL_CARD_MAX_WIDTH, Math.max(FULL_CARD_MIN_WIDTH, naturalWidthPx));

      const sameSideRight = laneRights[side][stack] ?? -Infinity;
      const shiftedLeftPx = Math.max(naturalLeftPx, sameSideRight + CARD_HORIZONTAL_GAP);
      const cardShiftPx = shiftedLeftPx - naturalLeftPx;

      const compactByScale = scale <= 0.55;
      const compactByShift = cardShiftPx >= COMPACT_SHIFT_THRESHOLD;
      const compact = compactByScale || compactByShift;
      const cardWidthPx = compact ? COMPACT_CARD_WIDTH : regularCardWidth;

      laneRights[side][stack] = shiftedLeftPx + cardWidthPx;

      return {
        ...event,
        lane, stack, side,
        color: EVENT_COLORS[index % EVENT_COLORS.length],
        leftPercent, widthPercent,
        cardOffsetXPx: cardShiftPx,
        cardWidthPx,
        compact,
      };
    });
  }, [sortedEvents, timelineDays, timeOrigin, totalRangeMs, shellWidth, scale]);

  const trackHeight = useMemo(() => {
    const maxTop = positionedEvents.reduce((m, e) => (e.side === "top" ? Math.max(m, e.stack) : m), -1);
    const maxBottom = positionedEvents.reduce((m, e) => (e.side === "bottom" ? Math.max(m, e.stack) : m), -1);
    const needed = (Math.max(maxTop, maxBottom) + 1) * LANE_HEIGHT * 2 + TRACK_PADDING * 2;
    return Math.max(380, needed);
  }, [positionedEvents]);

  const hourMarks = useMemo(() => {
    const totalMinutes = totalRangeMs / 60000;
    const count = Math.floor(totalMinutes / 60) + 1;
    return Array.from({ length: count }, (_, i) => {
      const isBoundary = i > 0 && i % 24 === 0;
      return {
        key: `h-${i}`,
        leftPercent: totalRangeMs > 0 ? (i * 3600000) / totalRangeMs * 100 : 0,
        label: `${String(i % 24).padStart(2, "0")}:00`,
        isBoundary,
      };
    });
  }, [totalRangeMs]);

  const axisDensity = scale > 1.2 ? 1 : scale > 0.5 ? 2 : 4;

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollTo({ left: Math.max(0, todayPx - containerWidth / 2), behavior: "smooth" });
  }, [todayStart, timeOrigin, totalRangeMs, shellWidth, containerWidth]);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const container = scrollRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorXInViewport = event.clientX - rect.left;
      const cursorXInContent = cursorXInViewport + container.scrollLeft;
      const cursorRatio = shellWidth > 0 ? cursorXInContent / shellWidth : 0;

      setScale((prev) => {
        const next = event.deltaY < 0 ? prev + SCALE_STEP : prev - SCALE_STEP;
        const clamped = Number(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)).toFixed(2));
        return clamped;
      });

      // 缩放后保持光标位置对应的时间点不动
      requestAnimationFrame(() => {
        const newVisibleDays = BASE_VISIBLE_DAYS / scale;
        const newShellWidth = Math.max((totalDays / newVisibleDays) * containerWidth, containerWidth);
        // 读取最新的 scale 需要通过闭包 — 实际上 scale 还没更新，用 clamped
        // 简化处理：在下一帧重新计算并设置 scrollLeft
        const updatedVisibleDays = BASE_VISIBLE_DAYS / (event.deltaY < 0 ? Math.min(MAX_SCALE, scale + SCALE_STEP) : Math.max(MIN_SCALE, scale - SCALE_STEP));
        const updatedShellWidth = Math.max((totalDays / updatedVisibleDays) * containerWidth, containerWidth);
        container.scrollLeft = Math.max(0, cursorRatio * updatedShellWidth - cursorXInViewport);
      });
    },
    [scale, shellWidth, containerWidth, totalDays],
  );

  return (
    <div className="line-timeline">
      <div className="line-timeline-toolbar">
        <button className="axis-zoom-button" onClick={() => setScale((v) => Math.min(MAX_SCALE, v + SCALE_STEP))} type="button">＋</button>
        <span className="axis-zoom-value axis-zoom-value-inline">{Math.round(scale * 100)}%</span>
        <button className="axis-zoom-button" onClick={() => setScale((v) => Math.max(MIN_SCALE, v - SCALE_STEP))} type="button">－</button>
        <span className="toolbar-sep" />
        <button className="axis-today-button" type="button" onClick={scrollToToday}>今天</button>
        <span className="toolbar-sep" />
        <span className="axis-zoom-value-inline" style={{ minWidth: "auto", fontSize: "0.75rem" }}>
          {Math.round(visibleDays * 10) / 10}天
        </span>
      </div>
      <div className="line-timeline-hscroll" ref={scrollRef} onWheel={handleWheel}>
        <div className="line-timeline-shell" style={{ width: shellWidth, height: trackHeight }}>
          <div className="line-timeline-track">
            {/* 水平时间轴线 */}
            <div className="line-timeline-axis" />

            {/* 时间刻度 */}
            <div className="line-timeline-axis-zone">
              {hourMarks.map((mark, i) => {
                const previousDay = i > 0 ? timelineDays[Math.floor((i - 1) / 24)] : undefined;
                const currentDay = timelineDays[Math.floor(i / 24)];
                const showLabel = mark.isBoundary || i % axisDensity === 0;
                if (!showLabel) return null;
                return (
                  <div key={mark.key} className={`axis-time-mark ${mark.isBoundary ? "boundary" : ""}`} style={{ left: `${mark.leftPercent}%` }}>
                    {mark.isBoundary && previousDay && currentDay ? (
                      <div className="axis-boundary-stack">
                        <span className="axis-boundary-date">{formatDayLabel(previousDay)}</span>
                        <strong>24:00</strong>
                        <span className="axis-boundary-line" />
                        <strong>00:00</strong>
                        <span className="axis-boundary-date">{formatDayLabel(currentDay)}</span>
                      </div>
                    ) : (
                      <strong className="axis-hour-label">{mark.label}</strong>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 日分隔竖线 */}
            {timelineDays.slice(1).map((day) => {
              const dayStart = startOfDay(day).getTime();
              const dayLeftPercent = totalRangeMs > 0 ? ((dayStart - timeOrigin) / totalRangeMs) * 100 : 0;
              return <div key={`sep-${day}`} className="line-day-separator" style={{ left: `${dayLeftPercent}%` }} />;
            })}

            {/* 每日标签 */}
            {timelineDays.map((day) => {
              const dayStart = startOfDay(day).getTime();
              const dayLeftPercent = totalRangeMs > 0 ? ((dayStart - timeOrigin) / totalRangeMs) * 100 : 0;
              return <div key={day} className="line-day-chip" style={{ left: `${dayLeftPercent}%` }}>{formatDayLabel(day)}</div>;
            })}

            {/* 事件卡片 */}
            {positionedEvents.map((event) => {
              const isExpanded = expandedCompactId === event.id;
              const renderCompact = event.compact && !isExpanded;
              const style = {
                left: `${event.leftPercent}%`,
                width: `${event.widthPercent}%`,
                "--event-color": event.color,
                "--stack-offset": `${event.stack * LANE_HEIGHT}px`,
                "--card-offset-x": `${event.cardOffsetXPx}px`,
                "--card-width": `${renderCompact ? COMPACT_CARD_WIDTH : event.cardWidthPx}px`,
                "--lane-height": `${LANE_HEIGHT}px`,
              } as CSSProperties;

              return (
                <article key={event.id} className={`line-event line-event-${event.side} ${renderCompact ? "compact" : ""}`} style={style}>
                  <div className="line-event-axis-group">
                    <span className="line-event-point" />
                    <span className="line-event-stem" />
                  </div>
                  <button
                    className="line-event-card"
                    type="button"
                    onClick={() => setExpandedCompactId((v) => (v === event.id ? null : event.id))}
                    onMouseEnter={() => { if (event.compact) setExpandedCompactId(event.id); }}
                    onMouseLeave={() => { if (event.compact) setExpandedCompactId((v) => (v === event.id ? null : v)); }}
                  >
                    {renderCompact ? (
                      <>
                        <h4>{event.title}</h4>
                        {event.linkedTodoIds?.some((id) => linkedTodoTitles[id]) ? (
                          <span className="compact-link-dot" title={`关联待办：${event.linkedTodoIds?.filter((id) => linkedTodoTitles[id]).map((id) => linkedTodoTitles[id]).join("、")}`} />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="line-event-time">{formatClock(event.startTime)} — {formatClock(event.endTime)}</div>
                        {event.linkedTodoIds?.length ? (
                          <div className="link-badge-group link-badge-group-event">
                            {event.linkedTodoIds.filter((id) => linkedTodoTitles[id]).map((id) => (
                              <div key={id} className="link-badge link-badge-event">关联待办：{linkedTodoTitles[id]}</div>
                            ))}
                          </div>
                        ) : null}
                        <h4>{event.title}</h4>
                        <p>{event.detail}</p>
                        <div className="tag-row compact-tags">
                          {event.tags.map((tag) => <span key={tag} className="tag chip">{tag}</span>)}
                        </div>
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
