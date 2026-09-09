import { EventItem, Priority, TodoItem } from "@/types";

// ============================================================
// 时间轴纯布局逻辑：统一条目转换、lane 分配、周聚合。
// 不依赖 React / DOM，便于单元测试。
// ============================================================

export const MIN_SCALE = 0.03;
export const MAX_SCALE = 24;
export const SCALE_STEP = 0.05;
export const BASE_VISIBLE_DAYS = 1;
export const EVENT_COLORS = ["#5fa86e", "#8c6fd1", "#4f9d9d", "#c96f91", "#7ea95b", "#5b8fc9"];
export const TODO_COLORS = ["#e8964a", "#d97050", "#c98a4f", "#e0a040", "#d97842", "#e8883a"];
export const TODO_PRIORITY_COLORS: Record<Priority, string> = {
  high: "#c95d6f",
  medium: "#d58a3d",
  low: "#789681",
};
export const FULL_CARD_MIN_WIDTH = 60;
export const FULL_CARD_MAX_WIDTH = 320;
export const CARD_HORIZONTAL_GAP = 6;
export const LANE_HEIGHT = 108;
export const TRACK_PADDING = 32;
export const TODO_MIN_DURATION_MS = 30 * 60 * 1000; // 待办最低 30 分钟宽

export const PRIORITY_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" };
export const STATUS_LABEL: Record<string, string> = {
  pending: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};

export type TimelineDensity = "low" | "medium" | "high";
export type TimelineDisplayMode = "full" | "compact" | "marker";

/** 统一的时间轴条目 */
export type TimelineItem = {
  kind: "event" | "todo";
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  detail?: string;
  tags: string[];
  // event-specific
  eventData?: EventItem;
  // todo-specific
  todoData?: TodoItem;
  displayMode?: TimelineDisplayMode;
  clusterTodos?: TodoItem[];
};

/** 已分配 lane / 颜色的稳定条目（仅依赖数据 + 时间范围） */
export type StableItem = TimelineItem & {
  color: string;
  stack: number;
  side: "top" | "bottom";
  leftPercent: number;
  widthPercent: number;
};

export type PositionedTimelineItem = StableItem & {
  cardLeftPx: number;
  cardOffsetXPx: number;
  cardOffsetYPx: number;
  cardWidthPx: number;
  cardHeightPx: number;
};

type PlacedCard = {
  left: number;
  right: number;
  near: number;
  far: number;
};

export function getTimelineDensity(visibleDays: number): TimelineDensity {
  if (visibleDays <= 2) return "low";
  if (visibleDays <= 10) return "medium";
  return "high";
}

function formatLocalDate(date: Date): string {
  const pad2 = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function lowPriorityBucket(item: TimelineItem, density: TimelineDensity): string {
  if (density === "medium") return item.startTime.slice(0, 10);
  const monday = startOfDay(item.startTime);
  const dayFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayFromMonday);
  return formatLocalDate(monday);
}

/**
 * 根据可见时间跨度降低任务信息密度。
 * 工作记录保持原样；低优先级任务在中/远景按日或按周聚合。
 */
export function prepareTimelineItems(
  items: TimelineItem[],
  density: TimelineDensity,
): TimelineItem[] {
  if (density === "low") {
    return items.map((item) =>
      item.kind === "todo" ? { ...item, displayMode: "full" as const } : item,
    );
  }

  const prepared: TimelineItem[] = [];
  const lowGroups = new Map<string, TimelineItem[]>();

  items.forEach((item) => {
    if (item.kind !== "todo" || !item.todoData) {
      prepared.push(item);
      return;
    }

    if (item.todoData.priority === "high") {
      prepared.push({ ...item, displayMode: "full" });
      return;
    }

    if (item.todoData.priority === "medium") {
      prepared.push({ ...item, displayMode: "compact" });
      return;
    }

    const bucket = lowPriorityBucket(item, density);
    lowGroups.set(bucket, [...(lowGroups.get(bucket) ?? []), item]);
  });

  lowGroups.forEach((group, bucket) => {
    const representative = group[0];
    const clusterTodos = group
      .map((item) => item.todoData)
      .filter((todo): todo is TodoItem => todo !== undefined);
    prepared.push({
      ...representative,
      id: `todo-cluster-${density}-${bucket}`,
      title: clusterTodos.length > 1 ? `+${clusterTodos.length}` : "低",
      tags: [],
      displayMode: "marker",
      clusterTodos,
    });
  });

  return prepared.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
}

