import { formatClock, shiftDate, startOfLocalDay } from "@/lib/timeline-adaptive";

export function TimelineSummaryNow({ date, now }: { date: Date; now: number }) {
  const start = +startOfLocalDay(date);
  const end = +startOfLocalDay(shiftDate(date, 1));
  if (now < start || now >= end) return null;
  return <i className="at-summary-now" style={{ left: (now - start) / (end - start) * 100 + "%" }}><span>{formatClock(now)}</span></i>;
}
