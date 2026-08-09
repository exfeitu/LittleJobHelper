"use client";

import { useCallback, useMemo, useState } from "react";
import { ExportPanel } from "@/components/export-panel";
import { HelpIcon } from "@/components/help-icon";
import { SettingsPanel } from "@/components/settings-panel";
import { TaskFormPanel } from "@/components/task-form-panel";
import { WorkRecordPanel } from "@/components/work-record-panel";
import { AppHeader } from "@/components/app-header";
import { BackupReminder } from "@/components/backup-reminder";
import { syncLinkedItems } from "@/lib/utils";
import { formatDateTime, formatDiaryDate, getTodayFocus } from "@/lib/utils";
import { genId } from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { EventItem, Priority, TodoItem, TodoStatus } from "@/types";
import { useAppData } from "@/hooks/use-app-data";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDay(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeCalendarFormDefault(date: string) {
  return {
    title: "",
    date,
    startTime: "09:00",
    endTime: "10:00",
    detail: "",
    tags: "",
    priority: "medium" as Priority,
    status: "pending" as TodoStatus,
  };
}

export default function CalendarPage() {
  const {
    events, todos, customTags, isInitialized, cloudEnabled, isOnline,
    syncStatus, syncError, canUndo, addCustomTag, deleteCustomTag,
    setCustomTags, setData, undo, refreshCloudStatus,
  } = useAppData();

  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState(() => makeCalendarFormDefault(today));
  const [showWorkRecordPanel, setShowWorkRecordPanel] = useState(false);
  const [showTaskFormPanel, setShowTaskFormPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | undefined>(undefined);
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>(undefined);

  const eventsByDate = useMemo(() => events.filter((event) => event.startTime.startsWith(selectedDate)), [events, selectedDate]);
  const todosByDate = useMemo(() => todos.filter((todo) => todo.dueDate?.startsWith(selectedDate)), [todos, selectedDate]);
  const pinnedTodos = useMemo(() => getTodayFocus(todos).slice(0, 6), [todos]);

  const handleAddSchedule = () => {
    if (!form.title.trim()) return;

    const startTime = `${form.date}T${form.startTime}:00`;
    const endTime = `${form.date}T${form.endTime}:00`;
    const eventId = genId("event");
    const todoId = genId("todo");
    const tags = form.tags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    const now = new Date().toISOString();
    const newEvent: EventItem = {
      id: eventId,
      startTime,
      endTime,
      title: form.title.trim(),
      detail: form.detail || undefined,
      tags,
      linkedTodoIds: [todoId],
      updatedAt: now,
    };

    const newTodo: TodoItem = {
      id: todoId,
      title: form.title.trim(),
      dueDate: endTime,
      priority: form.priority,
      status: form.status,
      tags,
      remarks: form.detail || undefined,
      parentId: null,
      pinnedToToday: form.date === selectedDate,
      linkedEventIds: [eventId],
      updatedAt: now,
    };

    const synced = syncLinkedItems([...events, newEvent], [...todos, newTodo]);
    setData(synced);
    setSelectedDate(form.date);
    setForm(makeCalendarFormDefault(form.date));
  };

  const handleSaveTask = useCallback((todo: TodoItem) => {
    const isUpdate = todos.some((t) => t.id === todo.id);
    const nextTodos = isUpdate
      ? todos.map((t) => (t.id === todo.id ? todo : t))
      : [...todos, todo];
    setData(syncLinkedItems(events, nextTodos));
    setShowTaskFormPanel(false);
    setEditingTodo(undefined);
  }, [events, todos, setData]);

  const handleSaveWorkRecord = useCallback((event: EventItem, linkedTodoId: string | null) => {
    const isUpdate = events.some((e) => e.id === event.id);
    const nextEvents = isUpdate
      ? events.map((e) => (e.id === event.id ? event : e))
      : [...events, event];
    const nextTodos = linkedTodoId
      ? todos.map((todo) =>
          todo.id === linkedTodoId
            ? { ...todo, linkedEventIds: Array.from(new Set([...(todo.linkedEventIds ?? []), event.id])) }
            : todo,
        )
      : isUpdate
        ? todos.map((todo) => ({
            ...todo,
            linkedEventIds: (todo.linkedEventIds ?? []).filter((id) => id !== event.id),
          }))
        : todos;
    setData(syncLinkedItems(nextEvents, nextTodos));
    setShowWorkRecordPanel(false);
    setEditingEvent(undefined);
  }, [events, todos, setData]);

  const handleDeleteEvent = useCallback((id: string) => {
    const nextEvents = events.filter((e) => e.id !== id);
    const nextTodos = todos.map((todo) => ({
      ...todo,
      linkedEventIds: (todo.linkedEventIds ?? []).filter((eid) => eid !== id),
    }));
    setData(syncLinkedItems(nextEvents, nextTodos));
    setEditingEvent(undefined);
  }, [events, todos, setData]);

  const handleDeleteTodo = useCallback((id: string) => {
    const nextTodos = todos.filter((t) => t.id !== id);
    const nextEvents = events.map((event) => ({
      ...event,
      linkedTodoIds: (event.linkedTodoIds ?? []).filter((tid) => tid !== id),
    }));
    setData(syncLinkedItems(nextEvents, nextTodos));
    setEditingTodo(undefined);
  }, [events, todos, setData]);

  useKeyboardShortcuts({
    onNewTask: () => setShowTaskFormPanel(true),
    onNewRecord: () => setShowWorkRecordPanel(true),
    onUndo: undo,
    onEscape: () => {
      setShowWorkRecordPanel(false);
      setShowTaskFormPanel(false);
      setShowSettingsPanel(false);
      setShowExportPanel(false);
      setEditingEvent(undefined);
      setEditingTodo(undefined);
    },
  });

  if (!isInitialized) {
    return (
      <main className="app-shell">
        <div className="skeleton-block" style={{ height: 84 }} />
        <div className="skeleton-block" style={{ height: 420 }} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <AppHeader
          activePage="calendar"
          tips={[
            "聚焦时间轴回溯、今日记录、待办跟进与快速检索。",
            "日历模式按日期汇总当日日程和待办。",
            "支持添加日程并自动关联待办任务。",
            "快捷键：Ctrl+N 新建任务 · Ctrl+Shift+N 快速记录 · Ctrl+Z 撤销。",
          ]}
          cloudEnabled={cloudEnabled}
          isOnline={isOnline}
          syncStatus={syncStatus}
          syncError={syncError}
          onQuickRecord={() => setShowWorkRecordPanel(true)}
          onAddTask={() => setShowTaskFormPanel(true)}
          onOpenSync={() => setShowSettingsPanel(true)}
          onOpenExport={() => setShowExportPanel(true)}
        />

        <div className="calendar-layout">
          <section className="panel section-card calendar-main">
            <div className="section-head section-head-tight">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2>{formatDiaryDate(`${selectedDate}T09:00:00`)}</h2>
                <HelpIcon tips={[
                  "左侧\"当日日程\"显示选中日期的时间安排。",
                  "右侧\"当日待办\"显示截止日期为当天的任务。",
                  "使用日期选择器或两侧箭头切换日期。",
                  "点击日程 / 待办卡片可直接编辑或删除。",
                ]} />
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  title="撤销上一步 (Ctrl+Z)"
                >
                  ↩ 撤销
                </button>
                <button
                  className="axis-today-button"
                  type="button"
                  onClick={() => setSelectedDate((d) => shiftDay(d, -1))}
                  title="前一天"
                >
                  ◀
                </button>
                <button
                  className="axis-today-button"
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  title="回到今天"
                >
                  今天
                </button>
                <button
                  className="axis-today-button"
                  type="button"
                  onClick={() => setSelectedDate((d) => shiftDay(d, 1))}
                  title="后一天"
                >
                  ▶
                </button>
                <input
                  className="calendar-date-picker"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </div>

            <div className="calendar-columns">
              <div className="calendar-column">
                <h3>当日日程</h3>
                <div className="calendar-list">
                  {eventsByDate.length ? (
                    eventsByDate.map((event) => (
                      <article
                        key={event.id}
                        className="calendar-card calendar-card-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingEvent(event)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingEvent(event); }
                        }}
                      >
                        <strong>
                          {event.startTime.slice(11, 16)} - {event.endTime.slice(11, 16)}
                        </strong>
                        <h4>{event.title}</h4>
                        <p>{event.detail}</p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-note">当天还没有日程。</p>
                  )}
                </div>
              </div>

              <div className="calendar-column">
                <h3>当日待办</h3>
                <div className="calendar-list">
                  {todosByDate.length ? (
                    todosByDate.map((todo) => (
                      <article
                        key={todo.id}
                        className="calendar-card todo-calendar-card calendar-card-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingTodo(todo)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingTodo(todo); }
                        }}
                      >
                        <strong>{formatDateTime(todo.dueDate)}</strong>
                        <h4>{todo.title}</h4>
                        <p>{todo.remarks ?? "无备注"}</p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-note">当天还没有待办。</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="calendar-side">
            <section className="panel section-card">
              <div className="section-head section-head-tight">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <h2>添加日程</h2>
                  <HelpIcon tips={[
                    "填写日程标题、日期和时间段信息。",
                    "选择优先级和状态生成关联待办。",
                    "标签用于分类检索，多个标签用逗号分隔。",
                    "保存后同时创建日程记录和关联待办任务。",
                  ]} />
                </div>
              </div>
              <div className="task-form">
                <input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="日程标题" />
                <input type="date" value={form.date} onChange={(event) => setForm((value) => ({ ...value, date: event.target.value }))} />
                <div className="task-form-grid">
                  <input type="time" value={form.startTime} onChange={(event) => setForm((value) => ({ ...value, startTime: event.target.value }))} />
                  <input type="time" value={form.endTime} onChange={(event) => setForm((value) => ({ ...value, endTime: event.target.value }))} />
                </div>
                <div className="task-form-grid">
                  <select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value as Priority }))}>
                    <option value="high">高优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="low">低优先级</option>
                  </select>
                  <select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as TodoStatus }))}>
                    <option value="pending">未开始</option>
                    <option value="in_progress">进行中</option>
                    <option value="completed">已完成</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </div>
                <input value={form.tags} onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))} placeholder="标签，逗号分隔" />
                <textarea value={form.detail} onChange={(event) => setForm((value) => ({ ...value, detail: event.target.value }))} rows={4} placeholder="日程说明" />
                <button className="ghost-button add-task-button" type="button" onClick={handleAddSchedule}>
                  添加日程并生成待办
                </button>
              </div>
            </section>

            <section className="panel section-card">
              <div className="section-head section-head-tight">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <h2>重点待办</h2>
                  <HelpIcon tips={[
                    "展示所有标记为\"重点关注\"的待办任务。",
                    "限时 6 条，优先显示截止日期最紧迫的任务。",
                    "在主页\"今日待办\"中可管理待办的优先级。",
                    "完成的待办会自动从列表中移除。",
                  ]} />
                </div>
              </div>
              <div className="calendar-list">
                {pinnedTodos.map((todo) => (
                  <article
                    key={todo.id}
                    className="calendar-card todo-calendar-card calendar-card-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingTodo(todo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingTodo(todo); }
                    }}
                  >
                    <strong>{formatDateTime(todo.dueDate)}</strong>
                    <h4>{todo.title}</h4>
                    <p>{todo.remarks ?? "无备注"}</p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>

      {showSettingsPanel && (
        <SettingsPanel
          events={events}
          todos={todos}
          customTags={customTags}
          onDataLoaded={(loadedEvents, loadedTodos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            setShowSettingsPanel(false);
          }}
          onClose={() => {
            setShowSettingsPanel(false);
            refreshCloudStatus();
          }}
        />
      )}

      {showExportPanel && (
        <ExportPanel
          events={events}
          todos={todos}
          customTags={customTags}
          onImport={(loadedEvents, loadedTodos, loadedTags) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            // 标签随导入覆盖（旧备份无标签字段时 importDataFromFile 已回退为保留本地标签）
            setCustomTags(loadedTags);
          }}
          onClose={() => setShowExportPanel(false)}
        />
      )}

      <BackupReminder onOpenExport={() => setShowExportPanel(true)} />

      {showWorkRecordPanel && (
        <WorkRecordPanel
          events={events}
          todos={todos}
          linkedTodoTitles={Object.fromEntries(todos.map((todo) => [todo.id, todo.title]))}
          customTags={customTags}
          onTagCreated={addCustomTag}
          onTagDeleted={deleteCustomTag}
          onSave={handleSaveWorkRecord}
          onClose={() => setShowWorkRecordPanel(false)}
        />
      )}

      {showTaskFormPanel && (
        <TaskFormPanel
          customTags={customTags}
          onTagCreated={addCustomTag}
          onSave={handleSaveTask}
          onClose={() => setShowTaskFormPanel(false)}
        />
      )}

      {editingEvent && (
        <WorkRecordPanel
          events={events}
          todos={todos}
          linkedTodoTitles={Object.fromEntries(todos.map((todo) => [todo.id, todo.title]))}
          editEvent={editingEvent}
          customTags={customTags}
          onTagDeleted={deleteCustomTag}
          onTagCreated={addCustomTag}
          onSave={handleSaveWorkRecord}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(undefined)}
        />
      )}

      {editingTodo && (
        <TaskFormPanel
          editTodo={editingTodo}
          customTags={customTags}
          onTagCreated={addCustomTag}
          onSave={handleSaveTask}
          onDelete={handleDeleteTodo}
          onClose={() => setEditingTodo(undefined)}
        />
      )}

    </main>
  );
}
