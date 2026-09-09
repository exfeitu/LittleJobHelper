import { describe, expect, it } from "vitest";
import {
  assignLanes,
  buildWeekBrackets,
  getTimelineDensity,
  layoutTimelineCards,
  prepareTimelineItems,
  todoToTimeline,
} from "@/lib/timeline-layout";
import type { TodoItem } from "@/types";

const ORIGIN = new Date("2026-01-01T00:00:00").getTime();
const DAY_MS = 86400000;

function item(id: string, startHour: number, kind: "event" | "todo" = "event") {
  const start = `${new Date(ORIGIN + startHour * 3600000).toISOString()}`;
  return {
    kind,
    id,
    startTime: start,
    endTime: new Date(ORIGIN + (startHour + 1) * 3600000).toISOString(),
    title: id,
    tags: [],
  };
}

function todo(id: string, priority: TodoItem["priority"], startTime: string): TodoItem {
  return {
    id,
    title: id,
    startTime,
    priority,
    status: "pending",
    tags: [],
    parentId: null,
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("assignLanes", () => {
  it("返回含 stack/side/color/百分比的稳定条目", () => {
    const items = [item("a", 9), item("b", 10)];
    const result = assignLanes(items, ORIGIN, DAY_MS);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: "event", side: expect.any(String), stack: expect.any(Number) });
    expect(result[0].leftPercent).toBeGreaterThan(0);
    expect(result[0].widthPercent).toBeGreaterThan(0);
  });

  it("重叠条目分配到不同 side/lane", () => {
    const items = [item("a", 9), item("b", 9.5)];
    const result = assignLanes(items, ORIGIN, DAY_MS);
    expect(result[0].side).not.toBe(result[1].side);
  });

  it("颜色循环分配且每种类型独立", () => {
    const items = [item("a", 9, "event"), item("b", 10, "todo")];
    const result = assignLanes(items, ORIGIN, DAY_MS);
    expect(result[0].color).toMatch(/^#/);
    expect(result[1].color).toMatch(/^#/);
  });
});

describe("buildWeekBrackets", () => {
  it("聚合同一周内的条目计数", () => {
    const items = [item("a", 9), item("b", 30), item("c", 50, "todo")];
    const brackets = buildWeekBrackets(items);
    expect(brackets).toHaveLength(1);
    expect(brackets[0].eventCount).toBe(2);
    expect(brackets[0].todoCount).toBe(1);
  });
});

describe("todoToTimeline", () => {
  it("无时间待办锚定到当天中午", () => {
    const todo: TodoItem = {
      id: "t1",
      title: "无时间",
      priority: "medium",
      status: "pending",
      tags: [],
      parentId: null,
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const tl = todoToTimeline(todo);
    expect(tl.kind).toBe("todo");
    expect(tl.startTime).toMatch(/T12:00:00/);
  });

  it("有 startTime 时以 startTime 为锚点，宽度不低于 30 分钟", () => {
    const todo: TodoItem = {
      id: "t2",
      title: "有时间",
      startTime: "2026-01-05T14:00:00",
      priority: "medium",
      status: "pending",
      tags: [],
      parentId: null,
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const tl = todoToTimeline(todo);
    expect(tl.startTime).toBe("2026-01-05T14:00:00");
    const dur = new Date(tl.endTime).getTime() - new Date(tl.startTime).getTime();
    expect(dur).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });
});

describe("timeline density", () => {
  it("根据可见天数切换密度", () => {
    expect(getTimelineDensity(1)).toBe("low");
    expect(getTimelineDensity(2)).toBe("low");
    expect(getTimelineDensity(7)).toBe("medium");
    expect(getTimelineDensity(10)).toBe("medium");
    expect(getTimelineDensity(30)).toBe("high");
  });

  it("中密度保留高优先级、压缩中优先级并按日聚合低优先级", () => {
    const source = [
      todo("high", "high", "2026-01-05T09:00:00"),
      todo("medium", "medium", "2026-01-05T10:00:00"),
      todo("low-a", "low", "2026-01-05T11:00:00"),
      todo("low-b", "low", "2026-01-05T12:00:00"),
    ].map(todoToTimeline);

    const prepared = prepareTimelineItems(source, "medium");
    expect(prepared).toHaveLength(3);
    expect(prepared.find((entry) => entry.todoData?.id === "high")?.displayMode).toBe("full");
    expect(prepared.find((entry) => entry.todoData?.id === "medium")?.displayMode).toBe("compact");
    const cluster = prepared.find((entry) => entry.displayMode === "marker");
    expect(cluster?.clusterTodos).toHaveLength(2);
    expect(cluster?.title).toBe("+2");
  });

  it("低密度完整显示全部任务，高密度按周聚合低优先级任务", () => {
    const source = [
      todo("high", "high", "2026-01-05T09:00:00"),
      todo("medium", "medium", "2026-01-05T10:00:00"),
      todo("low-mon", "low", "2026-01-05T11:00:00"),
      todo("low-sun", "low", "2026-01-11T12:00:00"),
      todo("low-next-week", "low", "2026-01-12T12:00:00"),
    ].map(todoToTimeline);

    const lowDensity = prepareTimelineItems(source, "low");
    expect(lowDensity).toHaveLength(5);
    expect(lowDensity.every((entry) => entry.displayMode === "full")).toBe(true);

    const highDensity = prepareTimelineItems(source, "high");
    expect(highDensity.filter((entry) => entry.displayMode === "marker")).toHaveLength(2);
    expect(highDensity.find((entry) => entry.title === "+2")?.clusterTodos).toHaveLength(2);
    expect(highDensity.find((entry) => entry.todoData?.id === "high")?.displayMode).toBe("full");
    expect(highDensity.find((entry) => entry.todoData?.id === "medium")?.displayMode).toBe("compact");
  });

  it("二维装箱允许不冲突卡片复用近轴区域，并优先布局高优先级", () => {
    const high = todoToTimeline(todo("high", "high", "2026-01-01T10:00:00"));
    const medium = todoToTimeline(todo("medium", "medium", "2026-01-01T10:15:00"));
    const prepared = prepareTimelineItems([medium, high], "medium");
    const stable = assignLanes(prepared, ORIGIN, DAY_MS);
    const positioned = layoutTimelineCards(stable, 1000, "medium");
    const highLayout = positioned.find((entry) => entry.todoData?.id === "high");
    const mediumLayout = positioned.find((entry) => entry.todoData?.id === "medium");

    expect(highLayout?.cardOffsetYPx).toBe(18);
    expect(mediumLayout?.cardWidthPx).toBeLessThan(highLayout?.cardWidthPx ?? 0);
    expect(positioned.every((entry) => entry.cardLeftPx >= 0)).toBe(true);
    expect(new Set(positioned.map((entry) => `${entry.side}:${entry.cardOffsetYPx}`)).size).toBe(2);
  });

  it("密集同刻任务没有矩形重叠，事件仍从真实开始点向右展开", () => {
    const source = [
      todo("same", "high", "2026-01-01T10:00:00"),
      todo("high-2", "high", "2026-01-01T10:00:00"),
      todo("medium-1", "medium", "2026-01-01T10:00:00"),
      todo("medium-2", "medium", "2026-01-01T10:00:00"),
      todo("medium-3", "medium", "2026-01-01T10:00:00"),
      todo("medium-4", "medium", "2026-01-01T10:00:00"),
    ].map(todoToTimeline);
    const eventWithSameId = item("same", 10, "event");
    const stable = assignLanes(
      prepareTimelineItems([eventWithSameId, ...source], "medium"),
      ORIGIN,
      DAY_MS,
    );
    const positioned = layoutTimelineCards(stable, 1000, "medium");
    expect(positioned).toHaveLength(7);
    expect(positioned.find((entry) => entry.kind === "event")?.cardOffsetXPx).toBe(0);

    for (let index = 0; index < positioned.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < positioned.length; otherIndex += 1) {
        const a = positioned[index];
        const b = positioned[otherIndex];
        if (a.side !== b.side) continue;
        const overlapsHorizontally = a.cardLeftPx < b.cardLeftPx + b.cardWidthPx + 6
          && a.cardLeftPx + a.cardWidthPx + 6 > b.cardLeftPx;
        const overlapsVertically = a.cardOffsetYPx < b.cardOffsetYPx + b.cardHeightPx + 6
          && a.cardOffsetYPx + a.cardHeightPx + 6 > b.cardOffsetYPx;
        expect(overlapsHorizontally && overlapsVertically).toBe(false);
      }
    }
  });
});
