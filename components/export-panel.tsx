"use client";

import { useCallback, useMemo, useState } from "react";
import { exportDataAsFile, importDataFromFile } from "@/lib/storage";
import { exportRows, toJsonBlock } from "@/lib/utils";
import type { EventItem, TodoItem } from "@/types";

type Props = {
  events: EventItem[];
  todos: TodoItem[];
  customTags?: string[];
  onImport?: (events: EventItem[], todos: TodoItem[], customTags: string[]) => void;
  onClose: () => void;
};

export function ExportPanel({ events, todos, customTags = [], onImport, onClose }: Props) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const jsonPreview = useMemo(
    // 与备份文件结构保持一致：工作记录 + 待办 + 自定义标签
    () => toJsonBlock({ ...exportRows(events, todos), customTags }),
    [events, todos, customTags],
  );

  const handleExport = useCallback(() => {
    if (format === "json") {
      exportDataAsFile(events, todos, customTags);
    } else {
      // CSV 导出：用 BOM 保证 Excel 正确识别中文
      const { eventRows, todoRows } = buildCsv(events, todos);
      const bom = "﻿";
      const csvContent =
        bom +
        "--- 工作记录 ---\n" +
        eventRows +
        "\n\n--- 待办任务 ---\n" +
        todoRows;

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `little-job-helper-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    onClose();
  }, [events, format, todos, customTags, onClose]);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setImportMessage(null);
      try {
        const result = await importDataFromFile(file);
        onImport?.(result.events, result.todos, result.customTags);
        setImportMessage(
          `✅ 导入成功：${result.events.length} 条工作记录，${result.todos.length} 个待办任务${result.migrated ? "（已自动迁移）" : ""}`,
        );
      } catch (error) {
        setImportMessage(
          `❌ 导入失败：${error instanceof Error ? error.message : "文件解析错误"}`,
        );
      }
    },
    [onImport],
  );

  const stats = useMemo(
    () => ({
      eventCount: events.length,
      todoCount: todos.length,
      dateRange: getDateRange(events),
    }),
    [events, todos],
  );

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="导出数据"
    >
      <div className="modal-panel export-panel">
        <div className="modal-header">
          <h2>📊 导出数据</h2>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* 数据概览 */}
        <div className="export-stats">
          <span>
            📅 工作记录：<strong>{stats.eventCount}</strong> 条
          </span>
          <span>
            ✅ 待办任务：<strong>{stats.todoCount}</strong> 个
          </span>
          {stats.dateRange && (
            <span>
              🗓 时间范围：<strong>{stats.dateRange}</strong>
            </span>
          )}
        </div>

        {/* 导出格式选择 */}
        <div className="export-section">
          <label className="settings-label">导出格式</label>
          <div className="export-format-row">
            <label
              className={`export-format-card ${format === "json" ? "export-format-active" : ""}`}
            >
              <input
                type="radio"
                name="export-format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
                style={{ display: "none" }}
              />
              <span className="export-format-icon">📄</span>
              <span className="export-format-name">JSON</span>
              <span className="export-format-desc">
                完整数据备份，支持导入恢复
              </span>
            </label>
            <label
              className={`export-format-card ${format === "csv" ? "export-format-active" : ""}`}
            >
              <input
                type="radio"
                name="export-format"
                value="csv"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                style={{ display: "none" }}
              />
              <span className="export-format-icon">📊</span>
              <span className="export-format-name">CSV (Excel)</span>
              <span className="export-format-desc">
                用 Excel / WPS 打开，方便打印
              </span>
            </label>
          </div>
        </div>

        {/* JSON 预览 */}
        {format === "json" && (
          <div className="export-section">
            <label className="settings-label">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setPreviewOpen(!previewOpen)}
                style={{ fontSize: "0.85rem", padding: "6px 12px" }}
              >
                {previewOpen ? "收起预览" : "📋 展开预览"}
              </button>
            </label>
            {previewOpen && (
              <pre className="export-preview-block">{jsonPreview}</pre>
            )}
          </div>
        )}

        {/* 导入 JSON */}
        <div className="export-section">
          <label className="settings-label">从 JSON 备份导入</label>
          <div className="export-import-row">
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
            />
            <span className="settings-hint" style={{ margin: 0 }}>
              导入会<b>覆盖</b>当前数据，请先确认已导出备份。
            </span>
          </div>
          {importMessage && (
            <div
              className={`settings-message ${
                importMessage.startsWith("✅")
                  ? "settings-message-success"
                  : "settings-message-error"
              }`}
            >
              {importMessage}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="record-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleExport}
          >
            📥 导出{format === "json" ? " JSON" : " CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 工具函数
// ============================================================

function getDateRange(events: EventItem[]): string | null {
  if (events.length === 0) return null;
  const dates = events
    .map((e) => e.startTime.slice(0, 10))
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  if (dates.length === 1) return dates[0];
  return `${dates[0]} ~ ${dates[dates.length - 1]}`;
}

export function buildCsv(
  events: EventItem[],
  todos: TodoItem[],
): { eventRows: string; todoRows: string } {
  const eventHeader = "日期,开始时间,结束时间,标题,详情,标签";
  const eventRows = [
    eventHeader,
    ...events.map((e) =>
      [
        e.startTime.slice(0, 10),
        e.startTime,
        e.endTime,
        csvCell(e.title),
        csvCell(e.detail ?? ""),
        csvCell(e.tags.join("、")),
      ].join(","),
    ),
  ].join("\n");

  const todoHeader = "标题,截止日期,优先级,状态,部门,联系人,备注,标签";
  const statusLabel: Record<string, string> = {
    pending: "未开始",
    in_progress: "进行中",
    completed: "已完成",
    cancelled: "已取消",
  };
  const todoRows = [
    todoHeader,
    ...todos.map((t) =>
      [
        csvCell(t.title),
        t.dueDate ?? "",
        t.priority,
        statusLabel[t.status] ?? t.status,
        csvCell(t.department ?? ""),
        csvCell(t.contactPerson ?? ""),
        csvCell(t.remarks ?? ""),
        csvCell(t.tags.join("、")),
      ].join(","),
    ),
  ].join("\n");

  return { eventRows, todoRows };
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
