"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadAndMigrateFromStorage,
  saveEventsToStorage,
  saveTodosToStorage,
  pushToCloud,
  pullAndMerge,
  loadSettings,
  loadCustomTags,
  addCustomTag as addTag,
  saveCustomTags,
} from "@/lib/storage";
import { syncLinkedItems } from "@/lib/utils";

type SyncedData = ReturnType<typeof syncLinkedItems>;

export type AppData = SyncedData & {
  customTags: string[];
  isInitialized: boolean;
  cloudEnabled: boolean;
  addCustomTag: (tag: string) => void;
  deleteCustomTag: (tag: string) => void;
  setData: (data: SyncedData) => void;
  refreshCloudStatus: () => void;
};

/**
 * 封装页面共享的数据加载、持久化、云同步逻辑。
 * page.tsx 和 calendar/page.tsx 共用此 hook，避免重复代码。
 */
export function useAppData(): AppData {
  const [isInitialized, setIsInitialized] = useState(false);
  const [{ events, todos }, setData] = useState(() => {
    const stored = loadAndMigrateFromStorage();
    if (stored.events.length > 0 || stored.todos.length > 0) {
      return syncLinkedItems(stored.events, stored.todos);
    }
    return { events: [], todos: [] };
  });

  const [customTags, setCustomTags] = useState<string[]>(() => loadCustomTags());
  const [cloudEnabled, setCloudEnabled] = useState(() => loadSettings() !== null);

  // 标记初始化完成（延迟到 Effect 确保 SSR/hydrate 安全）
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // 数据变更 → 自动存 LocalStorage
  useEffect(() => {
    if (isInitialized) {
      saveEventsToStorage(events);
      saveTodosToStorage(todos);
    }
  }, [events, todos, isInitialized]);

  // 标签变更 → 自动存 LocalStorage
  useEffect(() => {
    if (isInitialized) {
      saveCustomTags(customTags);
    }
  }, [customTags, isInitialized]);

  // 初始化时自动从云端拉取并合并
  useEffect(() => {
    if (!isInitialized) return;

    const settings = loadSettings();
    if (!settings) return;

    pullAndMerge(events, todos, customTags).then((result) => {
      if (!result) return;
      if (result.customTags.length > customTags.length) {
        setCustomTags(result.customTags);
      }
      if (result.mergedFromRemote) {
        const synced = syncLinkedItems(result.events, result.todos);
        setData(synced);
        saveEventsToStorage(synced.events);
        saveTodosToStorage(synced.todos);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  // 云同步自动推送（3 秒防抖）
  useEffect(() => {
    if (!isInitialized) return;

    const settings = loadSettings();
    if (!settings) return;

    const timer = setTimeout(async () => {
      const result = await pushToCloud(events, todos, customTags);
      if (result.customTags.length > customTags.length) {
        setCustomTags(result.customTags);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [events, todos, customTags, isInitialized]);

  const addCustomTag = useCallback(
    (tag: string) => setCustomTags(addTag(tag)),
    [],
  );

  const deleteCustomTag = useCallback(
    (tag: string) => setCustomTags((prev) => prev.filter((t) => t !== tag)),
    [],
  );

  const refreshCloudStatus = useCallback(() => {
    setCloudEnabled(loadSettings() !== null);
  }, []);

  return {
    events,
    todos,
    customTags,
    isInitialized,
    cloudEnabled,
    addCustomTag,
    deleteCustomTag,
    setData,
    refreshCloudStatus,
  };
}
