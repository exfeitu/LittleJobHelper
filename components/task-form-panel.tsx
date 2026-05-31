"use client";

import { useMemo, useState } from "react";
import { EventItem, Priority, TodoItem, TodoStatus } from "@/types";

type TaskFormPanelProps = {
  events: EventItem[];
  onSave: (newTodo: TodoItem, linkedEventIds: string[]) => void;
  onClose: () => void;
};

const PRESET_TAGS = ["党建", "人事", "纪检", "编制", "档案", "外出", "会议", "其他"];

export function TaskFormPanel({ events, onSave, onClose }: TaskFormPanelProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TodoStatus>("pending");
  const [department, setDepartment] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [linkedEventIds, setLinkedEventIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeEvents = useMemo(
    () => events.filter((e) => e.title),
    [events],
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setCustomTagInput("");
  };

  const toggleLinkedEvent = (eventId: string) => {
    setLinkedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  };

  const handleSave = () => {
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("请输入任务标题");
      return;
    }

    const allTags = [...selectedTags];
    if (customTagInput.trim()) {
      allTags.push(customTagInput.trim());
    }

    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      title: title.trim(),
      dueDate: dueDate || undefined,
      priority,
      status,
      tags: allTags.length > 0 ? allTags : ["其他"],
      department: department.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      remarks: remarks.trim() || undefined,
      parentId: null,
      pinnedToToday: status !== "completed" && status !== "cancelled",
      linkedEventIds: linkedEventIds.length > 0 ? linkedEventIds : undefined,
    };

    onSave(newTodo, linkedEventIds);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel task-form-panel">
        <div className="modal-header">
          <h2>➕ 新建任务</h2>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 任务标题 */}
        <div className="record-section">
          <label className="record-label" htmlFor="task-title">
            任务标题 <span className="required">*</span>
          </label>
          <input
            id="task-title"
            className="record-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="任务名称（例如：准备职级晋升报审材料）"
            autoFocus
          />
        </div>

        {/* 时间 & 优先级 */}
        <div className="record-section">
          <div className="task-form-grid">
            <div>
              <label className="record-label" htmlFor="task-duedate">截止时间</label>
              <input
                id="task-duedate"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="record-label" htmlFor="task-priority">优先级</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="high">🔴 高优先级</option>
                <option value="medium">🟡 中优先级</option>
                <option value="low">🟢 低优先级</option>
              </select>
            </div>
          </div>
        </div>

        {/* 状态 & 部门 */}
        <div className="record-section">
          <div className="task-form-grid">
            <div>
              <label className="record-label" htmlFor="task-status">状态</label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatus)}
              >
                <option value="pending">未开始</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div>
              <label className="record-label" htmlFor="task-dept">部门</label>
              <input
                id="task-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="例如：组织部"
              />
            </div>
          </div>
        </div>

        {/* 联系人 */}
        <div className="record-section">
          <label className="record-label" htmlFor="task-contact">联系人</label>
          <input
            id="task-contact"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="例如：张主任 / 138****1024"
          />
        </div>

        {/* 标签 */}
        <div className="record-section">
          <label className="record-label">标签</label>
          <div className="record-tags-row">
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`chip-button chip-tag ${selectedTags.includes(tag) ? "chip-tag-active" : ""}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="record-custom-tag">
            <input
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="自定义标签（回车添加）"
            />
            {customTagInput.trim() && (
              <button type="button" className="ghost-button" onClick={addCustomTag}>
                添加
              </button>
            )}
          </div>
          {selectedTags.filter((t) => !PRESET_TAGS.includes(t)).length > 0 && (
            <div className="record-custom-tags-list">
              {selectedTags
                .filter((t) => !PRESET_TAGS.includes(t))
                .map((tag) => (
                  <span key={tag} className="chip-button chip-tag chip-tag-active">
                    {tag}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => toggleTag(tag)}
                      aria-label={`移除标签 ${tag}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* 关联事件 */}
        <div className="record-section">
          <label className="record-label">关联日程（可选）</label>
          {activeEvents.length > 0 ? (
            <div className="record-tags-row">
              {activeEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`chip-button chip-tag ${linkedEventIds.includes(event.id) ? "chip-tag-active" : ""}`}
                  onClick={() => toggleLinkedEvent(event.id)}
                  title={`${event.title}（${event.startTime.slice(0, 16)}）`}
                >
                  📅 {event.title.length > 10 ? event.title.slice(0, 10) + "…" : event.title}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>暂无日程可关联</p>
          )}
        </div>

        {/* 备注 */}
        <div className="record-section">
          <label className="record-label" htmlFor="task-remarks">备注</label>
          <textarea
            id="task-remarks"
            className="record-detail-input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="补充说明、具体步骤、注意事项..."
            rows={4}
          />
        </div>

        {/* 错误提示 */}
        {validationError && (
          <div className="record-error">{validationError}</div>
        )}

        {/* 操作栏 */}
        <div className="record-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            保存任务
          </button>
        </div>
      </div>
    </div>
  );
}
