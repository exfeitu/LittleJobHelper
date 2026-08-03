"use client";

import { useBackupReminder } from "@/hooks/use-backup-reminder";

type BackupReminderProps = {
  onOpenExport: () => void;
};

/**
 * 周一 / 周五当天第一次打开应用时的"记得备份"气泡。
 * 自管理可见性与去重（见 use-backup-reminder），仅在需要时渲染。
 */
export function BackupReminder({ onOpenExport }: BackupReminderProps) {
  const { visible, dismiss } = useBackupReminder();
  if (!visible) return null;

  return (
    <div className="backup-reminder" role="status" aria-live="polite">
      <span className="backup-reminder-icon" aria-hidden="true">💾</span>
      <div className="backup-reminder-text">
        <strong>记得备份数据</strong>
        <span>今天是备份日，建议导出 JSON 存档，防止数据丢失。</span>
      </div>
      <button
        className="backup-reminder-cta"
        type="button"
        onClick={() => {
          onOpenExport();
          dismiss();
        }}
      >
        去备份
      </button>
      <button
        className="backup-reminder-close"
        type="button"
        onClick={dismiss}
        aria-label="关闭提醒"
      >
        ✕
      </button>
    </div>
  );
}
