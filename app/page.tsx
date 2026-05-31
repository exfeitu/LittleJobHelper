"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DayTimeline } from "@/components/day-timeline";
import { DiaryTimeline } from "@/components/diary-timeline";
import { SearchPanel } from "@/components/search-panel";
import { TodoTree } from "@/components/todo-tree";
import { TaskFormPanel } from "@/components/task-form-panel";
import { WorkRecordPanel } from "@/components/work-record-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { departmentOptions, sampleEvents, sampleSearchResults, sampleTodos } from "@/lib/sample-data";
import { buildTodoTree, exportRows, formatDateTime, getFilterValues, getTodayFocus, syncLinkedItems, toJsonBlock } from "@/lib/utils";
import { loadEventsFromStorage, loadTodosFromStorage, saveEventsToStorage, saveTodosToStorage, exportDataAsFile, importDataFromFile, pushToCloud, loadSettings } from "@/lib/storage";
import { EventItem, SearchResult, TodoItem } from "@/types";

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

  // 云同步自动推送（防抖 3 秒）
  useEffect(() => {
    if (!isInitialized) return;

    const settings = loadSettings();
    if (!settings) return;

    const timer = setTimeout(() => {
      pushToCloud(events, todos);
    }, 3000);

    return () => clearTimeout(timer);
  }, [events, todos, isInitialized]);

  const [departmentFilter, setDepartmentFilter] = useState<string>("全部部门");
  const [contactFilter, setContactFilter] = useState<string>("全部联系人");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showWorkRecordPanel, setShowWorkRecordPanel] = useState(false);
  const [showTaskFormPanel, setShowTaskFormPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(() => loadSettings() !== null);

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
  const todayRecords = useMemo(() => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    return events.filter((event) => event.startTime.startsWith(todayStr));
  }, [events]);
  const linkedTodoTitles = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo.title])), [todos]);
  const linkedEventTitles = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event.title])), [events]);

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

  const handleSaveTask = (newTodo: TodoItem, linkedEventIds: string[]) => {
    const nextTodos = [...todos, newTodo];
    const nextEvents: EventItem[] = events.map((event) =>
      linkedEventIds.includes(event.id)
        ? { ...event, linkedTodoIds: Array.from(new Set([...(event.linkedTodoIds ?? []), newTodo.id])) }
        : event,
    );

    setData(syncLinkedItems(nextEvents, nextTodos));
    setShowTaskFormPanel(false);
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

  const handleSaveWorkRecord = (newEvent: EventItem, linkedTodoId: string | null) => {
    const nextEvents = [...events, newEvent];
    const nextTodos = linkedTodoId
      ? todos.map((todo) =>
          todo.id === linkedTodoId
            ? { ...todo, linkedEventIds: Array.from(new Set([...(todo.linkedEventIds ?? []), newEvent.id])) }
            : todo,
        )
      : todos;

    setData(syncLinkedItems(nextEvents, nextTodos));
    setShowWorkRecordPanel(false);
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
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowSettingsPanel(true)}
              title="云同步设置"
            >
              {cloudEnabled ? "☁️" : "⚙️"} 同步
            </button>
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
                    <h2>今日待办</h2>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setShowWorkRecordPanel(true)}
                    >
                      📝 快速记录工作
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setShowTaskFormPanel(true)}
                    >
                      + 添加任务
                    </button>
                  </div>
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
              </article>
            </section>

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
                    <h2>今日工作记录</h2>
                  </div>
                </div>
                <DiaryTimeline events={todayRecords} />
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

      {showWorkRecordPanel && (
        <WorkRecordPanel
          events={events}
          todos={todos}
          linkedTodoTitles={linkedTodoTitles}
          onSave={handleSaveWorkRecord}
          onClose={() => setShowWorkRecordPanel(false)}
        />
      )}

      {showTaskFormPanel && (
        <TaskFormPanel
          events={events}
          onSave={handleSaveTask}
          onClose={() => setShowTaskFormPanel(false)}
        />
      )}

      {showSettingsPanel && (
        <SettingsPanel
          events={events}
          todos={todos}
          onDataLoaded={(loadedEvents, loadedTodos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            // 立即保存到本地
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
    </main>
  );
}
