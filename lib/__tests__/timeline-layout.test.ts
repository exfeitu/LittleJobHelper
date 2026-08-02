import { describe, expect, it } from "vitest";
import {
  assignLanes,
  buildWeekBrackets,
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
