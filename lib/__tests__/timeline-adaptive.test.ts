import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_VIEW_DAYS,
  adaptiveViewForDays,
  adaptiveViewScale,
  adjacentAdaptiveView,
  buildTimelineWindow,
  localDateKey,
  shiftFocusDate,
} from "@/lib/timeline-adaptive";

describe("adaptive timeline view model", () => {
  it("maps continuous visible days into the four explicit views", () => {
    expect(adaptiveViewForDays(1)).toBe("day");
    expect(adaptiveViewForDays(3)).toBe("three");
    expect(adaptiveViewForDays(7)).toBe("week");
    expect(adaptiveViewForDays(30)).toBe("month");
  });

  it("keeps canonical day counts and scales", () => {
    expect(ADAPTIVE_VIEW_DAYS).toEqual({ day: 1, three: 3, week: 7, month: 30 });
    expect(adaptiveViewScale("day")).toBe(1);
    expect(adaptiveViewScale("week")).toBeCloseTo(1 / 7);
  });
});
describe("adaptive timeline date windows", () => {
  it("builds a local-day aligned window", () => {
    const window = buildTimelineWindow("2026-09-14T18:30:00+08:00", "three");
    expect(localDateKey(window.start)).toBe("2026-09-14");
    expect(window.dayCount).toBe(3);
    expect(localDateKey(new Date(window.end.getTime() - 1))).toBe("2026-09-16");
  });

  it("moves by the current view span", () => {
    expect(shiftFocusDate("2026-09-14", "day", 1)).toBe("2026-09-15");
    expect(shiftFocusDate("2026-09-14", "week", 1)).toBe("2026-09-21");
    expect(shiftFocusDate("2026-09-14", "three", -1)).toBe("2026-09-11");
  });

  it("moves between adjacent semantic zoom levels", () => {
    expect(adjacentAdaptiveView("week", "in")).toBe("three");
    expect(adjacentAdaptiveView("three", "in")).toBe("day");
    expect(adjacentAdaptiveView("day", "in")).toBe("day");
    expect(adjacentAdaptiveView("week", "out")).toBe("month");
    expect(adjacentAdaptiveView("month", "out")).toBe("month");
  });
});

import type { EventItem, TodoItem } from "@/types";
import {
  buildDetailedTodoMarkers,
  layoutDetailedEvents,
  buildDaySummaries,
  densityLevel,
  timeOfDayPercent,
} from "@/lib/timeline-adaptive";

function makeTodo(id: string, time: string, priority: TodoItem["priority"] = "medium"): TodoItem {
  return {
    id,
    title: id,
    startTime: time,
    priority,
    status: "pending",
    tags: [],
    parentId: null,
    updatedAt: "2026-09-14T00:00:00Z",
  };
}

function makeEvent(id: string, startTime: string, endTime: string): EventItem {
  return {
    id,
    title: id,
    startTime,
    endTime,
    tags: [],
    updatedAt: "2026-09-14T00:00:00Z",
  };
}
describe("adaptive timeline overlap layout", () => {
  it("stagger two nearby todos but clusters three or more", () => {
    const two = buildDetailedTodoMarkers([
      makeTodo("a", "2026-09-14T09:00:00"),
      makeTodo("b", "2026-09-14T09:20:00"),
    ]);
    expect(two.map((item) => item.kind)).toEqual(["item", "item"]);
    expect(two.map((item) => item.kind === "item" ? item.lane : -1)).toEqual([0, 1]);

    const three = buildDetailedTodoMarkers([
      makeTodo("a", "2026-09-14T09:00:00"),
      makeTodo("b", "2026-09-14T09:15:00"),
      makeTodo("c", "2026-09-14T09:30:00"),
    ]);
    expect(three).toHaveLength(1);
    expect(three[0].kind).toBe("cluster");
    if (three[0].kind === "cluster") expect(three[0].todos).toHaveLength(3);
  });

  it("uses at most three event lanes and puts excess overlaps into +N groups", () => {
    const start = new Date("2026-09-14T00:00:00").getTime();
    const end = new Date("2026-09-15T00:00:00").getTime();
    const events = [
      makeEvent("a", "2026-09-14T09:00:00", "2026-09-14T11:00:00"),
      makeEvent("b", "2026-09-14T09:10:00", "2026-09-14T10:30:00"),
      makeEvent("c", "2026-09-14T09:20:00", "2026-09-14T10:20:00"),
      makeEvent("d", "2026-09-14T09:30:00", "2026-09-14T10:00:00"),
    ];
    const layout = layoutDetailedEvents(events, start, end);
    expect(layout.visible).toHaveLength(3);
    expect(layout.visible.map((item) => item.lane)).toEqual([0, 1, 2]);
    expect(layout.overflow).toHaveLength(1);
    expect(layout.overflow[0].events.map((event) => event.id)).toEqual(["d"]);
  });
});
describe("adaptive timeline summaries", () => {
  it("summarizes todo priorities and work hours per day", () => {
    const start = new Date("2026-09-14T00:00:00").getTime();
    const summaries = buildDaySummaries(
      start,
      2,
      [
        makeTodo("h", "2026-09-14T09:00:00", "high"),
        makeTodo("m", "2026-09-14T10:00:00", "medium"),
        makeTodo("l", "2026-09-15T10:00:00", "low"),
      ],
      [
        makeEvent("e1", "2026-09-14T09:00:00", "2026-09-14T11:30:00"),
        makeEvent("e2", "2026-09-15T14:00:00", "2026-09-15T15:00:00"),
      ],
    );

    expect(summaries[0].priorityCounts).toEqual({ high: 1, medium: 1, low: 0 });
    expect(summaries[0].eventHours).toBeCloseTo(2.5);
    expect(summaries[1].priorityCounts.low).toBe(1);
    expect(summaries[1].eventHours).toBeCloseTo(1);
  });

  it("converts counts and times into compact display helpers", () => {
    expect(densityLevel(0, 10)).toBe(0);
    expect(densityLevel(5, 10)).toBe(3);
    expect(densityLevel(10, 10)).toBe(5);
    expect(timeOfDayPercent("2026-09-14T12:00:00")).toBeCloseTo(50);
  });
});
