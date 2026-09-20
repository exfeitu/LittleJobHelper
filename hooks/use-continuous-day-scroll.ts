"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject, type MutableRefObject } from "react";
import { shiftDate } from "@/lib/timeline-adaptive";

export const DAY_BUFFER = 2;
export const DAY_OFFSETS = [-2, -1, 0, 1, 2];

/** 五个相邻日复用同一滚动轨道；回收缓冲日时抵消像素偏移，保留屏幕上的真实时间。 */
export function useContinuousDayScroll({ nodeRef, date, width, enabled, initialFraction, resetKey, dragRef, onDateChange }: {
  nodeRef: RefObject<HTMLDivElement>; date: string; width: number; enabled: boolean; initialFraction: number; resetKey: string;
  dragRef: MutableRefObject<{ x: number; left: number } | null>; onDateChange: (date: string) => void;
}) {
  const previous = useRef<{ date: string; width: number; enabled: boolean; resetKey: string; initialFraction: number } | null>(null);
  const manuallyMoved = useRef(false);
  const pendingLeft = useRef<number | null>(null);
  const target = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const behavior = (): ScrollBehavior => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (timer.current) clearTimeout(timer.current);
    const old = previous.current;
    if (enabled) {
      if (pendingLeft.current !== null) {
        node.scrollTo({ left: pendingLeft.current, behavior: "instant" });
        pendingLeft.current = null;
        if (target.current !== null) frame.current = requestAnimationFrame(() => {
          node.scrollTo({ left: target.current!, behavior: behavior() });
        });
      } else {
        target.current = null;
        // 详情展开/窗口缩放只改变比例，不改变左边缘对应的时间。
        const preserve = old?.enabled && old.date === date && old.resetKey === resetKey && (manuallyMoved.current || old.initialFraction === initialFraction);
        if (!preserve) manuallyMoved.current = false;
        node.scrollTo({ left: preserve ? node.scrollLeft / old.width * width : (DAY_BUFFER + initialFraction) * width, behavior: "instant" });
      }
    } else if (!old || old.enabled || old.date !== date || old.resetKey !== resetKey) {
      node.scrollTo({ left: 0, behavior: "instant" });
      target.current = null;
    }
    previous.current = { date, width, enabled, resetKey, initialFraction };
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [date, width, enabled, resetKey, initialFraction, nodeRef]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !enabled) return;
    const onScroll = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const offset = Math.floor((node.scrollLeft + node.clientWidth / 2) / width) - DAY_BUFFER;
        if (!offset) { target.current = null; return; }
        pendingLeft.current = node.scrollLeft - offset * width;
        target.current = target.current !== null && Math.abs(target.current - node.scrollLeft) > 2
          ? target.current - offset * width : null;
        if (dragRef.current) dragRef.current.left -= offset * width;
        onDateChange(shiftDate(date, offset));
      }, 140);
    };
    node.addEventListener("scroll", onScroll);
    return () => { node.removeEventListener("scroll", onScroll); if (timer.current) clearTimeout(timer.current); };
  }, [date, width, enabled, nodeRef, dragRef, onDateChange]);

  return {
    moveDays(delta: number) {
      manuallyMoved.current = true;
      const node = nodeRef.current;
      if (!node) return;
      target.current = (target.current ?? node.scrollLeft) + delta * width;
      node.scrollTo({ left: target.current, behavior: behavior() });
    },
    stop() {
      manuallyMoved.current = true;
      target.current = null;
      const node = nodeRef.current;
      if (node) node.scrollTo({ left: node.scrollLeft, behavior: "instant" });
    },
  };
}
