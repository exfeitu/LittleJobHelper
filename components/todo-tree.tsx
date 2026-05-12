import { TodoTreeNode } from "@/types";
import { formatDateTime } from "@/lib/utils";

type TodoTreeProps = {
  nodes: TodoTreeNode[];
  depth?: number;
  linkedEventTitles?: Record<string, string>;
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

export function TodoTree({ nodes, depth = 0, linkedEventTitles = {} }: TodoTreeProps) {
  return (
    <div className="todo-tree">
      {nodes.map((node) => (
        <div key={node.id} className="todo-branch">
          <article className="todo-card" style={{ marginLeft: depth * 20 }}>
            <div className="todo-main">
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
              {node.dueDate ? <span>截止：{formatDateTime(node.dueDate)}</span> : <span>未设截止时间</span>}
              {node.linkedEventIds?.length ? (
                <div className="link-badge-group">
                  {node.linkedEventIds
                    .filter((eventId) => linkedEventTitles[eventId])
                    .map((eventId) => (
                      <span key={eventId} className="link-badge">
                        关联时间轴：{linkedEventTitles[eventId]}
                      </span>
                    ))}
                </div>
              ) : null}
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
          {node.children.length ? <TodoTree nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}
