"use client";

import { useEffect } from "react";

/**
 * 模态弹窗焦点锁定：Tab 循环在弹窗内部，防止焦点逃逸到背景页面。
 * 用法：`const panelRef = useRef<HTMLDivElement>(null); useFocusTrap(panelRef, open);`
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => !item.hasAttribute("disabled"));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (activeEl === first || !el.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref, active]);
}
