import { EventItem, TodoItem } from "@/types";

const STORAGE_KEY_EVENTS = "little-job-helper-events";
const STORAGE_KEY_TODOS = "little-job-helper-todos";
const STORAGE_KEY_SETTINGS = "little-job-helper-settings";

const GIST_FILENAME = "little-job-helper-data.json";
const GIST_DESCRIPTION = "Little Job Helper 工作数据";
const GIST_API_BASE = "https://api.github.com";

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
    // 获取当前用户的所有 gist（最多 100 个，对个人使用足够）
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
): Promise<string | null> {
  try {
    const content = JSON.stringify(
      {
        version: "1.0.0",
        updatedAt: new Date().toISOString(),
        events,
        todos,
      },
      null,
      2,
    );

    const res = await fetch(`${GIST_API_BASE}/gists`, {
      method: "POST",
      headers: gistHeaders(token),
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        public: false, // 私有 Gist
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
): Promise<void> {
  const content = JSON.stringify(
    {
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      events,
      todos,
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
 * 从 Gist 拉取数据
 */
async function fetchGist(
  token: string,
  gistId: string,
): Promise<{ events: EventItem[]; todos: TodoItem[] } | null> {
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
      events: parsed.events as EventItem[],
      todos: parsed.todos as TodoItem[],
    };
  } catch {
    return null;
  }
}

// ============================================================
// 对外云同步接口
// ============================================================

/**
 * 初始化云同步：验证 Token 并找到/创建 Gist
 * 返回 true 表示配置成功，否则抛出错误
 */
export async function initCloudSync(token: string): Promise<GistSettings> {
  // 1. 验证 token 有效性
  const userRes = await fetch(`${GIST_API_BASE}/user`, {
    headers: gistHeaders(token),
  });

  if (!userRes.ok) {
    if (userRes.status === 401) {
      throw new Error("Token 无效，请检查 GitHub Personal Access Token");
    }
    throw new Error(`GitHub API 连接失败 (${userRes.status})`);
  }

  // 2. 查找已有 Gist
  let gistId = await findExistingGist(token);

  if (!gistId) {
    // 3. 没有则创建新 Gist（使用当前本地数据初始化）
    const storedEvents = loadEventsFromStorage();
    const storedTodos = loadTodosFromStorage();
    gistId = await createGist(token, storedEvents ?? [], storedTodos ?? []);
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
 * 推送数据到云端
 */
export async function pushToCloud(
  events: EventItem[],
  todos: TodoItem[],
): Promise<void> {
  const settings = loadSettings();
  if (!settings) return; // 未配置云同步，静默跳过

  setSyncStatus("syncing");

  try {
    await updateGist(settings.token, settings.gistId, events, todos);
    setSyncStatus("success");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "云端同步失败";
    setSyncStatus("error", message);
    console.error("Cloud sync failed:", error);
  }
}

/**
 * 从云端拉取数据
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
    const data = await fetchGist(settings.token, settings.gistId);
    if (!data) {
      setSyncStatus("error", "未找到云端数据");
      return null;
    }
    setSyncStatus("success");
    return data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "从云端加载失败";
    setSyncStatus("error", message);
    throw error;
  }
}

// ============================================================
// LocalStorage 读写（保留原有函数）
// ============================================================

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

export function saveEventsToStorage(events: EventItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  } catch (error) {
    console.error("Failed to save events to storage:", error);
  }
}

export function saveTodosToStorage(todos: TodoItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
  } catch (error) {
    console.error("Failed to save todos to storage:", error);
  }
}

export function clearAllStorage(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY_EVENTS);
  localStorage.removeItem(STORAGE_KEY_TODOS);
}

/**
 * 导出数据为 JSON 文件（触发浏览器下载）
 */
export function exportDataAsFile(events: EventItem[], todos: TodoItem[]): void {
  const data = {
    version: "1.0.0",
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
 * 从 JSON 文件导入数据
 */
export function importDataFromFile(file: File): Promise<{ events: EventItem[]; todos: TodoItem[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        // 验证数据结构
        if (!data.events || !data.todos) {
          throw new Error("Invalid data format: missing events or todos");
        }
        
        resolve({
          events: data.events as EventItem[],
          todos: data.todos as TodoItem[],
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
