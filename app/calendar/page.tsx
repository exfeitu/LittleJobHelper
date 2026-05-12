"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sampleEvents, sampleTodos } from "@/lib/sample-data";
import { formatDateTime, formatDiaryDate, getTodayFocus, syncLinkedItems } from "@/lib/utils";
import { EventItem, Priority, TodoItem, TodoStatus } from "@/types";

const calendarFormDefault = {
  title: "",
  date: "2026-04-14",
  startTime: "09:00",
  endTime: "10:00",
  detail: "",
  tags: "",
  priority: "medium" as Priority,
  status: "pending" as TodoStatus,
};

export default function CalendarPage() {
  const [{ events, todos }, setData] = useState(() => syncLinkedItems(sampleEvents, sampleTodos));
  const [selectedDate, setSelectedDate] = useState("2026-04-13");
  const [form, setForm] = useState(calendarFormDefault);

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

    setData(syncLinkedItems([...events, newEvent], [...todos, newTodo]));
    setSelectedDate(form.date);
    setForm(calendarFormDefault);
  };

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <header className="page-header panel">
          <div>
            <h1>日历视图</h1>
            <p>按天查看日程，新增事件时同步生成待办。</p>
          </div>
          <div className="page-header-actions">
            <nav className="page-nav">
              <Link href="/" className="page-nav-link">
                时间轴
              </Link>
              <Link href="/calendar" className="page-nav-link active">
                日历
              </Link>
            </nav>
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
              <div>
                <h2>{formatDiaryDate(`${selectedDate}T09:00:00`)}</h2>
                <p className="timeline-note">当天日程和待办会在这里汇总显示。</p>
              </div>
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
                <div>
                  <h2>添加日程</h2>
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
                <div>
                  <h2>重点待办</h2>
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
    </main>
  );
}
