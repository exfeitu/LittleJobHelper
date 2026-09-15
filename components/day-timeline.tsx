"use client";

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EventItem, TodoItem } from "@/types";
import { AdaptiveDayView } from "@/components/adaptive-day-view";
import { AdaptiveThreeDayView } from "@/components/adaptive-three-day-view";
import { AdaptiveWeekView } from "@/components/adaptive-week-view";
import { TimelineDetailPanel, type TimelineSelection } from "@/components/timeline-detail-panel";
import { adaptiveViewForDays, localDateKey } from "@/lib/timeline-adaptive";
import {
  BASE_VISIBLE_DAYS,
  MAX_SCALE,
  MIN_SCALE,
  PRIORITY_LABEL,
  SCALE_STEP,
  STATUS_LABEL,
  TimelineItem,
  TASK_RAIL_PRIORITIES,
  buildTimelineTaskRailItems,
  buildWeekBrackets,
  endOfDay,
  eventToTimeline,
  formatClock,
  formatDayLabel,
  getTimelineDensity,
  layoutTimelineEventStrips,
  startOfDay,
  todoToTimeline,
} from "@/lib/timeline-layout";

type DayTimelineProps = {
  events: EventItem[];
  todos?: TodoItem[];
  linkedTodoTitles?: Record<string, string>;
  onEventClick?: (event: EventItem) => void;
  onTodoClick?: (todo: TodoItem) => void;
  // 外部控制（由父组件渲染工具栏时使用）
  scale?: number;
  onScaleChange?: (scale: number) => void;
  scrollToTodayTrigger?: number;
  scrollToDate?: string;
};

