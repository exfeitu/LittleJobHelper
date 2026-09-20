import { describe, expect, it } from "vitest";
import type { EventItem } from "@/types";
import { workWindowStartHour } from "../timeline-adaptive";

const date = "2026-09-21";
const event = (start: string, end: string): EventItem => ({ id: start, title: "工作", startTime: `${date}T${start}:00`, endTime: `${date}T${end}:00`, tags: [], detail: "", updatedAt: date });
describe("12 小时工作窗口", () => {
  it("空日默认 08:00", () => expect(workWindowStartHour(date, [])).toBe(8));
  it("常规工作日全部覆盖", () => expect(workWindowStartHour(date, [event("09:00", "18:00")])).toBe(8));
  it("早班自动向前定位", () => expect(workWindowStartHour(date, [event("05:30", "14:00")])).toBe(5.5));
  it("晚班自动向后定位", () => expect(workWindowStartHour(date, [event("16:00", "23:00")])).toBe(11));
  it("跨度过长优先覆盖主要工作时段", () => expect(workWindowStartHour(date, [event("01:00", "02:00"), event("13:00", "23:00")])).toBe(11));
  it("不因多条重叠记录偏向短时段", () => expect(workWindowStartHour(date, [...Array.from({ length: 20 }, () => event("01:00", "02:00")), event("13:00", "23:00")])).toBe(11));
  it("跨日只计算当天部分，忽略无效记录", () => expect(workWindowStartHour(date, [{ ...event("01:00", "04:00"), startTime: "2026-09-20T23:00:00" }, event("12:00", "11:00")])).toBe(0));
});
