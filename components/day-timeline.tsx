"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { EventItem } from "@/types";

type DayTimelineProps = {
  events: EventItem[];
  linkedTodoTitles?: Record<string, string>;
};

type PositionedEvent = EventItem & {
  color: string;
  lane: number;
  stack: number;
  side: "left" | "right";
  topPercent: number;
  heightPercent: number;
  cardOffsetPx: number;
  cardHeightPx: number;
  compact: boolean;
};

const MIN_SCALE = 0.32;
const MAX_SCALE = 5.2;
const SCALE_STEP = 0.2;
const DAY_HEIGHT = 620;
const EVENT_COLORS = ["#5fa86e", "#8c6fd1", "#d99058", "#4f9d9d", "#c96f91", "#7ea95b"];
const FULL_CARD_MIN_HEIGHT = 128;
const FULL_CARD_MAX_HEIGHT = 186;
const COMPACT_CARD_HEIGHT = 38;
const CARD_VERTICAL_GAP = 12;
const COMPACT_SHIFT_THRESHOLD = 84;

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
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function getMinuteOffset(value: string, origin: number) {
  return (new Date(value).getTime() - origin) / 60000;
}

export function DayTimeline({ events, linkedTodoTitles = {} }: DayTimelineProps) {
  const [scale, setScale] = useState(1);
  const [expandedCompactId, setExpandedCompactId] = useState<string | null>(null);

  const handleWheelZoom = (deltaY: number) => {
    setScale((value) => {
      const next = deltaY < 0 ? value + SCALE_STEP : value - SCALE_STEP;
      return Number(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)).toFixed(2));
    });
  };

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [events],
  );

  const timelineDays = useMemo(() => {
    if (!sortedEvents.length) return [] as string[];

    const days: string[] = [];
    const start = startOfDay(sortedEvents[0].startTime);
    const end = startOfDay(sortedEvents[sortedEvents.length - 1].startTime);
    const cursor = new Date(start);

    while (cursor <= end) {
      days.push(cursor.toISOString());
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [sortedEvents]);

  const totalRangeMinutes = useMemo(() => {
    if (!timelineDays.length) return 24 * 60;
    return (endOfDay(timelineDays[timelineDays.length - 1]).getTime() - startOfDay(timelineDays[0]).getTime()) / 60000;
  }, [timelineDays]);

  const totalHeight = Math.max(DAY_HEIGHT * Math.max(1, timelineDays.length) * scale, 560);

  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    if (!timelineDays.length) return [];

    const origin = startOfDay(timelineDays[0]).getTime();
    const laneEndMinutes: number[] = [];
    const laneBottoms = {
      left: [] as number[],
      right: [] as number[],
    };

    return sortedEvents.map((event, index) => {
      const startMinute = getMinuteOffset(event.startTime, origin);
      const endMinute = getMinuteOffset(event.endTime, origin);
      let lane = laneEndMinutes.findIndex((value) => value <= startMinute);

      if (lane === -1) {
        lane = laneEndMinutes.length;
        laneEndMinutes.push(endMinute);
      } else {
        laneEndMinutes[lane] = endMinute;
      }

      const stack = Math.floor(lane / 2);
      const side: "left" | "right" = lane % 2 === 0 ? "left" : "right";
      const topPercent = (startMinute / totalRangeMinutes) * 100;
      const heightPercent = (Math.max(12, endMinute - startMinute) / totalRangeMinutes) * 100;
      const naturalTopPx = (topPercent / 100) * totalHeight;
      const naturalHeightPx = Math.max((heightPercent / 100) * totalHeight, 12);
      const regularCardHeight = Math.min(FULL_CARD_MAX_HEIGHT, Math.max(FULL_CARD_MIN_HEIGHT, naturalHeightPx));
      const sameSideBottom = laneBottoms[side][stack] ?? -Infinity;
      const shiftedTopPx = Math.max(naturalTopPx, sameSideBottom + CARD_VERTICAL_GAP);
      const cardShiftPx = shiftedTopPx - naturalTopPx;
      const compactByScale = scale <= 0.62;
      const compactByShift = cardShiftPx >= COMPACT_SHIFT_THRESHOLD;
      const compact = compactByScale || compactByShift;
      const cardHeightPx = compact ? COMPACT_CARD_HEIGHT : regularCardHeight;

      laneBottoms[side][stack] = shiftedTopPx + cardHeightPx;

      return {
        ...event,
        lane,
        stack,
        side,
        color: EVENT_COLORS[index % EVENT_COLORS.length],
        topPercent,
        heightPercent,
        cardOffsetPx: cardShiftPx,
        cardHeightPx,
        compact,
      };
    });
  }, [sortedEvents, timelineDays, totalRangeMinutes, totalHeight, scale]);

  const hourMarks = useMemo(() => {
    return Array.from({ length: Math.floor(totalRangeMinutes / 60) + 1 }, (_, index) => {
      const absoluteHour = index;
      const isBoundary = absoluteHour > 0 && absoluteHour % 24 === 0;
      const hourInDay = absoluteHour % 24;
      return {
        key: `hour-${absoluteHour}`,
        topPercent: (absoluteHour * 60 * 100) / totalRangeMinutes,
        label: `${String(hourInDay).padStart(2, "0")}:00`,
        isBoundary,
      };
    });
  }, [totalRangeMinutes]);

  const axisDensity = scale > 1.2 ? 1 : scale > 0.7 ? 2 : 4;

  return (
    <div className="line-timeline">
      <div className="line-timeline-toolbar">
        <button className="axis-zoom-button" onClick={() => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP))} type="button">
          ＋
        </button>
        <span className="axis-zoom-value axis-zoom-value-inline">{Math.round(scale * 100)}%</span>
        <button className="axis-zoom-button" onClick={() => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP))} type="button">
          －
        </button>
      </div>
      <div
        className="line-timeline-scroll"
        onWheelCapture={(event) => {
          if (!(event.target instanceof HTMLElement)) return;
          if (!event.target.closest(".line-timeline-axis-zone")) return;
          event.preventDefault();
          event.stopPropagation();
          handleWheelZoom(event.deltaY);
        }}
      >
        <div className="line-timeline-shell" style={{ height: totalHeight }}>
          <div className="line-timeline-track">
            <div className="line-timeline-axis" />

            <div
              className="line-timeline-axis-zone"
              onWheelCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleWheelZoom(event.deltaY);
              }}
            >
              {hourMarks.map((mark, index) => {
                const previousDay = index > 0 ? timelineDays[Math.floor((index - 1) / 24)] : undefined;
                const currentDay = timelineDays[Math.floor(index / 24)];
                const showLabel = mark.isBoundary || index % axisDensity === 0;

                if (!showLabel) return null;

                return (
                  <div key={mark.key} className={`axis-time-mark ${mark.isBoundary ? "boundary" : ""}`} style={{ top: `${mark.topPercent}%` }}>
                    {mark.isBoundary && previousDay && currentDay ? (
                      <>
                        <span className="axis-boundary-date">{formatDayLabel(previousDay)}</span>
                        <strong>24:00</strong>
                        <span className="axis-boundary-join" />
                        <strong>00:00</strong>
                        <span className="axis-boundary-date">{formatDayLabel(currentDay)}</span>
                      </>
                    ) : (
                      <strong>{mark.label}</strong>
                    )}
                  </div>
                );
              })}
            </div>

            {positionedEvents.map((event) => {
              const isExpanded = expandedCompactId === event.id;
              const renderCompact = event.compact && !isExpanded;
              const style = {
                top: `${event.topPercent}%`,
                height: `${event.heightPercent}%`,
                "--event-color": event.color,
                "--stack-offset": `${Math.min(event.stack * (renderCompact ? 168 : 336), renderCompact ? 220 : 360)}px`,
                "--card-offset-y": `${event.cardOffsetPx}px`,
                "--card-height": `${renderCompact ? COMPACT_CARD_HEIGHT : event.cardHeightPx}px`,
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
                    onClick={() => setExpandedCompactId((value) => (value === event.id ? null : event.id))}
                    onMouseEnter={() => {
                      if (event.compact) {
                        setExpandedCompactId(event.id);
                      }
                    }}
                    onMouseLeave={() => {
                      if (event.compact) {
                        setExpandedCompactId((value) => (value === event.id ? null : value));
                      }
                    }}
                  >
                    {renderCompact ? (
                      <>
                        <h4>{event.title}</h4>
                        {event.linkedTodoIds?.some((todoId) => linkedTodoTitles[todoId]) ? (
                          <span
                            className="compact-link-dot"
                            title={`关联待办：${event.linkedTodoIds
                              ?.filter((todoId) => linkedTodoTitles[todoId])
                              .map((todoId) => linkedTodoTitles[todoId])
                              .join("、")}`}
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="line-event-time">
                          {formatClock(event.startTime)} — {formatClock(event.endTime)}
                        </div>
                        {event.linkedTodoIds?.length ? (
                          <div className="link-badge-group link-badge-group-event">
                            {event.linkedTodoIds
                              .filter((todoId) => linkedTodoTitles[todoId])
                              .map((todoId) => (
                                <div key={todoId} className="link-badge link-badge-event">
                                  关联待办：{linkedTodoTitles[todoId]}
                                </div>
                              ))}
                          </div>
                        ) : null}
                        <h4>{event.title}</h4>
                        <p>{event.detail}</p>
                        <div className="tag-row compact-tags">
                          {event.tags.map((tag) => (
                            <span key={tag} className="tag chip">
                              {tag}
                            </span>
                          ))}
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
