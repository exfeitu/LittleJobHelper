"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { DayTimeline } from "@/components/day-timeline";
import { DiaryTimeline } from "@/components/diary-timeline";
import { SearchPanel } from "@/components/search-panel";
import { TodoTree } from "@/components/todo-tree";
import { TaskFormPanel } from "@/components/task-form-panel";
import { WorkRecordPanel } from "@/components/work-record-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { ExportPanel } from "@/components/export-panel";
import { HelpIcon } from "@/components/help-icon";
import { departmentOptions } from "@/lib/sample-data";
import { buildTodoTree, formatDateTime, getFilterValues, getTodayFocus, syncLinkedItems } from "@/lib/utils";
import { EventItem, SearchResult, TodoItem } from "@/types";
import { useAppData } from "@/hooks/use-app-data";

export default function HomePage() {
  const {
    events, todos, customTags, isInitialized, cloudEnabled,
    addCustomTag, deleteCustomTag, setData, refreshCloudStatus,
  } = useAppData();

  const [departmentFilter, setDepartmentFilter] = useState<string>("全部部门");
  const [contactFilter, setContactFilter] = useState<string>("全部联系人");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [showWorkRecordPanel, setShowWorkRecordPanel] = useState(false);
  const [showTaskFormPanel, setShowTaskFormPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | undefined>(undefined);
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>(undefined);

  // 时间轴缩放控制（状态提升到 header 工具栏）
  const [timelineScale, setTimelineScale] = useState(0.35);
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const MIN_SCALE = 0.03;
  const MAX_SCALE = 24;
  const BASE_VISIBLE_DAYS = 1;
  const visibleDays = BASE_VISIBLE_DAYS / timelineScale;

  // "今天"按钮：单击→日期选择；双击→30天视图+回到今天
  const todayClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayClickCount = useRef(0);
  const [showTodayPicker, setShowTodayPicker] = useState(false);
  const [scrollToDate, setScrollToDate] = useState<string | undefined>(undefined);

  const handleTodayClick = useCallback(() => {
    todayClickCount.current += 1;
    if (todayClickCount.current === 1) {
      todayClickTimer.current = setTimeout(() => {
        // 单击 → 7天视图 + 回到今天
        setTimelineScale(BASE_VISIBLE_DAYS / 7);
        setScrollToTodayTrigger((v) => v + 1);
        todayClickCount.current = 0;
      }, 250);
    } else if (todayClickCount.current >= 2) {
      if (todayClickTimer.current) clearTimeout(todayClickTimer.current);
      todayClickCount.current = 0;
      // 双击 → 日期选择器
      setShowTodayPicker(true);
    }
  }, []);

  const handleTodayPickerChange = useCallback((date: string) => {
    setShowTodayPicker(false);
    if (!date) return;
    setTimelineScale(1.0); // 1天视图
    setScrollToDate(date);
  }, []);

  // "X天"按钮：单击→自定义天数；双击→3天视图
  const daysClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daysClickCount = useRef(0);
  const [showDaysInput, setShowDaysInput] = useState(false);
  const [customDays, setCustomDays] = useState("3");

  const handleDaysClick = useCallback(() => {
    daysClickCount.current += 1;
    if (daysClickCount.current === 1) {
      daysClickTimer.current = setTimeout(() => {
        // 单击 → 恢复3天视图
        setTimelineScale(0.35);
        daysClickCount.current = 0;
      }, 250);
    } else if (daysClickCount.current >= 2) {
      if (daysClickTimer.current) clearTimeout(daysClickTimer.current);
      daysClickCount.current = 0;
      // 双击 → 自定义天数输入
      setCustomDays(String(Math.round(BASE_VISIBLE_DAYS / timelineScale * 10) / 10));
      setShowDaysInput(true);
    }
  }, [timelineScale]);

  const handleCustomDaysSubmit = useCallback(() => {
    setShowDaysInput(false);
    const days = parseFloat(customDays);
    if (isNaN(days) || days <= 0) return;
    const targetScale = BASE_VISIBLE_DAYS / days;
    setTimelineScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(targetScale).toFixed(4))));
  }, [customDays]);

  const handleTagCreated = addCustomTag;
  const handleTagDeleted = deleteCustomTag;

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
    const baseResults: SearchResult[] = [
      ...todos.map((todo) => ({
        id: `todo-${todo.id}`,
        kind: "todo" as const,
        title: todo.title,
        snippet: [todo.department, todo.contactPerson, todo.remarks].filter(Boolean).join(" · ") || "待办事项",
        dateLabel: todo.dueDate ? `截止 ${formatDateTime(todo.dueDate)}` : "未设置截止时间",
        tags: todo.tags,
      })),
      ...events.map((event) => ({
        id: `event-${event.id}`,
        kind: "event" as const,
        title: event.title,
        snippet: event.detail ?? "工作记录",
        dateLabel: formatDateTime(event.startTime),
        tags: event.tags,
      })),
    ];

    if (!normalizedQuery) {
      return [];
    }

    return baseResults.filter((result) => {
      const haystack = `${result.title} ${result.snippet} ${result.tags.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [events, searchQuery, todos]);

  const handleSaveTask = (todo: TodoItem) => {
    const isUpdate = todos.some((t) => t.id === todo.id);
    const nextTodos = isUpdate
      ? todos.map((t) => (t.id === todo.id ? todo : t))
      : [...todos, todo];

    setData(syncLinkedItems(events, nextTodos));
    setShowTaskFormPanel(false);
    setEditingTodo(undefined);
  };

  const handleSaveWorkRecord = (event: EventItem, linkedTodoId: string | null) => {
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
  };

  const handleDeleteEvent = (id: string) => {
    const nextEvents = events.filter((e) => e.id !== id);
    const nextTodos = todos.map((todo) => ({
      ...todo,
      linkedEventIds: (todo.linkedEventIds ?? []).filter((eid) => eid !== id),
    }));
    setData(syncLinkedItems(nextEvents, nextTodos));
    setEditingEvent(undefined);
  };

  const handleDeleteTodo = (id: string) => {
    const nextTodos = todos.filter((t) => t.id !== id);
    const nextEvents = events.map((event) => ({
      ...event,
      linkedTodoIds: (event.linkedTodoIds ?? []).filter((tid) => tid !== id),
    }));
    setData(syncLinkedItems(nextEvents, nextTodos));
    setEditingTodo(undefined);
  };

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <header className="page-header panel">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "clamp(2.4rem, 3vw, 3.2rem)" }}>办公助手</h1>
            <HelpIcon tips={[
              "聚焦时间轴回溯、今日记录、待办跟进与快速检索。",
              "时间轴支持鼠标滚轮缩放（1小时 ~ 30天）和拖拽平移。",
              "待办和工作记录自动同步到 GitHub Gist 云端。",
              "使用右上角搜索框可以快速查找内容。",
            ]} />
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <nav className="page-nav">
              <Link href="/" className="page-nav-link active">
                时间轴
              </Link>
              <Link href="/calendar" className="page-nav-link">
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

            {/* 导出 Excel 按钮 → 弹出设置面板 */}
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowExportPanel(true)}
            >
              📊 导出Excel
            </button>

          </div>
        </header>

        <div className="content-layout simple-layout">
          <section className="content-main">
            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>今日待办</h2>
                    <HelpIcon tips={[
                      "显示今日需要跟进的待办任务，按优先级排列。",
                      "点击\"📝 快速记录工作\"添加新的工作记录。",
                      "点击\"+ 添加任务\"创建新的待办任务。",
                      "点击时间轴上的卡片可直接编辑或删除。",
                    ]} />
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
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>时间轴</h2>
                    <HelpIcon tips={[
                      "🖱 滚轮：缩放时间轴（1小时 ~ 30天）",
                      "🖱 拖拽滚动条：移动时间窗口",
                      "👆 点击卡片：编辑工作记录 / 待办",
                      "📌 菱形标记：待办任务（橙色虚线卡片）",
                      "● 圆点标记：工作记录（实线卡片）",
                    ]} />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="axis-today-button"
                      type="button"
                      onClick={handleTodayClick}
                      title="单击回到今天30天视图 · 双击选择日期"
                    >
                      今天
                    </button>
                    {showTodayPicker && (
                      <input
                        type="date"
                        className="today-date-picker-inline"
                        value={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => handleTodayPickerChange(e.target.value)}
                        onBlur={() => setShowTodayPicker(false)}
                        autoFocus
                      />
                    )}
                    <button
                      className="axis-today-button"
                      type="button"
                      onClick={handleDaysClick}
                      title="单击恢复3天视图 · 双击自定义天数"
                    >
                      {Math.round(visibleDays * 10) / 10}天
                    </button>
                    {showDaysInput && (
                      <input
                        type="number"
                        className="today-date-picker-inline"
                        style={{ width: 60 }}
                        value={customDays}
                        min={0.04}
                        max={33}
                        step={0.5}
                        onChange={(e) => setCustomDays(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCustomDaysSubmit(); }}
                        onBlur={handleCustomDaysSubmit}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
                <DayTimeline events={events} todos={todos} linkedTodoTitles={linkedTodoTitles} onEventClick={setEditingEvent} onTodoClick={setEditingTodo} scale={timelineScale} onScaleChange={setTimelineScale} scrollToTodayTrigger={scrollToTodayTrigger} scrollToDate={scrollToDate} />
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>待办任务</h2>
                    <HelpIcon tips={[
                      "使用顶部下拉菜单按\"部门\"和\"联系人\"筛选待办。",
                      "默认显示前3个待办，点击\"展开全部\"查看所有任务。",
                      "点击任意待办卡片可编辑内容或删除。",
                      "待办支持设置优先级、状态、截止时间和子任务拆分。",
                    ]} />
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
              <TodoTree nodes={todoTree} linkedEventTitles={linkedEventTitles} maxDisplay={showAllTodos ? undefined : 3} onTodoClick={setEditingTodo} />
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
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>今日工作记录</h2>
                    <HelpIcon tips={[
                      "以时间线形式展示今日新增的工作记录。",
                      "点击\"📝 快速记录工作\"添加新的工作记录。",
                      "每条记录包含标题、详情、标签和关联待办。",
                      "点击时间轴上的记录卡片可编辑或删除。",
                    ]} />
                  </div>
                </div>
                <DiaryTimeline events={todayRecords} />
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>搜索结果</h2>
                    <HelpIcon tips={[
                      "输入关键词后自动搜索匹配的待办和工作记录。",
                      "搜索范围包括标题、内容和标签。",
                      "结果按类型（待办 / 事件）分组显示。",
                      "清空搜索框可恢复默认列表。",
                    ]} />
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
          customTags={customTags}
          onTagCreated={handleTagCreated}
          onTagDeleted={handleTagDeleted}
          onSave={handleSaveWorkRecord}
          onClose={() => setShowWorkRecordPanel(false)}
        />
      )}

      {showTaskFormPanel && (
        <TaskFormPanel
          customTags={customTags}
          onTagCreated={handleTagCreated}
          onSave={handleSaveTask}
          onClose={() => setShowTaskFormPanel(false)}
        />
      )}

      {/* 编辑工作记录（从时间轴点击进入） */}
      {editingEvent && (
        <WorkRecordPanel
          events={events}
          todos={todos}
          linkedTodoTitles={linkedTodoTitles}
          editEvent={editingEvent}
          customTags={customTags}
          onTagDeleted={handleTagDeleted}
          onTagCreated={handleTagCreated}
          onSave={handleSaveWorkRecord}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(undefined)}
        />
      )}

      {/* 编辑任务（从待办树点击进入） */}
      {editingTodo && (
        <TaskFormPanel
          editTodo={editingTodo}
          customTags={customTags}
          onTagCreated={handleTagCreated}
          onSave={handleSaveTask}
          onDelete={handleDeleteTodo}
          onClose={() => setEditingTodo(undefined)}
        />
      )}

      {showSettingsPanel && (
        <SettingsPanel
          events={events}
          todos={todos}
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
          onClose={() => setShowExportPanel(false)}
        />
      )}

    </main>
  );
}
