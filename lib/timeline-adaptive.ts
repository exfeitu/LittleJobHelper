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
export function buildDetailedTodoMarkers(
  todos: TodoItem[],
  clusterMinutes = 40,
  clusterAt = 3,
): DetailedTodoMarker[] {
  const threshold = clusterMinutes * 60_000;
  const ordered = todos
    .filter((todo) => todo.status !== "cancelled")
    .map((todo) => ({ todo, anchorMs: todoAnchorMs(todo) }))
    .sort((a, b) => a.anchorMs - b.anchorMs);

  const groups: Array<Array<{ todo: TodoItem; anchorMs: number }>> = [];
  for (const entry of ordered) {
    const current = groups[groups.length - 1];
    if (!current || entry.anchorMs - current[current.length - 1].anchorMs > threshold) {
      groups.push([entry]);
    } else {
      current.push(entry);
    }
  }

  return groups.flatMap((group): DetailedTodoMarker[] => {
    if (group.length >= clusterAt) {
      return [{
        kind: "cluster" as const,
        id: `todo-cluster-${group[0].anchorMs}`,
        anchorMs: Math.round(group.reduce((sum, item) => sum + item.anchorMs, 0) / group.length),
        todos: group.map((item) => item.todo),
      }];
    }
    return group.map((item, index) => ({
      kind: "item" as const,
      id: item.todo.id,
      anchorMs: item.anchorMs,
      lane: index,
      todo: item.todo,
    }));
  });
}

export function layoutDetailedEvents(
  events: EventItem[],
  rangeStartMs: number,
  rangeEndMs: number,
  maxLanes = 3,
): DetailedEventLayout {
  const total = Math.max(1, rangeEndMs - rangeStartMs);
  const laneEnds = Array.from({ length: maxLanes }, () => Number.NEGATIVE_INFINITY);
  const visible: DetailedEventBand[] = [];
  const hidden: EventItem[] = [];
  const ordered = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  for (const event of ordered) {
    const rawStart = new Date(event.startTime).getTime();
    const rawEnd = Math.max(rawStart + 60_000, new Date(event.endTime).getTime());
    if (rawStart >= rangeEndMs || rawEnd <= rangeStartMs) continue;
    const startMs = Math.max(rawStart, rangeStartMs);
    const endMs = Math.min(rawEnd, rangeEndMs);
    const lane = laneEnds.findIndex((laneEnd) => rawStart >= laneEnd);
    if (lane === -1) {
      hidden.push(event);
      continue;
    }
    laneEnds[lane] = rawEnd;
    visible.push({
      event,
      lane,
      leftPercent: ((startMs - rangeStartMs) / total) * 100,
      widthPercent: Math.max(0.4, ((endMs - startMs) / total) * 100),
    });
  }

  const overflow: OverflowEventGroup[] = [];
  for (const event of hidden) {
    const startMs = new Date(event.startTime).getTime();
    const endMs = Math.max(startMs + 60_000, new Date(event.endTime).getTime());
    let group = overflow.find((candidate) =>
      candidate.events.some((existing) => {
        const existingStart = new Date(existing.startTime).getTime();
        const existingEnd = Math.max(existingStart + 60_000, new Date(existing.endTime).getTime());
        return startMs < existingEnd && endMs > existingStart;
      }),
    );
    if (!group) {
      group = {
        id: `event-overflow-${startMs}`,
        anchorMs: startMs,
        events: [],
      };
      overflow.push(group);
    }
    group.events.push(event);
  }

  return { visible, overflow };
}
export function buildDaySummaries(
  startDayMs: number,
  dayCount: number,
  todos: TodoItem[],
  events: EventItem[],
): DayTimelineSummary[] {
  const summaries: DayTimelineSummary[] = [];

  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = new Date(startDayMs);
    date.setDate(date.getDate() + offset);
    date.setHours(0, 0, 0, 0);
    const startMs = date.getTime();
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const endMs = end.getTime();

    const dayTodos = todos.filter((todo) => {
      if (todo.status === "cancelled") return false;
      const anchor = todoAnchorMs(todo, startMs);
      return anchor >= startMs && anchor < endMs;
    });
    const dayEvents = events.filter((event) => {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = Math.max(eventStart + 60_000, new Date(event.endTime).getTime());
      return eventStart < endMs && eventEnd > startMs;
    });

    summaries.push({
      dateKey: localDateKey(date),
      date,
      todos: dayTodos,
      events: dayEvents,
      priorityCounts: {
        high: dayTodos.filter((todo) => todo.priority === "high").length,
        medium: dayTodos.filter((todo) => todo.priority === "medium").length,
        low: dayTodos.filter((todo) => todo.priority === "low").length,
      },
      eventHours: dayEvents.reduce((sum, event) => {
        const eventStart = Math.max(startMs, new Date(event.startTime).getTime());
        const eventEnd = Math.min(endMs, new Date(event.endTime).getTime());
        return sum + Math.max(0, eventEnd - eventStart) / 3_600_000;
      }, 0),
    });
  }

  return summaries;
}

export function densityLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil((value / max) * 5)));
}

export function timeOfDayPercent(value: string | Date): number {
  const date = new Date(value);
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  return (minutes / (24 * 60)) * 100;
}
