"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DayTimeline } from "@/components/day-timeline";
import { DiaryTimeline } from "@/components/diary-timeline";
import { SearchPanel } from "@/components/search-panel";
import { TodoTree } from "@/components/todo-tree";
import { departmentOptions, sampleEvents, sampleSearchResults, sampleTodos } from "@/lib/sample-data";
import { buildTodoTree, exportRows, formatDateTime, getFilterValues, getTodayFocus, syncLinkedItems, toJsonBlock } from "@/lib/utils";
import { loadEventsFromStorage, loadTodosFromStorage, saveEventsToStorage, saveTodosToStorage, exportDataAsFile, importDataFromFile } from "@/lib/storage";
import { EventItem, Priority, SearchResult, TodoItem, TodoStatus } from "@/types";

const defaultForm = {
  title: "",
  dueDate: "",
  priority: "medium" as Priority,
  status: "pending" as TodoStatus,
  tags: "",
  department: "",
  contactPerson: "",
  remarks: "",
  linkedEventIds: [] as string[],
};

export default function HomePage() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [{ events, todos }, setData] = useState(() => {
    const storedEvents = loadEventsFromStorage();
    const storedTodos = loadTodosFromStorage();
    
    if (storedEvents && storedTodos) {
      return syncLinkedItems(storedEvents, storedTodos);
    }
    
    return syncLinkedItems(sampleEvents, sampleTodos);
  });
  
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      saveEventsToStorage(events);
      saveTodosToStorage(todos);
    }
  }, [events, todos, isInitialized]);

  const [departmentFilter, setDepartmentFilter] = useState<string>("全部部门");
  const [contactFilter, setContactFilter] = useState<string>("全部联系人");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const departmentChoices = useMemo(
    () => ["全部部门", ...Array.from(new Set([...departmentOptions, ...getFilterValues(todos, "department")]))],
    [todos],
  );
  const contactChoices = useMemo(() => ["全部联系人", ...getFilterValues(todos, "contactPerson")], [todos]);

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchDepartment = departmentFilter === "全部部门" || todo.department === departmentFilter;
      const matchContact = contactFilter === "全部联系人" || todo.contactPerson === contactFilter;
      return matchDepartment && matchContact;
    });
  }, [contactFilter, departmentFilter, todos]);

  const todoTree = useMemo(() => buildTodoTree(filteredTodos), [filteredTodos]);
  const todayFocus = useMemo(() => getTodayFocus(filteredTodos), [filteredTodos]);
  const exportPreview = useMemo(() => toJsonBlock(exportRows(events, todos)), [events, todos]);
  const todayRecords = useMemo(() => events.filter((event) => event.startTime.startsWith("2026-04-13")), [events]);
  const linkedTodoTitles = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo.title])), [todos]);
  const linkedEventTitles = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event.title])), [events]);
  const availableEventOptions = useMemo(() => events, [events]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const baseResults = [
      ...todos.map<SearchResult>((todo) => ({
        id: `todo-${todo.id}`,
        kind: "todo",
        title: todo.title,
        snippet: [todo.department, todo.contactPerson, todo.remarks].filter(Boolean).join(" · ") || "待办事项",
        dateLabel: todo.dueDate ? `截止 ${formatDateTime(todo.dueDate)}` : "未设置截止时间",
        tags: todo.tags,
      })),
      ...events.map<SearchResult>((event) => ({
        id: `event-${event.id}`,
        kind: "event",
        title: event.title,
        snippet: event.detail ?? "时间轴记录",
        dateLabel: formatDateTime(event.startTime),
        tags: event.tags,
      })),
    ];

    if (!normalizedQuery) {
      return baseResults.slice(0, sampleSearchResults.length);
    }

    return baseResults.filter((result) => {
      const haystack = `${result.title} ${result.snippet} ${result.tags.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [events, searchQuery, todos]);

  const handleAddTask = () => {
    if (!form.title.trim()) return;

    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      title: form.title.trim(),
      dueDate: form.dueDate || undefined,
      priority: form.priority,
      status: form.status,
      tags: form.tags
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      department: form.department || undefined,
      contactPerson: form.contactPerson || undefined,
      remarks: form.remarks || undefined,
      parentId: null,
      pinnedToToday: form.status !== "completed" && form.status !== "cancelled",
      linkedEventIds: form.linkedEventIds,
    };

    const nextTodos = [...todos, newTodo];
    const nextEvents: EventItem[] = events.map((event) =>
      form.linkedEventIds.includes(event.id)
        ? { ...event, linkedTodoIds: Array.from(new Set([...(event.linkedTodoIds ?? []), newTodo.id])) }
        : event,
    );

    setData(syncLinkedItems(nextEvents, nextTodos));
    setForm(defaultForm);
  };

  const handleExportData = () => {
    exportDataAsFile(events, todos);
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setImportError(null);
      const { events: importedEvents, todos: importedTodos } = await importDataFromFile(file);
      const synced = syncLinkedItems(importedEvents, importedTodos);
      setData(synced);
      alert("数据导入成功！");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "导入失败");
    } finally {
      event.target.value = "";
    }
  };

  const handleClearData = () => {
    if (confirm("确定要清空所有数据吗？此操作不可恢复！")) {
      const cleared = syncLinkedItems([], []);
      setData(cleared);
      localStorage.removeItem("little-job-helper-events");
      localStorage.removeItem("little-job-helper-todos");
    }
  };

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <header className="page-header panel">
          <div>
            <h1>人事科办公助手</h1>
            <p>聚焦时间轴回溯、今日记录、待办跟进与快速检索。</p>
          </div>
          <div className="page-header-actions">
            <nav className="page-nav">
              <Link href="/" className="page-nav-link active">
                时间轴
              </Link>
              <Link href="/calendar" className="page-nav-link">
                日历
              </Link>
            </nav>
            <div className="search-wide">
              <input defaultValue="组织部 / 张主任 / 职级晋升" aria-label="全局搜索" />
            </div>
            <button className="ghost-button" type="button">
              导出 Excel
            </button>
          </div>
        </header>

        <div className="content-layout simple-layout">
          <section className="content-main">
            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div>
                    <h2>数据管理</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportData}
                      className="ghost-button"
                      type="button"
                    >
                      📥 导出数据
                    </button>
                    <label className="ghost-button cursor-pointer" style={{ margin: 0 }}>
                      📤 导入数据
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportData}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button
                      onClick={handleClearData}
                      className="ghost-button"
                      type="button"
                      style={{ color: '#dc2626' }}
                    >
                      🗑️ 清空数据
                    </button>
                  </div>
                </div>
                
                {importError && (
                  <div style={{ 
                    marginBottom: '12px', 
                    padding: '8px 12px', 
                    background: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '0.875rem'
                  }}>
                    ❌ {importError}
                  </div>
                )}
                
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                  💡 数据自动保存到浏览器本地存储。您可以导出为 JSON 文件备份，或从备份文件导入。
                </p>
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div>
                    <h2>今日待办</h2>
                  </div>
                  <button 
                    className="ghost-button" 
                    type="button"
                    onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                  >
                    {showAddTaskForm ? "收起表单" : "+ 添加任务"}
                  </button>
                </div>
                <div className="focus-list">
                  {todayFocus.length > 0 ? (
                    todayFocus.map((item) => (
                      <div key={item.id} className="focus-item" style={{ 
                        padding: '16px', 
                        marginBottom: '12px', 
                        background: 'var(--card-bg)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text)' }}>{item.title}</h3>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                            {item.department ?? "未指定部门"} · {item.contactPerson ?? "未指定联系人"}
                          </p>
                        </div>
                        <div className="focus-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          <span className={`priority priority-${item.priority}`} style={{ fontSize: '0.75rem' }}>{item.priority}</span>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{formatDateTime(item.dueDate)}</strong>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      <p>暂无今日待办</p>
                    </div>
                  )}
                </div>
                
                {showAddTaskForm && (
                  <div className="task-form" style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
                    <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--text-secondary)" }}>新建任务</h3>
                    <input
                      value={form.title}
                      onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                      placeholder="任务标题"
                    />
                    <input
                      type="datetime-local"
                      value={form.dueDate}
                      onChange={(event) => setForm((value) => ({ ...value, dueDate: event.target.value }))}
                    />
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
                    <input
                      value={form.department}
                      onChange={(event) => setForm((value) => ({ ...value, department: event.target.value }))}
                      placeholder="部门"
                    />
                    <input
                      value={form.contactPerson}
                      onChange={(event) => setForm((value) => ({ ...value, contactPerson: event.target.value }))}
                      placeholder="联系人"
                    />
                    <input
                      value={form.tags}
                      onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))}
                      placeholder="标签，逗号分隔"
                    />
                    <select
                      multiple
                      value={form.linkedEventIds}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          linkedEventIds: Array.from(event.target.selectedOptions, (option) => option.value),
                        }))
                      }
                    >
                      {availableEventOptions.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={form.remarks}
                      onChange={(event) => setForm((value) => ({ ...value, remarks: event.target.value }))}
                      placeholder="备注"
                      rows={4}
                    />
                    <button className="ghost-button add-task-button" type="button" onClick={handleAddTask}>
                      确认添加
                    </button>
                  </div>
                )}
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div>
                    <h2>时间轴</h2>
                    <p className="timeline-note">在时间轴区域滚轮可直接放缩；任务过密时会自动避让并压缩为标题。</p>
                  </div>
                </div>
                <DayTimeline events={events} linkedTodoTitles={linkedTodoTitles} />
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div>
                    <h2>今日工作记录</h2>
                  </div>
                  <button className="ghost-button" type="button">
                    开始记录当前工作
                  </button>
                </div>
                <DiaryTimeline events={todayRecords} />
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div>
                    <h2>待办任务</h2>
                  </div>
                  <div className="filters">
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                      {departmentChoices.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value)}>
                      {contactChoices.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              <TodoTree nodes={todoTree} linkedEventTitles={linkedEventTitles} maxDisplay={showAllTodos ? undefined : 3} />
              {todoTree.length > 3 && (
                <button 
                  className="ghost-button" 
                  type="button"
                  onClick={() => setShowAllTodos(!showAllTodos)}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  {showAllTodos ? "收起" : `展开全部 (${todoTree.length} 个任务)`}
                </button>
              )}
            </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div>
                    <h2>搜索结果</h2>
                  </div>
                </div>
                <SearchPanel results={searchResults} query={searchQuery} onQueryChange={setSearchQuery} />
              </article>
            </section>
          </section>

          <aside className="right-rail panel">
            {/* 右侧边栏预留 */}
          </aside>
        </div>
      </section>
    </main>
  );
}
