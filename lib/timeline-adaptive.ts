import { EventItem, Priority, TodoItem } from "@/types";

export type AdaptiveTimelineView = "day" | "three" | "week" | "month";

export const ADAPTIVE_VIEW_DAYS: Record<AdaptiveTimelineView, number> = {
  day: 1,
  three: 3,
  week: 7,
  month: 30,
};

export const ADAPTIVE_VIEW_ORDER: AdaptiveTimelineView[] = [
  "day",
  "three",
  "week",
  "month",
];

export type TimelineWindow = {
  view: AdaptiveTimelineView;
  start: Date;
  end: Date;
  startMs: number;
  endMs: number;
  dayCount: number;
};

export function adaptiveViewForDays(visibleDays: number): AdaptiveTimelineView {
  if (visibleDays <= 1.75) return "day";
  if (visibleDays <= 4.5) return "three";
  if (visibleDays <= 10) return "week";
  return "month";
}
export function adaptiveViewScale(view: AdaptiveTimelineView): number {
  return 1 / ADAPTIVE_VIEW_DAYS[view];
}

export function adjacentAdaptiveView(
  view: AdaptiveTimelineView,
  direction: "in" | "out",
): AdaptiveTimelineView {
  const index = ADAPTIVE_VIEW_ORDER.indexOf(view);
  const nextIndex = direction === "in"
    ? Math.max(0, index - 1)
    : Math.min(ADAPTIVE_VIEW_ORDER.length - 1, index + 1);
  return ADAPTIVE_VIEW_ORDER[nextIndex];
}

export function startOfLocalDay(value: string | Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function localDateKey(value: string | Date): string {
  const date = new Date(value);
  const pad2 = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
export function buildTimelineWindow(
  focusDate: string | Date,
  view: AdaptiveTimelineView,
): TimelineWindow {
  const start = startOfLocalDay(focusDate);
  const dayCount = ADAPTIVE_VIEW_DAYS[view];
  const end = new Date(start);
  end.setDate(end.getDate() + dayCount);
  return {
    view,
    start,
    end,
    startMs: start.getTime(),
    endMs: end.getTime(),
    dayCount,
  };
}

export function shiftFocusDate(
  focusDate: string | Date,
  view: AdaptiveTimelineView,
  direction: -1 | 1,
): string {
  const date = startOfLocalDay(focusDate);
  date.setDate(date.getDate() + ADAPTIVE_VIEW_DAYS[view] * direction);
  return localDateKey(date);
}

export function eventOverlapsWindow(event: EventItem, window: TimelineWindow): boolean {
  const start = new Date(event.startTime).getTime();
  const end = Math.max(start + 60_000, new Date(event.endTime).getTime());
  return start < window.endMs && end > window.startMs;
}
export function todoAnchorMs(todo: TodoItem, fallbackDayMs?: number): number {
  const source = todo.startTime || todo.dueDate;
  if (source) {
    const parsed = new Date(source).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  if (fallbackDayMs !== undefined) return fallbackDayMs + 12 * 60 * 60 * 1000;
  const today = startOfLocalDay(new Date());
  return today.getTime() + 12 * 60 * 60 * 1000;
}

export function todosInWindow(todos: TodoItem[], window: TimelineWindow): TodoItem[] {
  return todos.filter((todo) => {
    if (todo.status === "cancelled") return false;
    const anchor = todoAnchorMs(todo, window.startMs);
    return anchor >= window.startMs && anchor < window.endMs;
  });
}

export function eventsInWindow(events: EventItem[], window: TimelineWindow): EventItem[] {
  return events.filter((event) => eventOverlapsWindow(event, window));
}

export type DetailedTodoMarker =
  | { kind: "item"; id: string; anchorMs: number; lane: number; todo: TodoItem }
  | { kind: "cluster"; id: string; anchorMs: number; todos: TodoItem[] };
export type DetailedEventBand = {
  event: EventItem;
  lane: number;
  leftPercent: number;
  widthPercent: number;
};

export type OverflowEventGroup = {
  id: string;
  anchorMs: number;
  events: EventItem[];
};

export type DetailedEventLayout = {
  visible: DetailedEventBand[];
  overflow: OverflowEventGroup[];
};

export type DayTimelineSummary = {
  dateKey: string;
  date: Date;
  todos: TodoItem[];
  events: EventItem[];
  priorityCounts: Record<Priority, number>;
  eventHours: number;
};

const DAY_MS = 86_400_000;
