"use client";

import { useEffect } from "react";

type ShortcutHandlers = {
  /** Ctrl/Cmd + K → 聚焦搜索 */
  onSearch?: () => void;
  /** Ctrl/Cmd + N → 新建任务 */
  onNewTask?: () => void;
  /** Ctrl/Cmd + Shift + N → 快速记录工作 */
  onNewRecord?: () => void;
  /** Ctrl/Cmd + Z → 撤销 */
  onUndo?: () => void;
  /** Esc → 关闭当前弹窗 */
  onEscape?: () => void;
};

/**
 * 全局键盘快捷键。绑定在 window 上，输入框聚焦时不拦截（Escape 除外）。
 */
export function useKeyboardShortcuts({
  onSearch,
  onNewTask,
  onNewRecord,
  onUndo,
  onEscape,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearch?.();
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewTask?.();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewRecord?.();
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo?.();
        return;
      }
      // Escape 在输入框内也生效（关闭弹窗）
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      // 其余快捷键在输入场景下不触发
      if (typing) return;
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSearch, onNewTask, onNewRecord, onUndo, onEscape]);
}
