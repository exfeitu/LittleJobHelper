"use client";

import { MemoItem } from "@/types";
import { htmlToText, memoProgress } from "@/lib/memo";

type MemoListProps = {
  memos: MemoItem[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
};

/**
 * 备忘录卡片列表。卡片可点击打开详情，右上角铅笔按钮直接进入编辑。
 */
export function MemoList({ memos, onOpen, onEdit }: MemoListProps) {
  if (memos.length === 0) {
    return (
      <div className="memo-empty">
        <p>还没有记录。点击右上角「新建」按钮添加一条。</p>
      </div>
    );
  }

  return (
    <div className="memo-list">
      {memos.map((memo) => {
        const progress = memo.type === "checklist" ? memoProgress(memo) : null;
        const snippet =
          memo.type === "note" ? htmlToText(memo.content ?? "").slice(0, 60) : "";
        return (
          <article
            key={memo.id}
            className="calendar-card calendar-card-clickable memo-card"
            role="button"
            tabIndex={0}
            onClick={() => onOpen(memo.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(memo.id);
              }
            }}
          >
            <div className="memo-card-top">
              <span className={`pill memo-type-badge pill-memo-${memo.type}`}>
                {memo.type === "note" ? "心得" : "备忘"}
              </span>
              <strong className="memo-card-title">{memo.title}</strong>
              <button
                type="button"
                className="memo-card-edit"
                aria-label="编辑"
                title="编辑"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(memo.id);
                }}
              >
                ✏️
              </button>
            </div>
            <div className="memo-card-meta">
              {memo.date && <span>🗓 {memo.date}</span>}
              {progress && (
                <span className={`memo-progress ${progress.completed === progress.total && progress.total > 0 ? "memo-progress-done" : ""}`}>
                  {progress.completed}/{progress.total} 步
                </span>
              )}
            </div>
            {memo.type === "checklist" && progress && progress.total > 0 && (
              <div className="memo-progress-track">
                <div
                  className="memo-progress-fill"
                  style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                />
              </div>
            )}
            {snippet && <p className="memo-card-snippet">{snippet}</p>}
            {memo.tags.length > 0 && (
              <div className="tag-row">
                {memo.tags.map((tag) => (
                  <span key={tag} className="tag chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