function getCardMetrics(
  item: StableItem,
  naturalWidthPx: number,
  density: TimelineDensity,
  shellWidth: number,
) {
  const availableWidth = Math.max(56, shellWidth - TRACK_PADDING * 2);

  if (item.kind === "event") {
    return {
      width: Math.min(availableWidth, FULL_CARD_MAX_WIDTH, Math.max(FULL_CARD_MIN_WIDTH, naturalWidthPx)),
      height: 140,
    };
  }

  if (item.displayMode === "marker") {
    return { width: Math.min(availableWidth, 54), height: 30 };
  }

  if (item.displayMode === "compact") {
    return {
      width: Math.min(availableWidth, density === "high" ? 112 : 136),
      height: 42,
    };
  }

  const preferredWidth = density === "low" ? 190 : density === "medium" ? 174 : 158;
  const preferredHeight = density === "low" ? 84 : density === "medium" ? 72 : 66;
  return {
    width: Math.min(availableWidth, Math.max(preferredWidth, naturalWidthPx)),
    height: preferredHeight,
  };
}

function itemPriorityRank(item: StableItem): number {
  if (item.kind === "event") return 0;
  if (item.todoData?.priority === "high") return 0;
  if (item.todoData?.priority === "medium") return 1;
  return 2;
}

function cardsOverlap(a: PlacedCard, b: PlacedCard): boolean {
  const horizontal = a.left < b.right + CARD_HORIZONTAL_GAP && a.right + CARD_HORIZONTAL_GAP > b.left;
  const vertical = a.near < b.far + CARD_HORIZONTAL_GAP && a.far + CARD_HORIZONTAL_GAP > b.near;
  return horizontal && vertical;
}

/**
 * 将卡片围绕真实时间锚点做二维装箱。
 * 同一纵向带内可左右错位复用空间；重要任务先放置，优先占用靠近轴线的位置。
 */
