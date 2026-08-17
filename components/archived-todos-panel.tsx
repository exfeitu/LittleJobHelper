"use client";

import { useState } from "react";
import { TodoTreeNode } from "@/types";
import { formatDateTime } from "@/lib/utils";

type ArchivedTodosPanelProps = {
  nodes: TodoTreeNode[];
  onRestore: (id: string) => void;
  onTodoClick: (todo: TodoTreeNode) => void;
};

function statusLabel(status: TodoTreeNode["computedStatus"]): string {
  if (status === "completed") return "已完成";
  if (status === "cancelled") return "已取消";
  return "未完成";
}

/**
 * 已归档待办折叠面板：默认收起，标题显示计数。
 * 展开后展示已完成/已取消的待办树，每条带"恢复"按钮，点击标题可编辑。
 */
export function ArchivedTodosPanel({ nodes, onRestore, onTodoClick }: ArchivedTodosPanelProps) {
  const [open, setOpen] = useState(false);

  if (nodes.length === 0) return null;

  const renderBranch = (node: TodoTreeNode, depth: number) => (
    <div key={node.id} className="archived-branch">
      <div className="archived-item" style={{ marginLeft: depth * 18 }}>
        <span className={`checkbox checkbox-${node.computedStatus}`} aria-hidden="true" />
        <button
          type="button"
          className="archived-title"
          onClick={() => onTodoClick(node)}
          title="点击编辑"
        >
          {node.title}
          <em className="archived-status">{statusLabel(node.computedStatus)}</em>
        </button>
        {node.dueDate && (
          <span className="archived-meta">截止 {formatDateTime(node.dueDate)}</span>
        )}
        <button
          type="button"
          className="archived-restore"
          onClick={(e) => {
            e.stopPropagation();
            onRestore(node.id);
          }}
          title="恢复到待办列表（进行中）"
        >
          ↩ 恢复
        </button>
      </div>
      {node.children.length > 0 &&
        node.children.map((child) => renderBranch(child, depth + 1))}
    </div>
  );

  return (
    <section className="grid overview-grid">
      <article className="panel section-card">
        <button
          type="button"
          className="archived-summary"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`已归档 ${nodes.length} 条`}
        >
          <span className="archived-summary-title">
            🗂 已归档 <strong>{nodes.length}</strong> 条
          </span>
          <span className="archived-summary-arrow">{open ? "▴" : "▾"}</span>
        </button>
        {open && (
          <div className="archived-list">
            {nodes.map((node) => renderBranch(node, 0))}
          </div>
        )}
      </article>
    </section>
  );
}
