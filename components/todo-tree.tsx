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

export function TodoTree({ nodes, depth = 0, linkedEventTitles = {}, maxDisplay, onTodoClick, selectedIds, onToggleSelect }: TodoTreeProps) {
  const displayNodes = maxDisplay ? nodes.slice(0, maxDisplay) : nodes;
  const selectable = !!onToggleSelect;

  const handleKeyDown = (node: TodoTreeNode, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTodoClick?.(node);
    }
  };

  return (
    <div className="todo-tree">
      {displayNodes.map((node) => (
        <div key={node.id} className="todo-branch">
          <article
            className={`todo-card ${selectedIds?.has(node.id) ? "todo-card-selected" : ""}`}
            style={{ marginLeft: depth * 20, cursor: "pointer" }}
            onClick={() => onTodoClick?.(node)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(node, e)}
          >
            <div className="todo-main">
              {selectable && (
                <input
                  type="checkbox"
                  className="todo-select-checkbox"
                  checked={selectedIds?.has(node.id) ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect?.(node.id)}
                  aria-label={`选择 ${node.title}`}
                />
              )}
              <span className={`checkbox checkbox-${node.computedStatus}`} />
              <div>
                <h4>{node.title}</h4>
                <p>
                  {statusText[node.computedStatus]} · 优先级{priorityText[node.priority]}
                  {node.department ? ` · ${node.department}` : ""}
                  {node.contactPerson ? ` · ${node.contactPerson}` : ""}
                </p>
              </div>
            </div>
            <div className="todo-meta">
              {node.startTime ? <span>开始：{formatDateTime(node.startTime)}</span> : null}
              {node.dueDate ? (
                <span>截止：{formatDateTime(node.dueDate)}</span>
              ) : !node.startTime ? (
                <span>未设截止时间</span>
              ) : null}
              
              {/* 显示关联的多个时间点 */}
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
              
              {/* 显示任务步骤 */}
              {node.steps && node.steps.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>任务步骤：</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', listStyle: 'none' }}>
                    {node.steps.map((step, index) => (
                      <li 
                        key={step.id} 
                        style={{ 
                          fontSize: '0.85rem',
                          color: step.completed ? 'var(--success)' : 'var(--muted)',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: step.completed ? 'none' : '1px solid var(--muted)',
                          background: step.completed ? 'var(--success)' : 'transparent',
                          color: 'white',
                          fontSize: '0.7rem',
                          flexShrink: 0
                        }}>
                          {step.completed ? '✓' : index + 1}
                        </span>
                        <span style={{ textDecoration: step.completed ? 'line-through' : 'none' }}>
                          {step.content}
                        </span>
                        {step.scheduledTime && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginLeft: 'auto' }}>
                            {formatDateTime(step.scheduledTime)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {node.remarks ? <em>{node.remarks}</em> : null}
              <div className="tag-row">
                {node.tags.map((tag) => (
                  <span key={tag} className="tag chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
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
      ))}
    </div>
  );
}