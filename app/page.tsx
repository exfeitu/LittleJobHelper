"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DayTimeline } from "@/components/day-timeline";
import { DiaryTimeline } from "@/components/diary-timeline";
import { SearchPanel } from "@/components/search-panel";
import { TodoTree } from "@/components/todo-tree";
import { ArchivedTodosPanel } from "@/components/archived-todos-panel";
import { TaskFormPanel } from "@/components/task-form-panel";
import { WorkRecordPanel } from "@/components/work-record-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { ExportPanel } from "@/components/export-panel";
import { AppHeader } from "@/components/app-header";
import { BackupReminder } from "@/components/backup-reminder";
import { StatsDashboard } from "@/components/stats-dashboard";
import { HelpIcon } from "@/components/help-icon";
import { departmentOptions } from "@/lib/sample-data";
import {
  buildTodoTree,
  formatDateTime,
  getFilterValues,
  getTodayFocus,
  isTodoActive,
  isTodoArchived,
  syncLinkedItems,
  toPinyin,
  toPinyinInitials,
} from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { EventItem, SearchResult, TodoItem } from "@/types";
import { useAppData } from "@/hooks/use-app-data";
import { htmlToText, memoProgress, memoSearchText } from "@/lib/memo";

/** 搜索结果 + 拼音字段（预计算，避免每次按键重复转换） */
type SearchItem = SearchResult & { pinyin: string; initials: string };

