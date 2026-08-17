"use client";

import { useRef } from "react";
import { MemoItem } from "@/types";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { memoProgress } from "@/lib/memo";
import { sanitizeRichHtml } from "@/components/rich-text-editor";

type MemoDetailPanelProps = {
  memo: MemoItem;
  onToggleStep: (stepId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/**
 * 备忘录详情弹窗：note 渲染富文本；checklist 渲染可勾选步骤 + 进度 + 易错点高亮。
 */
export function MemoDetailPanel({ memo, onToggleStep, onEdit, onDelete, onClose }: MemoDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const progress = memo.type === "checklist" ? memoProgress(memo) : null;
  const done = progress && progress.total > 0 && progress.completed === progress.total;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${memo.title} 详情`}
    >
      <div className="modal-panel memo-detail-panel" ref={panelRef}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span className={`pill memo-type-badge pill-memo-${memo.type}`}>
              {memo.type === "note" ? "心得" : "备忘"}
            </span>
            <h2 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {memo.title}
            </h2>
          </div>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="memo-detail-meta">
          {memo.date && <span>🗓 {memo.date}</span>}
          {progress && (
            <span className={`memo-progress ${done ? "memo-progress-done" : ""}`}>
              {progress.completed}/{progress.total} 步已完成
            </span>
          )}
        </div>
        {memo.tags.length > 0 && (
          <div className="tag-row" style={{ marginBottom: "14px" }}>
            {memo.tags.map((tag) => (
              <span key={tag} className="tag chip">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="memo-detail-body">
          {memo.type === "note" ? (
            <div
              className="rich-text-content"
              // 保存时已做过白名单清洗，此处再清洗一次以防御历史脏数据
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(memo.content ?? "") }}
            />
          ) : (
            <div className="memo-detail-steps">
              {(memo.steps ?? []).length === 0 && <p className="empty-note">暂无步骤。</p>}
              {(memo.steps ?? []).map((step, index) => (
                <div
                  key={step.id}
                  className={`memo-step-row memo-detail-step ${step.isWarning ? "memo-step-warning" : ""}`}
                >
                  <span className="memo-step-index">{index + 1}</span>
                  <input
                    type="checkbox"
                    checked={step.completed}
                    onChange={() => onToggleStep(step.id)}
                    aria-label={`步骤 ${index + 1} 完成`}
                  />
                  <span className={`memo-step-content ${step.completed ? "memo-step-completed" : ""}`}>
                    {step.content}
                  </span>
                  {step.isWarning && <span className="memo-warning-tag">⚠ 易错点</span>}
                </div>
              ))}
              {progress && progress.total > 0 && (
                <div className="memo-progress-track">
                  <div
                    className="memo-progress-fill"
                    style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="record-actions">
          <button
            type="button"
            className="ghost-button"
            style={{ color: "#dc2626", marginRight: "auto" }}
            onClick={() => {
              if (confirm("确定要删除这条备忘录吗？此操作不可恢复。")) {
                onDelete(memo.id);
              }
            }}
          >
            🗑️ 删除
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
          <button type="button" className="primary-button" onClick={() => onEdit(memo.id)}>
            ✏️ 编辑
          </button>
        </div>
      </div>
    </div>
  );
}
