import { EventItem, TodoItem } from "@/types";

const STORAGE_KEY_EVENTS = "little-job-helper-events";
const STORAGE_KEY_TODOS = "little-job-helper-todos";

/**
 * 从 LocalStorage 读取事件数据
 */
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

/**
 * 从 LocalStorage 读取待办数据
 */
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
 * 保存事件数据到 LocalStorage
 */
export function saveEventsToStorage(events: EventItem[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  } catch (error) {
    console.error("Failed to save events to storage:", error);
  }
}

/**
 * 保存待办数据到 LocalStorage
 */
export function saveTodosToStorage(todos: TodoItem[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
  } catch (error) {
    console.error("Failed to save todos to storage:", error);
  }
}

/**
 * 清除所有存储数据
 */
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