export default function HomePage() {
  const {
    events, todos, memos, setMemos, customTags, isInitialized, cloudEnabled, isOnline,
    syncStatus, syncError, canUndo, addCustomTag, deleteCustomTag,
    setCustomTags, setData, undo, refreshCloudStatus,
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
  const [selectedTodoIds, setSelectedTodoIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 时间轴缩放控制（状态提升到 header 工具栏）
  const [timelineScale, setTimelineScale] = useState(1 / 7);
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

  // 待办列表只显示未完成的（未开始/进行中）；已完成/已取消进入归档区
  const activeTodos = useMemo(() => filteredTodos.filter(isTodoActive), [filteredTodos]);
  const archivedTodos = useMemo(() => filteredTodos.filter(isTodoArchived), [filteredTodos]);
  // 时间轴同样只展示未完成待办，避免已完成卡片造成"还有事没办"的误导（已完成的去归档区查看）
  const timelineTodos = useMemo(() => todos.filter(isTodoActive), [todos]);

  const todoTree = useMemo(() => buildTodoTree(activeTodos), [activeTodos]);
  const archivedTodoTree = useMemo(() => buildTodoTree(archivedTodos), [archivedTodos]);
  const todayFocus = useMemo(() => getTodayFocus(filteredTodos), [filteredTodos]);
  const todayRecords = useMemo(() => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    return events.filter((event) => event.startTime.startsWith(todayStr));
  }, [events]);
  const linkedTodoTitles = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo.title])), [todos]);
  const linkedEventTitles = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event.title])), [events]);

  // 预计算全部搜索项（含拼音），仅在数据变化时重建
  const allSearchItems = useMemo<SearchItem[]>(() => {
    const build = (items: SearchItem[]) => items;
    return build([
      ...todos.map((todo) => {
        const text = `${todo.title} ${todo.department ?? ""} ${todo.contactPerson ?? ""} ${todo.remarks ?? ""} ${todo.tags.join(" ")}`;
        return {
          id: `todo-${todo.id}`,
          kind: "todo" as const,
          title: todo.title,
          snippet: [todo.department, todo.contactPerson, todo.remarks].filter(Boolean).join(" · ") || "待办事项",
          dateLabel: todo.dueDate ? `截止 ${formatDateTime(todo.dueDate)}` : "未设置截止时间",
          tags: todo.tags,
          pinyin: toPinyin(text),
          initials: toPinyinInitials(text),
        };
      }),
      ...events.map((event) => {
        const text = `${event.title} ${event.detail ?? ""} ${event.tags.join(" ")}`;
        return {
          id: `event-${event.id}`,
          kind: "event" as const,
          title: event.title,
          snippet: event.detail ?? "工作记录",
          dateLabel: formatDateTime(event.startTime),
          tags: event.tags,
          pinyin: toPinyin(text),
          initials: toPinyinInitials(text),
        };
      }),
      ...memos.map((memo) => {
        const text = memoSearchText(memo);
        const progress = memo.type === "checklist" ? memoProgress(memo) : null;
        return {
          id: `memo-${memo.id}`,
          kind: "memo" as const,
          title: memo.title,
          snippet:
            memo.type === "checklist"
              ? progress && progress.total > 0
                ? `周期备忘 · ${progress.completed}/${progress.total} 步`
                : "周期备忘"
              : htmlToText(memo.content ?? "").slice(0, 80) || "复盘心得",
          dateLabel: memo.date ? `备忘 ${memo.date}` : "备忘录",
          tags: memo.tags,
          pinyin: toPinyin(text),
          initials: toPinyinInitials(text),
        };
      }),
    ]);
  }, [events, todos, memos]);

  // 过滤（依赖 query 变化；拼音支持全拼 + 首字母）
  const searchResults = useMemo<SearchResult[]>(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return allSearchItems.filter((result) => {
      const haystack = `${result.title} ${result.snippet} ${result.tags.join(" ")}`.toLowerCase();
      return (
        haystack.includes(normalizedQuery) ||
        result.pinyin.includes(normalizedQuery) ||
        result.initials.includes(normalizedQuery)
      );
    });
  }, [allSearchItems, searchQuery]);

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

  // 归档恢复：一键改回"进行中"，回到待办列表
  const handleRestoreTodo = (id: string) => {
    const nextTodos = todos.map((t) =>
      t.id === id ? { ...t, status: "in_progress" as const, updatedAt: new Date().toISOString() } : t,
    );
    setData(syncLinkedItems(events, nextTodos));
  };

  // 批量选择
  const toggleSelectTodo = useCallback((id: string) => {
    setSelectedTodoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const batchDeleteTodos = useCallback(() => {
    if (selectedTodoIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedTodoIds.size} 个待办？此操作不可恢复。`)) return;
    const nextTodos = todos.filter((t) => !selectedTodoIds.has(t.id));
    const nextEvents = events.map((event) => ({
      ...event,
      linkedTodoIds: (event.linkedTodoIds ?? []).filter((tid) => !selectedTodoIds.has(tid)),
    }));
    setData(syncLinkedItems(nextEvents, nextTodos));
    setSelectedTodoIds(new Set());
  }, [selectedTodoIds, todos, events, setData]);

  const batchSetStatus = useCallback((status: TodoItem["status"]) => {
    if (selectedTodoIds.size === 0) return;
    const nextTodos = todos.map((t) =>
      selectedTodoIds.has(t.id)
        ? { ...t, status, updatedAt: new Date().toISOString() }
        : t,
    );
    setData(syncLinkedItems(events, nextTodos));
    setSelectedTodoIds(new Set());
  }, [selectedTodoIds, todos, events, setData]);

  // 键盘快捷键
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
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

  // 未初始化时显示骨架屏
  if (!isInitialized) {
    return (
      <main className="app-shell">
        <div className="skeleton-block" style={{ height: 84 }} />
        <div className="skeleton-block" style={{ height: 420 }} />
        <div className="two-col">
          <div className="skeleton-block" style={{ height: 220 }} />
          <div className="skeleton-block" style={{ height: 220 }} />
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <AppHeader
          activePage="timeline"
          tips={[
            "聚焦时间轴回溯、今日记录、待办跟进与快速检索。",
            "时间轴支持鼠标滚轮缩放（1小时 ~ 30天）和拖拽平移。",
            "待办和工作记录自动同步到 GitHub Gist 云端。",
            "快捷键：Ctrl+K 搜索 · Ctrl+N 新建任务 · Ctrl+Shift+N 快速记录 · Ctrl+Z 撤销。",
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

        <div className="content-layout simple-layout">
          <section className="content-main">
            {/* 时间轴 —— 第一个功能模块，独占全宽 */}
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
                <DayTimeline events={events} todos={timelineTodos} linkedTodoTitles={linkedTodoTitles} onEventClick={setEditingEvent} onTodoClick={setEditingTodo} scale={timelineScale} onScaleChange={setTimelineScale} scrollToTodayTrigger={scrollToTodayTrigger} scrollToDate={scrollToDate} />
              </article>
            </section>

            {/* 今日待办 + 今日工作记录 并排 */}
            <div className="two-col">
              <section className="grid overview-grid">
                <article className="panel section-card">
                  <div className="section-head section-head-tight">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h2>今日待办</h2>
                      <HelpIcon tips={[
                        "显示今日需要跟进的待办任务，按优先级排列。",
                        "使用顶部\"📝 快速记录工作\"按钮记录工作。",
                        "使用顶部\"+ 添加任务\"按钮创建待办。",
                        "点击时间轴上的卡片可直接编辑或删除。",
                      ]} />
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
                      <h2>今日工作记录</h2>
                      <HelpIcon tips={[
                        "以时间线形式展示今日新增的工作记录。",
                        "使用顶部\"📝 快速记录工作\"按钮添加记录。",
                        "每条记录包含标题、详情、标签和关联待办。",
                        "点击时间轴上的记录卡片可编辑或删除。",
                      ]} />
                    </div>
                  </div>
                  <DiaryTimeline events={todayRecords} />
                </article>
              </section>
            </div>

            {/* 数据统计（不太重要，置于今日待办/工作记录下方） */}
            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>数据统计</h2>
                    <HelpIcon tips={[
                      "展示工作记录量、待办状态分布和标签使用情况。",
                      "标签分布取出现次数最多的前 8 个。",
                    ]} />
                  </div>
                </div>
                <StatsDashboard events={events} todos={todos} />
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>待办任务</h2>
                    <span className="todo-count-badge">未完成 {activeTodos.length} 项</span>
                    <HelpIcon tips={[
                      "使用顶部下拉菜单按\"部门\"和\"联系人\"筛选待办。",
                      "列表只显示未完成的待办，右上角数字即剩余待办数。",
                      "已完成/已取消的任务自动进入下方\"已归档\"区。",
                      "点击任意待办卡片可编辑内容或删除。",
                      "勾选多个待办后可批量修改状态或删除。",
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

                {selectedTodoIds.size > 0 && (
                  <div className="batch-bar">
                    <span>已选 {selectedTodoIds.size} 项</span>
                    <button className="chip-button" type="button" onClick={() => batchSetStatus("in_progress")}>
                      标记进行中
                    </button>
                    <button className="chip-button" type="button" onClick={() => batchSetStatus("completed")}>
                      标记完成
                    </button>
                    <button className="chip-button batch-danger" type="button" onClick={batchDeleteTodos}>
                      批量删除
                    </button>
                    <button className="chip-button" type="button" onClick={() => setSelectedTodoIds(new Set())}>
                      取消选择
                    </button>
                  </div>
                )}

                {activeTodos.length === 0 ? (
                  <p className="empty-note" style={{ padding: "16px 0" }}>
                    没有未完成的待办 🎉
                  </p>
                ) : (
                  <TodoTree nodes={todoTree} linkedEventTitles={linkedEventTitles} maxDisplay={showAllTodos ? undefined : 3} onTodoClick={setEditingTodo} selectedIds={selectedTodoIds} onToggleSelect={toggleSelectTodo} />
                )}
                {activeTodos.length > 3 && (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setShowAllTodos(!showAllTodos)}
                    style={{ marginTop: '12px', width: '100%' }}
                  >
                    {showAllTodos ? "收起" : `展开全部 (${activeTodos.length} 个未完成)`}
                  </button>
                )}
              </article>
            </section>

            {/* 已归档：已完成/已取消的待办，可查看与一键恢复 */}
            <ArchivedTodosPanel
              nodes={archivedTodoTree}
              onRestore={handleRestoreTodo}
              onTodoClick={setEditingTodo}
            />

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>搜索结果</h2>
                    <HelpIcon tips={[
                      "输入关键词后自动搜索匹配的待办和工作记录。",
                      "搜索范围包括标题、内容和标签，支持拼音。",
                      "结果按类型（待办 / 事件）分组显示。",
                      "清空搜索框可恢复默认列表。",
                    ]} />
                  </div>
                </div>
                <SearchPanel results={searchResults} query={searchQuery} onQueryChange={setSearchQuery} inputRef={searchInputRef} />
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
          customTags={customTags}
          memos={memos}
          onDataLoaded={(loadedEvents, loadedTodos, loadedTags, loadedMemos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            setCustomTags(loadedTags);
            setMemos(loadedMemos);
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
          memos={memos}
          onImport={(loadedEvents, loadedTodos, loadedTags, loadedMemos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            // 标签随导入覆盖（旧备份无标签字段时 importDataFromFile 已回退为保留本地标签）
            setCustomTags(loadedTags);
            setMemos(loadedMemos);
          }}
          onClose={() => setShowExportPanel(false)}
        />
      )}

      <BackupReminder onOpenExport={() => setShowExportPanel(true)} />
    </main>
  );
}
