"use client";
import { AdaptiveDayView, type AdaptiveDayViewProps } from "./adaptive-day-view";
import { shiftDate, startOfLocalDay } from "@/lib/timeline-adaptive";
export function AdaptiveThreeDayView(props: AdaptiveDayViewProps) {
  return <div className="at-three">{[0, 1, 2].map(offset => <AdaptiveDayView key={offset} {...props}
    date={startOfLocalDay(shiftDate(props.date, offset))} compact width={props.width / 3} />)}</div>;
}