export function layoutTimelineCards(
  items: StableItem[],
  shellWidth: number,
  density: TimelineDensity,
): PositionedTimelineItem[] {
  if (!items.length || shellWidth <= 0) return [];

  const placed = { top: [] as PlacedCard[], bottom: [] as PlacedCard[] };
  const layoutById = new Map<
    string,
    Pick<PositionedTimelineItem, "side" | "cardLeftPx" | "cardOffsetXPx" | "cardOffsetYPx" | "cardWidthPx" | "cardHeightPx">
  >();
  const ordered = [...items].sort((a, b) => {
    const rankDiff = itemPriorityRank(a) - itemPriorityRank(b);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  ordered.forEach((item) => {
    const anchorPx = (item.leftPercent / 100) * shellWidth;
    const naturalWidthPx = Math.max(40, (item.widthPercent / 100) * shellWidth);
    const metrics = getCardMetrics(item, naturalWidthPx, density, shellWidth);
    const maxLeft = Math.max(TRACK_PADDING, shellWidth - TRACK_PADDING - metrics.width);
    const horizontalOffsets = item.kind === "event"
      ? [0, -metrics.width / 2, -metrics.width + 12, -metrics.width * 0.25, -metrics.width * 0.75]
      : [-metrics.width / 2, 0, -metrics.width + 12, -metrics.width * 0.25, -metrics.width * 0.75];
    const preferredSide = item.side;
    const sideCandidates: Array<"top" | "bottom"> = [
      preferredSide,
      preferredSide === "top" ? "bottom" : "top",
    ];

    let best:
      | { side: "top" | "bottom"; left: number; near: number; score: number }
      | undefined;

    const searchLimit = Math.max(
      18,
      ...placed.top.map((card) => card.far + metrics.height + CARD_HORIZONTAL_GAP),
      ...placed.bottom.map((card) => card.far + metrics.height + CARD_HORIZONTAL_GAP),
    );
    for (let near = 18; near <= searchLimit; near += 34) {
      sideCandidates.forEach((side, sideIndex) => {
        horizontalOffsets.forEach((offset) => {
          const left = Math.min(maxLeft, Math.max(TRACK_PADDING, anchorPx + offset));
          const candidate: PlacedCard = {
            left,
            right: left + metrics.width,
            near,
            far: near + metrics.height,
          };
          if (placed[side].some((existing) => cardsOverlap(candidate, existing))) return;

          const cardCenterPx = left + metrics.width / 2;
          const anchorDistance = item.kind === "event"
            ? Math.abs(left - anchorPx)
            : Math.abs(cardCenterPx - anchorPx);
          const score = near + sideIndex * 10 + anchorDistance * 0.04;
          if (!best || score < best.score) best = { side, left, near, score };
        });
      });
      if (best && best.near <= near) break;
    }

    const chosen = best ?? {
      side: preferredSide,
      left: Math.min(maxLeft, Math.max(TRACK_PADDING, anchorPx - metrics.width / 2)),
      near: searchLimit + 34,
      score: Number.MAX_SAFE_INTEGER,
    };
    placed[chosen.side].push({
      left: chosen.left,
      right: chosen.left + metrics.width,
      near: chosen.near,
      far: chosen.near + metrics.height,
    });
    layoutById.set(`${item.kind}:${item.id}`, {
      side: chosen.side,
      cardLeftPx: chosen.left,
      cardOffsetXPx: chosen.left - anchorPx,
      cardOffsetYPx: chosen.near,
      cardWidthPx: metrics.width,
      cardHeightPx: metrics.height,
    });
  });

  return items.map((item) => ({
    ...item,
    ...(layoutById.get(`${item.kind}:${item.id}`) ?? {
      side: item.side,
      cardLeftPx: (item.leftPercent / 100) * shellWidth,
      cardOffsetXPx: 0,
      cardOffsetYPx: 18,
      cardWidthPx: FULL_CARD_MIN_WIDTH,
      cardHeightPx: 140,
    }),
  }));
}

export type WeekBracket = {
  start: Date;
  end: Date;
  eventCount: number;
  todoCount: number;
};

export function startOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: string): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

export function formatClock(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

/** 将 EventItem 转为 TimelineItem */
export function eventToTimeline(event: EventItem): TimelineItem {
  return {
    kind: "event",
    id: event.id,
    startTime: event.startTime,
    endTime: event.endTime,
    title: event.title,
    detail: event.detail,
    tags: event.tags,
    eventData: event,
  };
}

/** 将 TodoItem 转为 TimelineItem（锚定 dueDate 或 startTime） */
export function todoToTimeline(todo: TodoItem): TimelineItem {
  const anchor = todo.startTime || todo.dueDate;
  if (!anchor) {
    // 没有时间的待办：放到当天中午
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const d = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const noon = `${d}T12:00:00`;
    const end = new Date(new Date(noon).getTime() + TODO_MIN_DURATION_MS);
    const endStr = `${d}T${pad2(end.getHours())}:${pad2(end.getMinutes())}:00`;
    return {
      kind: "todo",
      id: todo.id,
      startTime: noon,
      endTime: endStr,
      title: todo.title,
      detail: todo.remarks,
      tags: todo.tags,
      todoData: todo,
    };
  }

  const startMs = new Date(anchor).getTime();
  const endMs = startMs + TODO_MIN_DURATION_MS;
  const endDate = new Date(endMs);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const d = (s: string) => s.slice(0, 10);
  const anchorStr = anchor.slice(0, 19);
  const endStr = `${d(anchor)}T${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}:00`;

  return {
    kind: "todo",
    id: todo.id,
    startTime: anchorStr,
    endTime: endStr,
    title: todo.title,
    detail: todo.remarks,
    tags: todo.tags,
    todoData: todo,
  };
}

/**
 * 分配 lane（上下交错贪心）、颜色、左右百分比位置。
 * 纯函数：相同输入必然相同输出。
 */
export function assignLanes(
  allItems: TimelineItem[],
  timeOrigin: number,
  totalRangeMs: number,
): StableItem[] {
  // 分离 top/bottom 两个 lane 池，强制上下交错
  const topLaneEnds: number[] = [];
  const bottomLaneEnds: number[] = [];
  let lastSide: "top" | "bottom" = "bottom"; // 首个条目优先放上方

  let eventColorIdx = 0;
  let todoColorIdx = 0;

  return allItems.map((item) => {
    const startMs = new Date(item.startTime).getTime();
    const endMs = new Date(item.endTime).getTime();
    const startMinute = (startMs - timeOrigin) / 60000;
    const endMinute = (endMs - timeOrigin) / 60000;

    // 优先选与上一个条目相反的一侧
    const prefSide: "top" | "bottom" = lastSide === "top" ? "bottom" : "top";
    const altSide: "top" | "bottom" = prefSide === "top" ? "bottom" : "top";

    const prefLanes = prefSide === "top" ? topLaneEnds : bottomLaneEnds;
    const altLanes = altSide === "top" ? topLaneEnds : bottomLaneEnds;

    let side: "top" | "bottom";
    let stack: number;

    // 1) 优先选反侧的空闲 lane
    const prefIdx = prefLanes.findIndex((v) => v <= startMinute);
    if (prefIdx !== -1) {
      side = prefSide;
      stack = prefIdx;
      prefLanes[prefIdx] = endMinute;
    } else {
      // 2) 反侧无空闲，尝试同侧
      const altIdx = altLanes.findIndex((v) => v <= startMinute);
      if (altIdx !== -1) {
        side = altSide;
        stack = altIdx;
        altLanes[altIdx] = endMinute;
      } else {
        // 3) 两侧都满了，在反侧新开一层
        side = prefSide;
        stack = prefLanes.length;
        prefLanes.push(endMinute);
      }
    }

    lastSide = side;

    const leftPercent = totalRangeMs > 0 ? ((startMs - timeOrigin) / totalRangeMs) * 100 : 0;
    const widthPercent = totalRangeMs > 0 ? (Math.max(60000, endMs - startMs) / totalRangeMs) * 100 : 0;

    const colors = item.kind === "todo" ? TODO_COLORS : EVENT_COLORS;
    const colorIndex = item.kind === "todo" ? todoColorIdx++ : eventColorIdx++;
    const todoPriorityColor = item.kind === "todo" && item.todoData
      ? TODO_PRIORITY_COLORS[item.todoData.priority]
      : undefined;

    return {
      ...item,
      stack,
      side,
      color: todoPriorityColor ?? colors[Math.max(0, colorIndex) % colors.length],
      leftPercent,
      widthPercent,
    };
  });
}

/**
 * 按周聚合计数（以周一为起始对齐）。
 * 返回仅包含有数据的周，按开始时间升序。
 */
export function buildWeekBrackets(allItems: TimelineItem[]): WeekBracket[] {
  const weekMap = new Map<number, WeekBracket>();

  for (const item of allItems) {
    const d = new Date(item.startTime);
    const dayOfWeek = d.getDay();
    // 周日(0)→上周一，周一(1)→当天，周二(2)→昨天... 周六(6)→上周五
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const weekKey = monday.getTime();

    if (!weekMap.has(weekKey)) {
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      weekMap.set(weekKey, { start: monday, end: sunday, eventCount: 0, todoCount: 0 });
    }

    const entry = weekMap.get(weekKey)!;
    if (item.kind === "event") entry.eventCount++;
    else entry.todoCount++;
  }

  return Array.from(weekMap.values())
    .filter((w) => w.eventCount > 0 || w.todoCount > 0)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
