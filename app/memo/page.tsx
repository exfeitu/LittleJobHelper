"use client";

import { useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { HelpIcon } from "@/components/help-icon";
import { MemoList } from "@/components/memo-list";
import { MemoFormPanel } from "@/components/memo-form-panel";
import { MemoDetailPanel } from "@/components/memo-detail-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { ExportPanel } from "@/components/export-panel";
import { BackupReminder } from "@/components/backup-reminder";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAppData } from "@/hooks/use-app-data";
import { syncLinkedItems } from "@/lib/utils";
import { memoSearchText, sortMemos } from "@/lib/memo";
import { toPinyin, toPinyinInitials } from "@/lib/utils";
import { MemoItem, MemoType } from "@/types";

type MemoSearchItem = MemoItem & { pinyin: string; initials: string };

export default function MemoPage() {
  const {
    events, todos, memos, setMemos, setData, canUndoMemos, undoMemos,
    customTags, setCustomTags, addCustomTag, deleteCustomTag,
    isInitialized, cloudEnabled, isOnline, syncStatus, syncError, refreshCloudStatus,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<MemoType>("note");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("全部标签");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<MemoType>("note");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [viewingId, setViewingId] = useState<string | undefined>(undefined);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(["全部标签", ...customTags])),
    [customTags],
  );

  // 预计算拼音字段，避免每次按键重复转换
  const searchable = useMemo<MemoSearchItem[]>(
    () =>
      memos.map((m) => {
        const text = memoSearchText(m);
        return { ...m, pinyin: toPinyin(text), initials: toPinyinInitials(text) };
      }),
    [memos],
  );

  const filteredMemos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortMemos(
      searchable.filter((m) => {
        if (m.type !== activeTab) return false;
        if (tagFilter !== "全部标签" && !m.tags.includes(tagFilter)) return false;
        if (!normalized) return true;
        const haystack = `${m.title} ${memoSearchText(m).toLowerCase()}`;
        return (
          haystack.includes(normalized) ||
          m.pinyin.includes(normalized) ||
          m.initials.includes(normalized)
        );
      }),
    );
  }, [searchable, activeTab, tagFilter, query]);

  const viewingMemo = viewingId ? memos.find((m) => m.id === viewingId) : undefined;
  const editingMemo = editingId ? memos.find((m) => m.id === editingId) : undefined;

  const saveMemo = (memo: MemoItem) => {
    const isUpdate = memos.some((m) => m.id === memo.id);
    const next = isUpdate
      ? memos.map((m) => (m.id === memo.id ? memo : m))
      : [...memos, memo];
    setMemos(next);
    setShowForm(false);
    setEditingId(undefined);
    if (viewingId === memo.id) setViewingId(undefined);
  };

  // 删除确认在弹窗组件内完成（与 WorkRecordPanel 一致），这里直接执行删除
  const deleteMemo = (id: string) => {
    setMemos(memos.filter((m) => m.id !== id));
    setViewingId(undefined);
    setEditingId(undefined);
  };

  const toggleStep = (memoId: string, stepId: string) => {
    setMemos(
      memos.map((m) =>
        m.id === memoId
          ? {
              ...m,
              updatedAt: new Date().toISOString(),
              steps: (m.steps ?? []).map((s) =>
                s.id === stepId ? { ...s, completed: !s.completed } : s,
              ),
            }
          : m,
      ),
    );
  };

  const openNewForm = (type: MemoType) => {
    setFormType(type);
    setEditingId(undefined);
    setShowForm(true);
  };

  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onNewTask: () => openNewForm("checklist"),
    onNewRecord: () => openNewForm("note"),
    onUndo: () => {
      // contentEditable 内 Ctrl+Z 交给原生撤销，避免劫持
      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) return;
      undoMemos();
    },
    onEscape: () => {
      setShowForm(false);
      setEditingId(undefined);
      setViewingId(undefined);
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
          activePage="memo"
          hideQuickActions
          tips={[
            "备忘录用于沉淀长期经验与周期性工作流程。",
            "复盘心得：图文混排的长期学习笔记，支持标签与全文搜索。",
            "周期备忘：步骤化 checklist，每步可勾选、可标记易错点。",
            "快捷键：Ctrl+K 搜索 · Ctrl+N 新建备忘 · Ctrl+Shift+N 新建心得 · Ctrl+Z 撤销。",
          ]}
          cloudEnabled={cloudEnabled}
          isOnline={isOnline}
          syncStatus={syncStatus}
          syncError={syncError}
          onQuickRecord={() => openNewForm("note")}
          onAddTask={() => openNewForm("checklist")}
          onOpenSync={() => setShowSettingsPanel(true)}
          onOpenExport={() => setShowExportPanel(true)}
        />

        <div className="memo-toolbar">
          <div className="memo-tabs" role="tablist" aria-label="备忘录类型">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "note"}
              className={`memo-tab ${activeTab === "note" ? "memo-tab-active" : ""}`}
              onClick={() => setActiveTab("note")}
            >
              📓 复盘心得
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "checklist"}
              className={`memo-tab ${activeTab === "checklist" ? "memo-tab-active" : ""}`}
              onClick={() => setActiveTab("checklist")}
            >
              ✅ 周期备忘
            </button>
          </div>

          <div className="memo-search-box">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、正文、步骤、标签（支持拼音）"
              aria-label="搜索备忘录"
            />
          </div>

          <div className="memo-tag-filter">
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <button className="ghost-button memo-add-button" type="button" onClick={() => openNewForm(activeTab)}>
            + 新建{activeTab === "note" ? "心得" : "备忘"}
          </button>
        </div>

        <div className="memo-content">
          <div className="memo-list-head">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h2>{activeTab === "note" ? "复盘心得" : "周期备忘"}</h2>
              <HelpIcon tips={
                activeTab === "note"
                  ? [
                      "记录长期学习笔记与踩坑经验。",
                      "支持富文本加粗、列表与贴图。",
                      "标签与工作记录共用一套。",
                    ]
                  : [
                      "为不定期但流程固定的工作建立检查清单。",
                      "每步可勾选确认，下次照做不漏关键环节。",
                      "标记为易错点的步骤会以红色高亮提示。",
                    ]
              } />
            </div>
            {filteredMemos.length > 0 && (
              <span className="memo-count">{filteredMemos.length} 条</span>
            )}
          </div>

          <MemoList
            memos={filteredMemos}
            onOpen={(id) => setViewingId(id)}
            onEdit={(id) => {
              setEditingId(id);
              setShowForm(true);
            }}
          />
        </div>
      </section>

      {showForm && (
        <MemoFormPanel
          type={formType}
          editMemo={editingMemo}
          customTags={customTags}
          onTagCreated={addCustomTag}
          onTagDeleted={deleteCustomTag}
          onSave={saveMemo}
          onDelete={editingMemo ? (id) => deleteMemo(id) : undefined}
          onClose={() => {
            setShowForm(false);
            setEditingId(undefined);
          }}
        />
      )}

      {viewingMemo && (
        <MemoDetailPanel
          memo={viewingMemo}
          onToggleStep={(stepId) => toggleStep(viewingMemo.id, stepId)}
          onEdit={(id) => {
            setViewingId(undefined);
            setEditingId(id);
            setShowForm(true);
          }}
          onDelete={(id) => deleteMemo(id)}
          onClose={() => setViewingId(undefined)}
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
          memos={memos}
          customTags={customTags}
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
