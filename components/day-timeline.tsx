"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EventItem, TodoItem } from "@/types";
import { AdaptiveDayView } from "./adaptive-day-view";
import { AdaptiveThreeDayView } from "./adaptive-three-day-view";
import { AdaptiveWeekView } from "./adaptive-week-view";
import { AdaptiveMonthView } from "./adaptive-month-view";
import { TimelineDetailPanel, type TimelineSelection } from "./timeline-detail-panel";
import { TimelinePopover } from "./timeline-popover";
import { ADAPTIVE_VIEW_DAYS, ADAPTIVE_VIEW_ORDER, adaptiveViewForDays, buildDaySummaries, dateLabel,
  eventInterval, localDateKey, shiftDate, startOfLocalDay, todoAnchorMs, type AdaptiveTimelineView } from "@/lib/timeline-adaptive";

type Props = { events: EventItem[]; todos?: TodoItem[]; onEventClick?: (event: EventItem) => void; onTodoClick?: (todo: TodoItem) => void };
const viewTitles = { day: "1 天 · 详细时间", three: "3 天 · 时间分布", week: "7 天 · 每日节奏", month: "30 天 · 密度趋势" };

export function DayTimeline({ events, todos = [], onEventClick, onTodoClick }: Props) {
  const [view, setView] = useState<AdaptiveTimelineView>("day");
  const [focusDate, setFocusDate] = useState(() => localDateKey(new Date()));
  const [selection, setSelection] = useState<TimelineSelection>(null);
  const [now, setNow] = useState(() => Date.now());
  const [viewportWidth, setViewportWidth] = useState(900);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomDays = useRef(1);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [todayRequest, setTodayRequest] = useState(0);
  const dayCount = ADAPTIVE_VIEW_DAYS[view];
  const start = useMemo(() => startOfLocalDay(focusDate), [focusDate]);
  const summaries = useMemo(() => buildDaySummaries(+start, dayCount, todos, events), [start, dayCount, todos, events]);
  const unscheduled = useMemo(() => todos.filter(t => t.status !== "cancelled" && todoAnchorMs(t) === null), [todos]);
  const invalidEvents = useMemo(() => events.filter(e => !eventInterval(e)), [events]);
  const canvasWidth = Math.max(viewportWidth, view === "day" ? 2400 : view === "three" ? 630 : view === "week" ? 630 : 900);
  const showDetail = (view === "day" || view === "three") && selection !== null &&
    (selection.kind === "todo" ? todos.some(t => t.id === selection.id) : events.some(e => e.id === selection.id));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setViewportWidth(node.clientWidth));
    setViewportWidth(node.clientWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const current = new Date();
    const centerNow = todayRequest > 0 && focusDate === localDateKey(current);
    const startMs = +startOfLocalDay(focusDate);
    const duration = +startOfLocalDay(shiftDate(focusDate, 1)) - startMs;
    node.scrollLeft = view !== "day" ? 0 : centerNow
      ? Math.max(0, canvasWidth * (+current - startMs) / duration - node.clientWidth / 2)
      : Math.min(canvasWidth * 7 / 24, canvasWidth - node.clientWidth);
  }, [view, focusDate, canvasWidth, todayRequest]);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) return;
      if (event.deltaY === 0) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1);
      zoomDays.current = Math.min(30, Math.max(1, zoomDays.current * Math.exp(delta / 450)));
      setView(adaptiveViewForDays(zoomDays.current));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);
  const chooseView = (next: AdaptiveTimelineView) => { zoomDays.current = ADAPTIVE_VIEW_DAYS[next]; setView(next); };
  const openDay = (key: string) => { setFocusDate(key); chooseView("day"); };
  const onTodo = (todo: TodoItem) => setSelection({ kind: "todo", id: todo.id });
  const onEvent = (event: EventItem) => setSelection({ kind: "event", id: event.id });
  const detailedProps = { date: start, events, todos, now, width: canvasWidth, onEventClick: onEvent, onTodoClick: onTodo };
  return <div className={"at-root at-mode-" + view} data-view={view}>
    <div className="at-toolbar">
      <div className="at-view-switch" role="group" aria-label="时间轴展示模式">{ADAPTIVE_VIEW_ORDER.map(mode =>
        <button key={mode} type="button" aria-pressed={view === mode} onClick={() => chooseView(mode)}>{ADAPTIVE_VIEW_DAYS[mode]}天</button>)}</div>
      <div className="at-navigation">
        <button type="button" aria-label="前一时间段" onClick={() => setFocusDate(shiftDate(focusDate, -dayCount))}>‹</button>
        <label className="at-date-input"><span className="sr-only">跳转日期</span><input type="date" aria-label="跳转日期" value={focusDate}
          onChange={event => { if (event.target.value) setFocusDate(event.target.value); }} /></label>
        <button type="button" aria-label="后一时间段" onClick={() => setFocusDate(shiftDate(focusDate, dayCount))}>›</button>
        <button type="button" onClick={() => { setFocusDate(localDateKey(new Date())); setNow(Date.now()); setTodayRequest(value => value + 1); }}>今天</button>
      </div>
    </div>
    <div className="at-heading"><strong>{viewTitles[view]}</strong><span>{dateLabel(start)}{dayCount > 1 ? " — " + dateLabel(shiftDate(start, dayCount - 1)) : ""}</span></div>
    <div className={"at-layout" + (showDetail ? " has-detail" : "")}>
      <div className="at-primary">
        <div className="at-time-area">
          <div className="at-row-labels"><span>时间</span><strong>{view === "month" ? "待办密度" : "待办任务"}</strong><strong>{view === "month" ? "工作密度" : "工作记录"}{view === "day" || view === "three" ? <small>最多 3 层</small> : null}</strong></div>
          <div className={"at-scroll" + (dragging ? " is-dragging" : "")} ref={scrollRef} aria-label="可缩放时间轴" tabIndex={0}
            onPointerDown={event => {
              if (event.button !== 0 || (event.target as HTMLElement).closest("button,input")) return;
              drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
              event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
            }}
            onPointerMove={event => {
              if (drag.current) event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
            }}
            onPointerUp={event => {
              const origin = drag.current;
              if (!origin) return;
              const desired = origin.left - (event.clientX - origin.x);
              const max = event.currentTarget.scrollWidth - event.currentTarget.clientWidth;
              const excess = desired < 0 ? desired : desired > max ? desired - max : 0;
              if (Math.abs(excess) > 60) setFocusDate(shiftDate(focusDate, Math.sign(excess) * Math.max(1, Math.round(Math.abs(excess) / (canvasWidth / dayCount)))));
              drag.current = null; setDragging(false);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { drag.current = null; setDragging(false); }}
          >
            <div className="at-canvas" style={{ width: canvasWidth }} key={view + focusDate}>
              {view === "day" && <AdaptiveDayView {...detailedProps} />}
              {view === "three" && <AdaptiveThreeDayView {...detailedProps} />}
              {view === "week" && <AdaptiveWeekView days={summaries} onDayClick={openDay} now={now} />}
              {view === "month" && <AdaptiveMonthView days={summaries} onDayClick={openDay} now={now} />}
            </div>
          </div>
        </div>
        <div className="at-footer"><span>滚轮切换密度 · Shift + 滚轮横移 · 拖拽平移</span>
          {(view === "week" || view === "month") && <span>工时为记录时长之和，跨日分摊</span>}
          <span className="at-legend"><i className="high" />高<i className="medium" />中<i className="low" />低</span>
        </div>
        {(unscheduled.length > 0 || invalidEvents.length > 0) && <div className="at-unplaced">
          {unscheduled.length > 0 && <TimelinePopover label={"未安排时间 · " + unscheduled.length + "项待办"} trigger={"未安排时间 · " + unscheduled.length + "项待办"}>
            {unscheduled.map(todo => <button key={todo.id} type="button" onClick={() => onTodo(todo)}>{todo.title}</button>)}
          </TimelinePopover>}
          {invalidEvents.length > 0 && <TimelinePopover label={"时间异常 · " + invalidEvents.length + "条记录"} trigger={"时间异常 · " + invalidEvents.length + "条记录"}>
            {invalidEvents.map(event => <button key={event.id} type="button" onClick={() => onEvent(event)}>{event.title}</button>)}
          </TimelinePopover>}
        </div>}
      </div>
      {showDetail && <TimelineDetailPanel selection={selection} todos={todos} events={events} onSelect={setSelection} onEditTodo={onTodoClick} onEditEvent={onEventClick} />}
    </div>
  </div>;
}
