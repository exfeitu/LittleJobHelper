import { EventItem, TodoItem } from "@/types";

const STORAGE_KEY_EVENTS = "little-job-helper-events";
const STORAGE_KEY_TODOS = "little-job-helper-todos";
const STORAGE_KEY_VERSION = "little-job-helper-version";
const STORAGE_KEY_SETTINGS = "little-job-helper-settings";
const STORAGE_KEY_CUSTOM_TAGS = "little-job-helper-custom-tags";

const GIST_FILENAME = "little-job-helper-data.json";
const GIST_DESCRIPTION = "Little Job Helper 工作数据";
const GIST_API_BASE = "https://api.github.com";

// ============================================================
// 数据版本与迁移系统
// ============================================================

/**
 * 当前数据版本（整数）。
 * 每当你修改 types.ts 中 EventItem / TodoItem 的字段（新增、重命名、改类型），
 * 请将 CURRENT_DATA_VERSION 加 1，并在下方的 migrations 数组中追加一个迁移函数。
 *
 * 版本历史：
 *   0 — 无版本号的 legacy 数据（2026-05 之前）
 *   1 — 当前版本（含所有 EventItem / TodoItem 字段 + 云同步支持）
 */
const CURRENT_DATA_VERSION = 2;

type DataBundle = { events: EventItem[]; todos: TodoItem[]; customTags?: string[] };

/**
 * 迁移函数数组：migrations[i] 负责从版本 i 迁移到 i+1。
 * 例如 migrations[0] 把版本 0 的数据升级到版本 1。
 *
 * 未来加字段示例：
 *   migrations.push((data) => ({
 *     events: data.events.map(e => ({ category: "其他", ...e })),
 *     todos: data.todos.map(t => ({ urgency: "normal", ...t })),
 *   }));
 */
const migrations: Array<(data: DataBundle) => DataBundle> = [
  // v0 → v1：无需结构变更，只是给 legacy 数据打上版本标记
  (data) => data,
  // v1 → v2：为所有条目添加 updatedAt 字段（用于多端同步冲突检测）
  (data) => {
    const now = new Date().toISOString();
    return {
      events: data.events.map((e) => ({
        ...e,
        updatedAt: (e as Record<string, unknown>).updatedAt as string || now,
      })),
      todos: data.todos.map((t) => ({
        ...t,
        updatedAt: (t as Record<string, unknown>).updatedAt as string || now,
      })),
    };
  },
];

/**
 * 将任意版本的数据升级到 CURRENT_DATA_VERSION。
 * 纯函数，不会修改入参。
 */
export function migrateData(
  data: DataBundle,
  fromVersion: number,
): DataBundle {
  let current = data;
  for (let v = fromVersion; v < CURRENT_DATA_VERSION; v++) {
    const migrate = migrations[v];
    if (migrate) {
      current = migrate(current);
    }
  }
  return current;
}

/**
 * 解析版本号：兼容旧的 semver 字符串（如 "1.0.0"）和整数。
 */
function parseVersion(version: unknown): number {
  if (typeof version === "number" && Number.isInteger(version) && version >= 0) {
    return version;
  }
  if (typeof version === "string") {
    // "1.0.0" → 1
    const major = parseInt(version.split(".")[0], 10);
    if (!Number.isNaN(major) && major >= 0) return major;
  }
  return 0; // 无版本号 → legacy
}

// ============================================================
// 云同步配置类型
// ============================================================

export type GistSettings = {
  token: string;
  gistId: string;
};

type SyncStatus = "idle" | "syncing" | "success" | "error";

let _syncStatus: SyncStatus = "idle";
let _syncError: string | null = null;
let _lastSyncAt: string | null = null;
let _syncListeners: Array<() => void> = [];

export function getSyncStatus(): SyncStatus {
  return _syncStatus;
}

export function getSyncError(): string | null {
  return _syncError;
}

export function getLastSyncAt(): string | null {
  return _lastSyncAt;
}

export function onSyncChange(listener: () => void): () => void {
  _syncListeners.push(listener);
  return () => {
    _syncListeners = _syncListeners.filter((l) => l !== listener);
  };
}

function notifySyncListeners(): void {
  _syncListeners.forEach((l) => l());
}

function setSyncStatus(status: SyncStatus, error?: string | null): void {
  _syncStatus = status;
  _syncError = error ?? null;
  if (status === "success") {
    _lastSyncAt = new Date().toISOString();
  }
  notifySyncListeners();
}

// ============================================================
// 设置管理（Token + Gist ID 存在 LocalStorage）
// ============================================================

export function loadSettings(): GistSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.token && parsed.gistId) {
      return parsed as GistSettings;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: GistSettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY_SETTINGS);
  _lastSyncAt = null;
  setSyncStatus("idle");
}

// ============================================================
// GitHub Gist API
// ============================================================

function gistHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * 查找当前用户下已有的 LittleJobHelper Gist
 */
async function findExistingGist(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${GIST_API_BASE}/gists?per_page=100`, {
      headers: gistHeaders(token),
    });

    if (!res.ok) return null;

    const gists: Array<{
      id: string;
      files: Record<string, { filename: string }>;
    }> = await res.json();

    const found = gists.find((g) => g.files && g.files[GIST_FILENAME]);
    return found ? found.id : null;
  } catch {
    return null;
  }
}

/**
 * 创建新的 Gist 并返回 gistId
 */
async function createGist(
  token: string,
  events: EventItem[],
  todos: TodoItem[],
  customTags: string[],
): Promise<string | null> {
  try {
    const content = JSON.stringify(
      {
        version: CURRENT_DATA_VERSION,
        updatedAt: new Date().toISOString(),
        events,
        todos,
        customTags,
      },
      null,
      2,
    );

    const res = await fetch(`${GIST_API_BASE}/gists`, {
      method: "POST",
      headers: gistHeaders(token),
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        public: false,
        files: {
          [GIST_FILENAME]: {
            content,
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message ?? `创建 Gist 失败 (${res.status})`,
      );
    }

    const data: { id: string } = await res.json();
    return data.id;
  } catch (error) {
    console.error("Failed to create gist:", error);
    throw error;
  }
}

/**
 * 更新已有 Gist 的内容
 */
async function updateGist(
  token: string,
  gistId: string,
  events: EventItem[],
  todos: TodoItem[],
  customTags: string[],
): Promise<void> {
  const content = JSON.stringify(
    {
      version: CURRENT_DATA_VERSION,
      updatedAt: new Date().toISOString(),
      events,
      todos,
      customTags,
    },
    null,
    2,
  );

  const res = await fetch(`${GIST_API_BASE}/gists/${gistId}`, {
    method: "PATCH",
    headers: gistHeaders(token),
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `更新 Gist 失败 (${res.status})`,
    );
  }
}

/**
 * 从 Gist 拉取原始数据（含版本号，不做迁移）
 */
async function fetchRawGist(
  token: string,
  gistId: string,
): Promise<{ events: EventItem[]; todos: TodoItem[]; customTags: string[]; version: number } | null> {
  try {
    const res = await fetch(`${GIST_API_BASE}/gists/${gistId}`, {
      headers: gistHeaders(token),
    });

    if (!res.ok) return null;

    const data: {
      files: Record<string, { content?: string }>;
    } = await res.json();

    const file = data.files?.[GIST_FILENAME];
    if (!file?.content) return null;

    const parsed = JSON.parse(file.content);
    if (!parsed.events || !parsed.todos) return null;

    return {
      version: parseVersion(parsed.version),
      events: parsed.events as EventItem[],
      todos: parsed.todos as TodoItem[],
      customTags: (parsed.customTags as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

// ============================================================
// 多端同步：ID 级别合并（updatedAt 最新的胜出）
// ============================================================

type HasUpdatedAt = { id: string; updatedAt: string };

/**
 * 合并本地和远端数据：ID 相同按 updatedAt 取最新，无冲突时自动合并。
 * 返回合并后的数组和可能的冲突提示。
 */
function mergeItems<T extends HasUpdatedAt>(
  local: T[],
  remote: T[],
): { merged: T[]; fromRemote: string[] } {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const merged: T[] = [];
  const fromRemote: string[] = [];

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    if (localItem && !remoteItem) {
      merged.push(localItem);
    } else if (!localItem && remoteItem) {
      merged.push(remoteItem);
      fromRemote.push(id);
    } else if (localItem && remoteItem) {
      // 两边都有 — updatedAt 较新的胜出
      if (remoteItem.updatedAt > localItem.updatedAt) {
        merged.push(remoteItem);
        fromRemote.push(id);
      } else {
        merged.push(localItem);
      }
    }
  }

  return { merged, fromRemote };
}

// ============================================================
// 对外云同步接口
// ============================================================

/**
 * 初始化云同步：验证 Token 并找到/创建 Gist
 */
export async function initCloudSync(token: string): Promise<GistSettings> {
  const userRes = await fetch(`${GIST_API_BASE}/user`, {
    headers: gistHeaders(token),
  });

  if (!userRes.ok) {
    if (userRes.status === 401) {
      throw new Error("Token 无效，请检查 GitHub Personal Access Token");
    }
    throw new Error(`GitHub API 连接失败 (${userRes.status})`);
  }

  let gistId = await findExistingGist(token);

  if (!gistId) {
    const storedEvents = loadEventsFromStorage();
    const storedTodos = loadTodosFromStorage();
    gistId = await createGist(token, storedEvents ?? [], storedTodos ?? [], loadCustomTags());
    if (!gistId) {
      throw new Error("创建云端 Gist 失败，请重试");
    }
  }

  const settings: GistSettings = { token, gistId };
  saveSettings(settings);
  setSyncStatus("success");
  return settings;
}

/**
 * 推送数据到云端（先拉取合并，再推送，防止覆盖他人更新）
 */
export async function pushToCloud(
  events: EventItem[],
  todos: TodoItem[],
  customTags?: string[],
): Promise<{ mergedFromRemote: boolean; customTags: string[] }> {
  const tags = customTags ?? loadCustomTags();
  const settings = loadSettings();
  if (!settings) return { mergedFromRemote: false, customTags: tags };

  setSyncStatus("syncing");

  try {
    // 1. 先拉取远端数据
    const remote = await fetchRawGist(settings.token, settings.gistId);

    let finalEvents = events;
    let finalTodos = todos;
    let finalTags = tags;
    let mergedFromRemote = false;

    if (remote) {
      // 2. ID 级别合并：updatedAt 最新胜出
      const eventsResult = mergeItems(events, remote.events);
      const todosResult = mergeItems(todos, remote.todos);
      finalEvents = eventsResult.merged;
      finalTodos = todosResult.merged;
      // 标签合并：取并集（云端独有的也保留）
      finalTags = Array.from(new Set([...tags, ...(remote.customTags ?? [])]));
      mergedFromRemote =
        eventsResult.fromRemote.length > 0 || todosResult.fromRemote.length > 0;
    }

    // 3. 推送合并后的数据
    await updateGist(settings.token, settings.gistId, finalEvents, finalTodos, finalTags);
    setSyncStatus("success");
    return { mergedFromRemote, customTags: finalTags };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "云端同步失败";
    setSyncStatus("error", message);
    console.error("Cloud sync failed:", error);
    return { mergedFromRemote: false, customTags: tags };
  }
}

/**
 * 从云端拉取并与本地数据合并（用于 app 初始化时自动同步）。
 * 合并规则：ID 相同按 updatedAt 最新胜出，本地独有保留，远端独有采纳。
 */
export async function pullAndMerge(
  localEvents: EventItem[],
  localTodos: TodoItem[],
  localTags: string[],
): Promise<{
  events: EventItem[];
  todos: TodoItem[];
  customTags: string[];
  mergedFromRemote: boolean;
} | null> {
  const settings = loadSettings();
  if (!settings) return null;

  setSyncStatus("syncing");

  try {
    const remote = await fetchRawGist(settings.token, settings.gistId);
    if (!remote) {
      setSyncStatus("success");
      return { events: localEvents, todos: localTodos, customTags: localTags, mergedFromRemote: false };
    }

    // 迁移远端旧版本数据
    let remoteEvents = remote.events;
    let remoteTodos = remote.todos;
    let remoteTags = remote.customTags ?? [];
    if (remote.version < CURRENT_DATA_VERSION) {
      const migrated = migrateData(
        { events: remoteEvents, todos: remoteTodos },
        remote.version,
      );
      remoteEvents = migrated.events;
      remoteTodos = migrated.todos;
    }

    const eventsResult = mergeItems(localEvents, remoteEvents);
    const todosResult = mergeItems(localTodos, remoteTodos);
    const mergedTags = Array.from(new Set([...localTags, ...remoteTags]));

    setSyncStatus("success");
    return {
      events: eventsResult.merged,
      todos: todosResult.merged,
      customTags: mergedTags,
      mergedFromRemote:
        eventsResult.fromRemote.length > 0 || todosResult.fromRemote.length > 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "自动同步失败";
    setSyncStatus("error", message);
    console.error("Auto pull-merge failed:", error);
    return null;
  }
}

/**
 * 从云端拉取数据（自动迁移到当前版本）
 */
export async function pullFromCloud(): Promise<{
  events: EventItem[];
  todos: TodoItem[];
} | null> {
  const settings = loadSettings();
  if (!settings) {
    throw new Error("未配置云同步，请先在设置中输入 GitHub Token");
  }

  setSyncStatus("syncing");

  try {
    const raw = await fetchRawGist(settings.token, settings.gistId);
    if (!raw) {
      setSyncStatus("error", "未找到云端数据");
      return null;
    }

    if (raw.version < CURRENT_DATA_VERSION) {
      const migrated = migrateData(
        { events: raw.events, todos: raw.todos },
        raw.version,
      );
      setSyncStatus("success");
      return migrated;
    }

    setSyncStatus("success");
    return { events: raw.events, todos: raw.todos };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "从云端加载失败";
    setSyncStatus("error", message);
    throw error;
  }
}

// ============================================================
// LocalStorage 读写（含版本号管理）
// ============================================================

/**
 * 读取 LocalStorage 中的数据版本号，无记录时返回 0（legacy）。
 */
function getStoredVersion(): number {
  if (typeof window === "undefined") return CURRENT_DATA_VERSION;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERSION);
    if (raw === null) {
      // 有数据但无版本号 → legacy 数据
      const hasData =
        localStorage.getItem(STORAGE_KEY_EVENTS) !== null ||
        localStorage.getItem(STORAGE_KEY_TODOS) !== null;
      return hasData ? 0 : CURRENT_DATA_VERSION;
    }
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

function setStoredVersion(version: number): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_VERSION, String(version));
  } catch (error) {
    console.error("Failed to save version:", error);
  }
}

export function loadEventsFromStorage(): EventItem[] | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STORAGE_KEY_EVENTS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load events from storage:", error);
    return null;
  }
}

export function loadTodosFromStorage(): TodoItem[] | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STORAGE_KEY_TODOS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load todos from storage:", error);
    return null;
  }
}

/**
 * 从 LocalStorage 加载数据，如果数据版本过旧则自动迁移。
 * 迁移后的数据会立即写回 LocalStorage。
 */
export function loadAndMigrateFromStorage(): {
  events: EventItem[];
  todos: TodoItem[];
  migrated: boolean;
} {
  const events = loadEventsFromStorage();
  const todos = loadTodosFromStorage();
  const storedVersion = getStoredVersion();

  if (!events || !todos) {
    return { events: events ?? [], todos: todos ?? [], migrated: false };
  }

  if (storedVersion < CURRENT_DATA_VERSION) {
    const migrated = migrateData({ events, todos }, storedVersion);
    // 写回迁移后的数据
    saveEventsToStorage(migrated.events);
    saveTodosToStorage(migrated.todos);
    setStoredVersion(CURRENT_DATA_VERSION);
    return { ...migrated, migrated: true };
  }

  return { events, todos, migrated: false };
}

export function saveEventsToStorage(events: EventItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    setStoredVersion(CURRENT_DATA_VERSION);
  } catch (error) {
    console.error("Failed to save events to storage:", error);
  }
}

export function saveTodosToStorage(todos: TodoItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
    setStoredVersion(CURRENT_DATA_VERSION);
  } catch (error) {
    console.error("Failed to save todos to storage:", error);
  }
}

/**
 * 读取用户自定义标签列表
 */
export function loadCustomTags(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY_CUSTOM_TAGS);
    return data ? (JSON.parse(data) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * 保存用户自定义标签列表（去重）
 */
export function saveCustomTags(tags: string[]): void {
  if (typeof window === "undefined") return;

  try {
    const unique = Array.from(new Set(tags.filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_CUSTOM_TAGS, JSON.stringify(unique));
  } catch (error) {
    console.error("Failed to save custom tags:", error);
  }
}

/**
 * 追加一个新的自定义标签
 */
export function addCustomTag(tag: string): string[] {
  const current = loadCustomTags();
  if (!tag.trim() || current.includes(tag.trim())) return current;
  const next = [...current, tag.trim()];
  saveCustomTags(next);
  return next;
}

/**
 * 删除一个自定义标签
 */
export function removeCustomTag(tag: string): string[] {
  const current = loadCustomTags();
  const next = current.filter((t) => t !== tag);
  saveCustomTags(next);
  return next;
}

/**
 * 批量设置自定义标签（替换全部）
 */
export function setCustomTags(tags: string[]): string[] {
  const unique = Array.from(new Set(tags.filter(Boolean)));
  saveCustomTags(unique);
  return unique;
}

export function clearAllStorage(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY_EVENTS);
  localStorage.removeItem(STORAGE_KEY_TODOS);
  localStorage.removeItem(STORAGE_KEY_VERSION);
  localStorage.removeItem(STORAGE_KEY_CUSTOM_TAGS);
}

// ============================================================
// JSON 文件导入/导出（含版本号 + 迁移）
// ============================================================

/**
 * 导出数据为 JSON 文件（触发浏览器下载）
 */
export function exportDataAsFile(events: EventItem[], todos: TodoItem[]): void {
  const data = {
    version: CURRENT_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    events,
    todos,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `little-job-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入数据（自动迁移旧版本）
 */
export function importDataFromFile(file: File): Promise<{
  events: EventItem[];
  todos: TodoItem[];
  migrated: boolean;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (!data.events || !data.todos) {
          throw new Error("数据格式无效：缺少 events 或 todos 字段");
        }

        const fileVersion = parseVersion(data.version);

        if (fileVersion < CURRENT_DATA_VERSION) {
          const migrated = migrateData(
            { events: data.events as EventItem[], todos: data.todos as TodoItem[] },
            fileVersion,
          );
          resolve({ ...migrated, migrated: true });
        } else {
          resolve({
            events: data.events as EventItem[],
            todos: data.todos as TodoItem[],
            migrated: false,
          });
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });
}
