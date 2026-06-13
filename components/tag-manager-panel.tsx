"use client";

import { useMemo, useState } from "react";

type TagManagerPanelProps = {
  baseTags: string[];
  customTags: string[];
  onTagsChange: (tags: string[]) => void;
  onClose: () => void;
};

export function TagManagerPanel({ baseTags, customTags, onTagsChange, onClose }: TagManagerPanelProps) {
  const allTags = useMemo(
    () => Array.from(new Set([...baseTags, ...customTags])),
    [baseTags, customTags],
  );

  const [newTag, setNewTag] = useState("");

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (!trimmed || allTags.includes(trimmed)) return;
    onTagsChange([...customTags, trimmed]);
    setNewTag("");
  };

  const handleDelete = (tag: string) => {
    if (baseTags.includes(tag)) return;
    onTagsChange(customTags.filter((t) => t !== tag));
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: "480px" }}>
        <div className="modal-header">
          <h2>🏷️ 管理标签</h2>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 添加新标签 */}
        <div className="record-section" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            className="record-title-input"
            style={{ flex: 1 }}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            placeholder="输入新标签名称（回车添加）"
            autoFocus
          />
          <button className="primary-button" type="button" onClick={handleAdd} style={{ padding: "10px 16px" }}>
            添加
          </button>
        </div>

        {/* 标签列表 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
          {allTags.map((tag) => {
            const isBase = baseTags.includes(tag);
            return (
              <span
                key={tag}
                className={`chip-button chip-tag ${!isBase ? "chip-tag-active" : ""}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                {tag}
                {!isBase && (
                  <button
                    className="chip-remove"
                    type="button"
                    onClick={() => handleDelete(tag)}
                    title={`删除"${tag}"`}
                  >
                    ✕
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "12px", marginBottom: 0 }}>
          灰色为基础标签，不可删除；高亮为自定义标签，可删除。
        </p>

        <div className="record-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
