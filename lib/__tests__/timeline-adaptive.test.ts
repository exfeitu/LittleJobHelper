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
