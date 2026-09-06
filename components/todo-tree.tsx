"use client";

import { useState, type CSSProperties } from "react";
import { TodoTreeNode } from "@/types";
import { formatDateTime } from "@/lib/utils";

type TodoTreeProps = {
  nodes: TodoTreeNode[];
  depth?: number;
  linkedEventTitles?: Record<string, string>;
  maxDisplay?: number;
  onTodoClick?: (todo: TodoTreeNode) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
};

const statusText = {
  pending: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};

const priorityText = {
  high: "高",
  medium: "中",
  low: "低",
};

function hasTodoDetails(node: TodoTreeNode) {
  return Boolean(
    node.startTime ||
      node.dueDate ||
      node.linkedEventIds?.some((eventId) => eventId) ||
      node.steps?.length ||
      node.remarks ||
      node.tags.length,
  );
}

export function TodoTree({
  nodes,
  depth = 0,
  linkedEventTitles = {},
  maxDisplay,
  onTodoClick,
  selectedIds,
  onToggleSelect,
}: TodoTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const displayNodes = maxDisplay ? nodes.slice(0, maxDisplay) : nodes;
  const selectable = !!onToggleSelect;
  const treeStyle = {
    "--todo-tree-guide-left": `${Math.max(0, depth - 1) * 24 + 34}px`,
  } as CSSProperties;

  const toggleExpanded = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={`todo-tree ${depth === 0 ? "todo-tree-root" : "todo-tree-nested"}`}
      style={treeStyle}
    >
      {displayNodes.map((node) => {
        const detailsAvailable = hasTodoDetails(node);
        const expanded = detailsAvailable && expandedIds.has(node.id);
        const completedSteps = node.steps?.filter((step) => step.completed).length ?? 0;
        const totalSteps = node.steps?.length ?? 0;
        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        const rowStyle = {
          "--todo-row-indent": `${depth === 0 ? 0 : depth * 24 + 10}px`,
          "--todo-row-indent-mobile": `${depth === 0 ? 0 : depth * 16 + 6}px`,
        } as CSSProperties;

        return (
          <div key={node.id} className={`todo-branch ${node.children.length ? "todo-branch-parent" : ""}`}>
            <article
              className={`todo-card ${selectedIds?.has(node.id) ? "todo-card-selected" : ""}`}
              style={rowStyle}
            >
              <div className="todo-summary-row">
                <span className="todo-leading-control">
                  {selectable ? (
                    <input
                      type="checkbox"
                      className="todo-select-checkbox"
                      checked={selectedIds?.has(node.id) ?? false}
                      onChange={() => onToggleSelect?.(node.id)}
                      aria-label={`选择 ${node.title}`}
                    />
                  ) : (
                    <span
                      className={`todo-status-dot todo-status-${node.computedStatus}`}
                      role="img"
                      aria-label={statusText[node.computedStatus]}
                    />
                  )}
                </span>

                <button
                  type="button"
                  className="todo-summary-button"
                  onClick={() => onTodoClick?.(node)}
                  aria-label={`编辑任务：${node.title}`}
                >
                  <span className="todo-title">{node.title}</span>
                  <span className="todo-summary-meta">
                    {statusText[node.computedStatus]}
                    {node.department ? ` · ${node.department}` : " · 未指定部门"}
                    {node.contactPerson ? ` · ${node.contactPerson}` : ""}
                    {totalSteps > 0 ? ` · ${completedSteps}/${totalSteps} 步骤` : " · 无步骤"}
                  </span>
                </button>

                <span
                  className={`todo-priority-rail todo-priority-${node.priority}`}
                  role="img"
                  aria-label={`${priorityText[node.priority]}优先级`}
                />

                <span className={`todo-due ${node.dueDate ? "" : "todo-due-empty"}`}>
                  {node.dueDate ? `截止 ${formatDateTime(node.dueDate)}` : "未设截止时间"}
                </span>

                {detailsAvailable ? (
                  <button
                    type="button"
                    className="todo-expand-button"
                    onClick={() => toggleExpanded(node.id)}
                    aria-expanded={expanded}
                    aria-controls={`todo-details-${node.id}`}
                    aria-label={`${expanded ? "收起" : "展开"} ${node.title} 的详情`}
                  >
                    <span aria-hidden="true">⌄</span>
                  </button>
                ) : (
                  <span className="todo-expand-spacer" aria-hidden="true" />
                )}
              </div>

              {expanded ? (
                <div className="todo-details" id={`todo-details-${node.id}`}>
                  {totalSteps > 0 ? (
                    <div className="todo-progress-summary">
                      <div
                        className="todo-progress-track"
                        role="progressbar"
                        aria-label={`${node.title} 的步骤进度`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <span>{progress}%</span>
                    </div>
                  ) : null}

                  {node.startTime || node.dueDate ? (
                    <div className="todo-detail-facts">
                      {node.startTime ? <span>开始：{formatDateTime(node.startTime)}</span> : null}
                      {node.dueDate ? <span>截止：{formatDateTime(node.dueDate)}</span> : null}
                    </div>
                  ) : null}

                  {node.linkedEventIds?.length ? (
                    <div className="link-badge-group link-badge-group-event">
                      {node.linkedEventIds
                        .filter((eventId) => linkedEventTitles[eventId])
                        .map((eventId) => (
                          <span key={eventId} className="link-badge link-badge-event">
                            📅 {linkedEventTitles[eventId]}
                          </span>
                        ))}
                    </div>
                  ) : null}

                  {node.steps?.length ? (
                    <ol className="todo-detail-steps">
                      {node.steps.map((step, index) => (
                        <li key={step.id} className={step.completed ? "todo-detail-step-completed" : ""}>
                          <span className="todo-detail-step-index" aria-hidden="true">
                            {step.completed ? "✓" : index + 1}
                          </span>
                          <span>{step.content}</span>
                          {step.scheduledTime ? (
                            <time dateTime={step.scheduledTime}>{formatDateTime(step.scheduledTime)}</time>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {node.remarks ? <p className="todo-detail-remarks">{node.remarks}</p> : null}
                  {node.tags.length ? (
                    <div className="tag-row todo-detail-tags">
                      {node.tags.map((tag) => (
                        <span key={tag} className="tag chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>

            {node.children.length ? (
              <TodoTree
                nodes={node.children}
                depth={depth + 1}
                linkedEventTitles={linkedEventTitles}
                onTodoClick={onTodoClick}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
