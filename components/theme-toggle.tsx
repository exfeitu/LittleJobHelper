"use client";

import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "little-job-helper-theme";
type Theme = "light" | "dark";

/**
 * 亮/暗主题切换按钮。主题写入 <html data-theme>，并持久化到 localStorage。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  });

  // 将主题同步到外部系统（<html data-theme>），不调用 setState
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  return (
    <button
      className="ghost-button"
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
      aria-label="切换主题"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