export function DayTimeline({ events, todos = [], linkedTodoTitles = {}, onEventClick, onTodoClick, scale: externalScale, onScaleChange, scrollToTodayTrigger, scrollToDate }: DayTimelineProps) {
  const [internalScale, setInternalScale] = useState(1);
  const scale = externalScale ?? internalScale;
  const setScale = (v: number) => {
    if (onScaleChange) {
      onScaleChange(v);
    } else {
      setInternalScale(v);
    }
  };
  const hasExternalToolbar = externalScale !== undefined;

  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const wheelZoomingRef = useRef(false);
  const prevScaleRef = useRef(scale);

  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [timelineReady, setTimelineReady] = useState(false);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [selection, setSelection] = useState<TimelineSelection>(null);
  const [adaptiveFocusDate, setAdaptiveFocusDate] = useState(() => scrollToDate ?? localDateKey(new Date()));

  // 视口虚拟化：只渲染可视区域附近的元素
  const [viewportLeft, setViewportLeft] = useState(0);
  const visibleRange = useMemo(() => ({
    left: viewportLeft - containerWidth * 0.5,
    right: viewportLeft + containerWidth * 1.5,
  }), [viewportLeft, containerWidth]);

  // 同步 scrollLeft 到状态（RAF 节流），用于虚拟化
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setViewportLeft(container.scrollLeft);
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // useLayoutEffect 调整 scrollLeft 后同步 viewportLeft
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container) setViewportLeft(container.scrollLeft);
  }, [scale]);

  // 首帧立即读取容器宽度（useLayoutEffect 在 paint 前同步执行，消除白屏）
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container) {
      const w = container.clientWidth;
      if (w > 0) setContainerWidth(w);
    }
  }, []);

  // 拖动平移
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const [dragging, setDragging] = useState(false);

  // 后续尺寸变化由 ResizeObserver 处理（useLayoutEffect 避免 ResizeObserver 的异步延迟）
  useLayoutEffect(() => {
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

  // 合并 events 和 todos 为统一的时间轴条目
  const allItems = useMemo<TimelineItem[]>(() => {
    const eventItems = events.map(eventToTimeline);
    const todoItems = todos
      .filter((t) => t.status !== "cancelled")
      .map(todoToTimeline);
    return [...eventItems, ...todoItems].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [events, todos]);

  const todayStart = useMemo(() => startOfDay(new Date().toISOString()), []);

  const timelineDays = useMemo(() => {
    const TODAY = new Date(todayStart);
    // 始终至少覆盖 today 前后各 730 天（约 4 年），实现"无限"可滚动
    const FALLBACK_START = new Date(TODAY);
    FALLBACK_START.setDate(FALLBACK_START.getDate() - 730);
    const FALLBACK_END = new Date(TODAY);
    FALLBACK_END.setDate(FALLBACK_END.getDate() + 730);

    if (!allItems.length) {
      const days: string[] = [];
      const cursor = new Date(FALLBACK_START);
      while (cursor <= FALLBACK_END) {
        days.push(cursor.toISOString());
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }
    const dataStart = startOfDay(allItems[0].startTime);
    const dataEnd = startOfDay(allItems[allItems.length - 1].startTime);
    const start = dataStart < FALLBACK_START ? dataStart : FALLBACK_START;
    const end = dataEnd > FALLBACK_END ? dataEnd : FALLBACK_END;
    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(cursor.toISOString());
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [allItems, todayStart]);

  const timeOrigin = useMemo(
    () => (timelineDays.length ? startOfDay(timelineDays[0]).getTime() : todayStart.getTime()),
    [timelineDays, todayStart],
  );
  const timeEnd = useMemo(
    () => (timelineDays.length ? endOfDay(timelineDays[timelineDays.length - 1]).getTime() : timeOrigin + 7 * 86400000),
    [timelineDays, timeOrigin],
  );
  const totalRangeMs = timeEnd - timeOrigin;

  const visibleDays = BASE_VISIBLE_DAYS / scale;
  const adaptiveView = adaptiveViewForDays(visibleDays);
  const adaptiveDate = useMemo(
    () => new Date(`${adaptiveFocusDate}T00:00:00`),
    [adaptiveFocusDate],
  );
  const timelineDensity = getTimelineDensity(visibleDays);
  const totalDays = timelineDays.length;
  const shellWidth = Math.max((totalDays / visibleDays) * containerWidth, containerWidth);
  const taskRailItems = useMemo(
    () => buildTimelineTaskRailItems(todos, timelineDensity),
    [todos, timelineDensity],
  );

  // 缩放后统一调整 scroll 位置（useLayoutEffect 在 DOM 更新后、绘制前执行，消除闪烁）
  useLayoutEffect(() => {
    if (!initializedRef.current) return;
    const prevScale = prevScaleRef.current;
    if (prevScale === scale) return;
    prevScaleRef.current = scale;

    const container = scrollRef.current;
    if (!container) return;

    if (wheelZoomingRef.current) {
      wheelZoomingRef.current = false;
      // 滚轮缩放：锚定光标位置
      const { ratio, viewportX } = lastCursorRef.current;
      container.scrollLeft = Math.max(0, ratio * shellWidth - viewportX);
    } else {
      // 按钮缩放：保持视窗中心不变
      const centerXInViewport = containerWidth / 2;
      const centerXInContent = centerXInViewport + container.scrollLeft;
      const prevVisibleDays = BASE_VISIBLE_DAYS / prevScale;
      const prevShellWidth = Math.max((totalDays / prevVisibleDays) * containerWidth, containerWidth);
      const centerRatio = prevShellWidth > 0 ? centerXInContent / prevShellWidth : 0.5;
      container.scrollLeft = Math.max(0, centerRatio * shellWidth - centerXInViewport);
    }
  }, [scale, shellWidth, containerWidth, totalDays]);

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    const container = scrollRef.current;
    if (!container || !containerWidth || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollLeft = Math.max(0, todayPx - containerWidth / 2);
    initializedRef.current = true;
    setTimelineReady(true);
  }, [containerWidth, shellWidth, timeOrigin, totalRangeMs, todayStart]);

  // 响应外部"回到今天"触发
  useEffect(() => {
    if (scrollToTodayTrigger === undefined || scrollToTodayTrigger === 0) return;
    scrollToToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTodayTrigger]);

  // 响应外部跳转到指定日期
  useEffect(() => {
    if (scrollToDate) setAdaptiveFocusDate(scrollToDate);
    if (!scrollToDate || !initializedRef.current) return;
    const container = scrollRef.current;
    if (!container || !containerWidth || !totalRangeMs) return;
    const targetMs = startOfDay(scrollToDate).getTime();
    const targetRatio = totalRangeMs > 0 ? (targetMs - timeOrigin) / totalRangeMs : 0;
    const targetPx = targetRatio * shellWidth;
    container.scrollTo({ left: Math.max(0, targetPx - containerWidth / 2), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToDate]);

  const eventStrips = useMemo(
    () => layoutTimelineEventStrips(
      events,
      timeOrigin,
      totalRangeMs,
      shellWidth,
      timelineDensity,
    ),
    [events, timeOrigin, totalRangeMs, shellWidth, timelineDensity],
  );

  const visibleTaskRailItems = useMemo(() => {
    return taskRailItems.filter((item) => {
      const anchorPx = totalRangeMs > 0
        ? ((item.anchorMs - timeOrigin) / totalRangeMs) * shellWidth
        : 0;
      return anchorPx >= visibleRange.left - 160 && anchorPx <= visibleRange.right + 160;
    });
  }, [taskRailItems, timeOrigin, totalRangeMs, shellWidth, visibleRange]);

  const visibleEventStrips = useMemo(() => {
    return eventStrips.filter((item) => {
      const leftPx = (item.leftPercent / 100) * shellWidth;
      const rightPx = leftPx + Math.max(item.labelWidthPx, item.durationWidthPx);
      return rightPx >= visibleRange.left && leftPx <= visibleRange.right;
    });
  }, [eventStrips, shellWidth, visibleRange]);

  const trackHeight = 360;

  // 按周聚合计数（以周一为周起始对齐）
  const weekBrackets = useMemo(() => buildWeekBrackets(allItems), [allItems]);

  // 根据可见天数和视口宽度动态计算刻度密度，避免缩小时标签过密
  const axisDensity = useMemo(() => {
    if (containerWidth <= 0) return 4;
    const visibleHours = visibleDays * 24;
    const targetLabelCount = Math.max(4, Math.floor(containerWidth / 72));
    return Math.max(1, Math.ceil(visibleHours / targetLabelCount));
  }, [visibleDays, containerWidth]);

  const hourMarks = useMemo(() => {
    const totalHours = Math.floor(totalRangeMs / 3600000) + 1;
    if (totalHours <= 0) return [];
    const marks: { key: string; leftPercent: number; label: string }[] = [];

    // 从第1小时开始，优先显示奇数时间点，自然避开 00:00（日边界）
    for (let hour = 1; hour < totalHours; hour += axisDensity) {
      marks.push({
        key: `h-${hour}`,
        leftPercent: totalRangeMs > 0 ? (hour * 3600000) / totalRangeMs * 100 : 0,
        label: `${String(hour % 24).padStart(2, "0")}:00`,
      });
    }

    return marks;
  }, [totalRangeMs, axisDensity]);

  // 视口虚拟化：只保留可见范围内的元素
  const pxFromPct = (pct: number) => (pct / 100) * shellWidth;
  const isVisible = (px: number) => px >= visibleRange.left && px <= visibleRange.right;

  const visibleHourMarks = useMemo(
    () => hourMarks.filter((m) => isVisible(pxFromPct(m.leftPercent))),
    [hourMarks, shellWidth, visibleRange],
  );

  const visibleDaySeps = useMemo(() => {
    // timelineDays 是 ISO 字符串数组，左边界对应 day 的 00:00
    return timelineDays.filter((day) => {
      const dayPx = pxFromPct(totalRangeMs > 0 ? ((startOfDay(day).getTime() - timeOrigin) / totalRangeMs) * 100 : 0);
      return isVisible(dayPx);
    });
  }, [timelineDays, totalRangeMs, timeOrigin, shellWidth, visibleRange]);

  const visibleWeekBrackets = useMemo(
    () => weekBrackets.filter((w) => isVisible(pxFromPct(totalRangeMs > 0 ? ((w.start.getTime() - timeOrigin) / totalRangeMs) * 100 : 0))),
    [weekBrackets, totalRangeMs, timeOrigin, shellWidth, visibleRange],
  );

  const visibleDayLabels = useMemo(
    () => timelineDays.filter((day) => isVisible(pxFromPct(totalRangeMs > 0 ? ((startOfDay(day).getTime() - timeOrigin) / totalRangeMs) * 100 : 0))),
    [timelineDays, totalRangeMs, timeOrigin, shellWidth, visibleRange],
  );

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollTo({ left: Math.max(0, todayPx - containerWidth / 2), behavior: "smooth" });
  }, [todayStart, timeOrigin, totalRangeMs, shellWidth, containerWidth]);

  // 鼠标拖动平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = container.scrollLeft;
    setDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const container = scrollRef.current;
    if (!container) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      container.scrollLeft = dragStartScrollLeft.current - dx;
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      setDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // 年份标签
  const yearLabel = useMemo(() => {
    if (!timelineDays.length) return "";
    const midIdx = Math.floor(timelineDays.length / 2);
    const midDate = new Date(timelineDays[midIdx]);
    return `${midDate.getFullYear()}年`;
  }, [timelineDays]);

  // 滚轮缩放 RAF 批处理，消除卡顿
  const pendingFactorRef = useRef(1);
  const rafIdRef = useRef<number | null>(null);
  const lastCursorRef = useRef({ ratio: 0, viewportX: 0 });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const container = scrollRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorXInViewport = event.clientX - rect.left;
      const cursorXInContent = cursorXInViewport + container.scrollLeft;
      lastCursorRef.current = {
        ratio: shellWidth > 0 ? cursorXInContent / shellWidth : 0,
        viewportX: cursorXInViewport,
      };

      // 累积缩放因子
      const tickFactor = event.deltaY < 0 ? 1.05 : 0.95;
      pendingFactorRef.current *= tickFactor;

      if (rafIdRef.current !== null) return; // 已有待处理的 RAF
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const factor = pendingFactorRef.current;
        pendingFactorRef.current = 1;
        const nextScale = scaleRef.current * factor;
        const clamped = Number(Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)).toFixed(4));
        if (clamped === scaleRef.current) return;
        wheelZoomingRef.current = true;

        // 预测缩放后的视口位置，提前更新避免虚拟化闪烁
        const nextVisDays = BASE_VISIBLE_DAYS / clamped;
        const nextShellW = Math.max((totalDays / nextVisDays) * containerWidth, containerWidth);
        const { ratio, viewportX } = lastCursorRef.current;
        setViewportLeft(Math.max(0, ratio * nextShellW - viewportX));

        setScale(clamped);
      });
    },
    [shellWidth, containerWidth, totalDays],
  );

  const detailPanel = (
    <TimelineDetailPanel
      selection={selection}
      linkedTodoTitles={linkedTodoTitles}
      onEditEvent={onEventClick}
      onEditTodo={onTodoClick}
      onClear={() => setSelection(null)}
    />
  );

  if (adaptiveView === "day") {
    return (
      <div className="adaptive-timeline-layout">
        <div className="adaptive-timeline-primary">
          <AdaptiveDayView
            date={adaptiveDate}
            events={events}
            todos={todos}
            onEventClick={(event) => setSelection({ kind: "event", event })}
            onTodoClick={(todo) => setSelection({ kind: "todo", todo })}
          />
        </div>
        {detailPanel}
      </div>
    );
  }

  if (adaptiveView === "three") {
    return (
      <div className="adaptive-timeline-layout">
        <div className="adaptive-timeline-primary">
          <AdaptiveThreeDayView
            startDate={adaptiveDate}
            events={events}
            todos={todos}
            onEventClick={(event) => setSelection({ kind: "event", event })}
            onTodoClick={(todo) => setSelection({ kind: "todo", todo })}
          />
        </div>
        {detailPanel}
      </div>
    );
  }

  if (adaptiveView === "week") {
    return (
      <div className="adaptive-timeline-layout">
        <div className="adaptive-timeline-primary">
          <AdaptiveWeekView
            startDate={adaptiveDate}
            events={events}
            todos={todos}
            onDayClick={(dateKey) => {
              setAdaptiveFocusDate(dateKey);
              setScale(1);
              setSelection(null);
            }}
          />
        </div>
        {detailPanel}
      </div>
    );
  }

  return (
    <div className={`line-timeline line-timeline-density-${timelineDensity}`} suppressHydrationWarning>
      {!hasExternalToolbar && (
        <div className="line-timeline-toolbar">
          <button className="axis-zoom-button" onClick={() => setScale(Math.min(MAX_SCALE, scale + SCALE_STEP))} type="button">＋</button>
          <span className="axis-zoom-value axis-zoom-value-inline">{Math.round(scale * 100)}%</span>
          <button className="axis-zoom-button" onClick={() => setScale(Math.max(MIN_SCALE, scale - SCALE_STEP))} type="button">－</button>
          <span className="toolbar-sep" />
          <button className="axis-today-button" type="button" onClick={scrollToToday}>今天</button>
          <span className="toolbar-sep" />
          <span className="axis-zoom-value-inline" style={{ minWidth: "auto", fontSize: "0.75rem" }}>
            {Math.round(visibleDays * 10) / 10}天
          </span>
        </div>
      )}
      <div className="line-timeline-hscroll" ref={scrollRef} onWheel={handleWheel} onMouseDown={handleMouseDown} style={{ cursor: dragging ? "grabbing" : "grab", opacity: timelineReady ? 1 : 0, transition: "opacity 0.15s ease" }}>
        <div className="line-timeline-shell" style={{ width: shellWidth, height: trackHeight }}>
          <div className="line-timeline-year">{yearLabel}</div>
          <div className="line-timeline-track">
            <div className="line-timeline-axis" />

            {/* 时间刻度 */}
            <div className="line-timeline-axis-zone">
              {visibleHourMarks.map((mark) => (
                <div key={mark.key} className="axis-time-mark" style={{ left: `${mark.leftPercent}%` }}>
                  <strong className="axis-hour-label">{mark.label}</strong>
                </div>
              ))}
            </div>

            {/* 日分隔竖线 */}
            {visibleDaySeps.map((day) => {
              const dayStart = startOfDay(day).getTime();
              const dayLeftPercent = totalRangeMs > 0 ? ((dayStart - timeOrigin) / totalRangeMs) * 100 : 0;
              return <div key={`sep-${day}`} className="line-day-separator" style={{ left: `${dayLeftPercent}%` }} />;
            })}

            {/* 周计数括号 */}
            {visibleWeekBrackets.map((week) => {
              const ws = week.start.getTime();
              const we = week.end.getTime() + 86400000;
              const leftPct = totalRangeMs > 0 ? ((ws - timeOrigin) / totalRangeMs) * 100 : 0;
              const widthPct = totalRangeMs > 0 ? ((we - ws) / totalRangeMs) * 100 : 0;
              return (
                <div
                  key={`wk-${week.start.toISOString()}`}
                  className="week-bracket"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  <span className="week-bracket-label">
                    {week.eventCount > 0 && `${week.eventCount}记录`}
                    {week.eventCount > 0 && week.todoCount > 0 && " · "}
                    {week.todoCount > 0 && `${week.todoCount}待办`}
                  </span>
                </div>
              );
            })}

            {/* 每日标签 */}
            {visibleDayLabels.map((day) => {
              const dayStart = startOfDay(day).getTime();
              const dayLeftPercent = totalRangeMs > 0 ? ((dayStart - timeOrigin) / totalRangeMs) * 100 : 0;
              return <div key={day} className="line-day-chip" style={{ left: `${dayLeftPercent}%` }}>{formatDayLabel(day)}</div>;
            })}

            {/* 待办只作为轻量时间节点存在，优先级由纵向位置和颜色表达。 */}
            <div className="timeline-task-layer" aria-label="待办优先级时间轨道">
              {TASK_RAIL_PRIORITIES.map((priority) => (
                <div key={priority} className={`timeline-task-row timeline-task-row-${priority}`}>
                  <span className="timeline-task-row-label">
                    <i aria-hidden="true" />
                    {PRIORITY_LABEL[priority]}
                  </span>
                </div>
              ))}
              {visibleTaskRailItems.map((railItem) => {
                const leftPercent = totalRangeMs > 0
                  ? ((railItem.anchorMs - timeOrigin) / totalRangeMs) * 100
                  : 0;
                const anchorPx = (leftPercent / 100) * shellWidth;
                const bucketWidthPx = totalRangeMs > 0
                  ? ((railItem.bucketEndMs - railItem.bucketStartMs) / totalRangeMs) * shellWidth
                  : 80;
                const nodeWidthPx = Math.max(56, Math.min(136, bucketWidthPx - 10));
                const isExpanded = expandedClusterId === railItem.id;
                const firstTodo = railItem.todos[0];
                const popoverWidthPx = Math.min(280, Math.max(180, containerWidth - 32));
                const popoverLeftPx = Math.min(
                  viewportLeft + containerWidth - 16 - popoverWidthPx,
                  Math.max(viewportLeft + 16, anchorPx - popoverWidthPx / 2),
                );
                const nodeStyle = {
                  left: `${leftPercent}%`,
                  "--task-color": railItem.color,
                  "--task-node-width": `${nodeWidthPx}px`,
                  "--task-popover-width": `${popoverWidthPx}px`,
                  "--task-popover-offset": `${popoverLeftPx - anchorPx}px`,
                } as CSSProperties;

                return (
                  <article
                    key={railItem.id}
                    className={`timeline-task-node timeline-task-node-${railItem.priority}`}
                    style={nodeStyle}
                  >
                    <button
                      type="button"
                      className={`timeline-task-node-button status-${firstTodo.status}`}
                      title={railItem.todos.length === 1 ? railItem.title : `${railItem.todos.length} 项待办`}
                      onClick={() => {
                        if (railItem.todos.length === 1) {
                          onTodoClick?.(firstTodo);
                        } else {
                          setExpandedClusterId((current) => current === railItem.id ? null : railItem.id);
                        }
                      }}
                      aria-expanded={railItem.todos.length > 1 ? isExpanded : undefined}
                    >
                      <span className="timeline-task-node-dot" aria-hidden="true" />
                      <span className="timeline-task-node-title">
                        {railItem.todos.length > 1 ? `${railItem.todos.length} 项任务` : railItem.title}
                      </span>
                      {railItem.todos.length > 1 ? (
                        <span className="timeline-task-node-count">{railItem.todos.length}</span>
                      ) : null}
                    </button>
                    {railItem.todos.length > 1 && isExpanded ? (
                      <div className="timeline-task-popover" role="dialog" aria-label={`${PRIORITY_LABEL[railItem.priority]}优先级待办`} onMouseDown={(event) => event.stopPropagation()}>
                        <strong>{railItem.todos.length} 个{PRIORITY_LABEL[railItem.priority]}优先级待办</strong>
                        {railItem.todos.map((todo) => (
                          <button key={todo.id} type="button" onClick={() => { setExpandedClusterId(null); onTodoClick?.(todo); }}>
                            <span>{todo.title}</span>
                            <small>{todo.dueDate ? formatClock(todo.dueDate) : STATUS_LABEL[todo.status] ?? todo.status}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {/* 工作记录直接显示为时间条：起点准确、持续时间可见，不再使用悬浮卡片。 */}
            {visibleEventStrips.map((item) => {
              const linkedCount = item.eventData.linkedTodoIds?.filter((id) => linkedTodoTitles[id]).length ?? 0;
              const stripStyle = {
                left: `${item.leftPercent}%`,
                "--event-color": item.color,
                "--event-lane-offset": `${item.lane * 28}px`,
                "--event-label-width": `${item.labelWidthPx}px`,
                "--event-duration-width": `${item.durationWidthPx}px`,
              } as CSSProperties;

              return (
                <article
                  key={`event-${item.id}`}
                  className="timeline-event-strip"
                  style={stripStyle}
                >
                  <span className="timeline-event-duration" aria-hidden="true" />
                  <button
                    className="timeline-event-strip-button"
                    type="button"
                    title={[
                      `${formatClock(item.startTime)} — ${formatClock(item.endTime)}`,
                      item.title,
                      item.eventData.detail,
                    ].filter(Boolean).join("\n")}
                    onClick={() => onEventClick?.(item.eventData)}
                  >
                    <span className="timeline-event-strip-time">{formatClock(item.startTime)}</span>
                    <strong>{item.title}</strong>
                    {linkedCount > 0 ? (
                      <span className="timeline-event-link-count">↗{linkedCount}</span>
                    ) : null}
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
