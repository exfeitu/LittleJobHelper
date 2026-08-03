"use client";

import Link from "next/link";
import { HelpIcon } from "@/components/help-icon";

type SyncStatus = "idle" | "syncing" | "success" | "error";

type AppHeaderProps = {
  activePage: "timeline" | "calendar";
  tips: string[];
  cloudEnabled: boolean;
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  canUndo: boolean;
  onQuickRecord: () => void;
  onAddTask: () => void;
  onOpenSync: () => void;
  onOpenExport: () => void;
  onOpenTags: () => void;
  onUndo: () => void;
};

const SYNC_DOT_TITLE: Record<SyncStatus, string> = {
  idle: "等待同步",
  syncing: "同步中…",
  success: "已同步",
  error: "同步失败",
};

/**
 * 两个页面共用的顶部导航栏：品牌、帮助、导航、快捷操作、同步状态指示。
 * 由 app/page.tsx 和 app/calendar/page.tsx 复用，消除重复。
 */
export function AppHeader({
  activePage,
  tips,
  cloudEnabled,
  isOnline,
  syncStatus,
  syncError,
  canUndo,
  onQuickRecord,
  onAddTask,
  onOpenSync,
  onOpenExport,
  onOpenTags,
  onUndo,
}: AppHeaderProps) {
  const dotTitle = syncError
    ? `${SYNC_DOT_TITLE[syncStatus]}：${syncError}`
    : SYNC_DOT_TITLE[syncStatus];

  return (
    <header className="page-header panel">
      <div className="page-header-title">
        <h1>办公助手</h1>
        <HelpIcon tips={tips} />
      </div>
      <div className="page-header-actions">
        <nav className="page-nav" aria-label="页面导航">
          <Link href="/" className={`page-nav-link ${activePage === "timeline" ? "active" : ""}`}>
            时间轴
          </Link>
          <Link href="/calendar" className={`page-nav-link ${activePage === "calendar" ? "active" : ""}`}>
            日历
          </Link>
        </nav>

        {!isOnline && (
          <span className="online-badge" title="当前处于离线状态，云同步已暂停">
            离线
          </span>
        )}

        <button className="ghost-button" type="button" onClick={onQuickRecord}>
          📝 快速记录工作
        </button>
        <button className="ghost-button" type="button" onClick={onAddTask}>
          + 添加任务
        </button>
        <button
          className="ghost-button sync-status-button"
          type="button"
          onClick={onOpenSync}
          title={dotTitle}
        >
          <span className={`sync-dot sync-dot-${syncStatus}`} aria-hidden="true" />
          {cloudEnabled ? "☁️" : "⚙️"} 同步
        </button>
        <button className="ghost-button" type="button" onClick={onOpenExport}>
          📊 导出
        </button>
        <button className="ghost-button" type="button" onClick={onOpenTags}>
          🏷️ 标签
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="撤销上一步 (Ctrl+Z)"
        >
          ↩ 撤销
        </button>
      </div>
    </header>
  );
}
