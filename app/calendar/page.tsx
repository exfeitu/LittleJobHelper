"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExportPanel } from "@/components/export-panel";
import { HelpIcon } from "@/components/help-icon";
import { SettingsPanel } from "@/components/settings-panel";
import { loadAndMigrateFromStorage, loadSettings, saveEventsToStorage, saveTodosToStorage } from "@/lib/storage";
import { sampleEvents, sampleTodos } from "@/lib/sample-data";
import { formatDateTime, formatDiaryDate, getTodayFocus, syncLinkedItems } from "@/lib/utils";
import { EventItem, Priority, TodoItem, TodoStatus } from "@/types";

function todayStr(): string {
  const d = new Date();
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
  const [{ events, todos }, setData] = useState(() => {
    const stored = loadAndMigrateFromStorage();
    if (stored.events.length > 0 || stored.todos.length > 0) {
      return syncLinkedItems(stored.events, stored.todos);
    }
    return syncLinkedItems(sampleEvents, sampleTodos);
  });
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState(() => makeCalendarFormDefault(today));
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(() => loadSettings() !== null);

  // 数据变更时自动保存到 LocalStorage
  useEffect(() => {
    saveEventsToStorage(events);
    saveTodosToStorage(todos);
  }, [events, todos]);

  const eventsByDate = useMemo(() => events.filter((event) => event.startTime.startsWith(selectedDate)), [events, selectedDate]);
  const todosByDate = useMemo(() => todos.filter((todo) => todo.dueDate?.startsWith(selectedDate)), [todos, selectedDate]);
  const pinnedTodos = useMemo(() => getTodayFocus(todos).slice(0, 6), [todos]);

  const handleAddSchedule = () => {
    if (!form.title.trim()) return;

    const startTime = `${form.date}T${form.startTime}:00`;
    const endTime = `${form.date}T${form.endTime}:00`;
    const eventId = `event-${Date.now()}`;
    const todoId = `todo-${Date.now()}`;
    const tags = form.tags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newEvent: EventItem = {
      id: eventId,
      startTime,
      endTime,
      title: form.title.trim(),
      detail: form.detail || undefined,
      tags,
      linkedTodoIds: [todoId],
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
    };

    const synced = syncLinkedItems([...events, newEvent], [...todos, newTodo]);
    setData(synced);
    saveEventsToStorage(synced.events);
    saveTodosToStorage(synced.todos);
    setSelectedDate(form.date);
    setForm(makeCalendarFormDefault(form.date));
  };

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <header className="page-header panel">
          <div>
            <h1>办公助手</h1>
            <p>聚焦时间轴回溯、今日记录、待办跟进与快速检索。</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <nav className="page-nav">
              <Link href="/" className="page-nav-link">
                时间轴
              </Link>
              <Link href="/calendar" className="page-nav-link active">
                日历
              </Link>
            </nav>

            {/* 同步按钮 → 弹出设置面板 */}
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowSettingsPanel(true)}
            >
              {cloudEnabled ? "☁️" : "⚙️"} 同步
            </button>

            {/* 导出 Excel 按钮 */}
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowExportPanel(true)}
            >
              📊 导出Excel
            </button>

            <input
              className="calendar-date-picker"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
        </header>

        <div className="calendar-layout">
          <section className="panel section-card calendar-main">
            <div className="section-head section-head-tight">
              <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
                <h2>{formatDiaryDate(`${selectedDate}T09:00:00`)}</h2>
                <HelpIcon tips={[
                  "左侧\"当日日程\"显示选中日期的时间安排。",
                  "右侧\"当日待办\"显示截止日期为当天的任务。",
                  "通过顶部日期选择器切换查看日期。",
                  "点击\"添加日程\"可创建新的日程和关联待办。",
                ]} />
              </div>
              <p className="timeline-note">当天日程和待办会在这里汇总显示。</p>
            </div>

            <div className="calendar-columns">
              <div className="calendar-column">
                <h3>当日日程</h3>
                <div className="calendar-list">
                  {eventsByDate.length ? (
                    eventsByDate.map((event) => (
                      <article key={event.id} className="calendar-card">
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
                      <article key={todo.id} className="calendar-card todo-calendar-card">
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
                <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
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
                <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
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
                  <article key={todo.id} className="calendar-card todo-calendar-card">
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
          onDataLoaded={(loadedEvents, loadedTodos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            saveEventsToStorage(synced.events);
            saveTodosToStorage(synced.todos);
            setShowSettingsPanel(false);
          }}
          onClose={() => {
            setShowSettingsPanel(false);
            setCloudEnabled(loadSettings() !== null);
          }}
        />
      )}

      {showExportPanel && (
        <ExportPanel
          events={events}
          todos={todos}
          onClose={() => setShowExportPanel(false)}
        />
      )}
    </main>
  );
}
