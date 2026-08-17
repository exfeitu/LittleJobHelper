import { EventItem, MemoItem, Priority, TodoItem, TodoStatus, TodoTreeNode } from "@/types";
import { pinyin } from "pinyin-pro";

/**
 * 生成唯一 ID。优先使用 crypto.randomUUID()（本地 HTTPS / localhost 环境可用），
 * 旧浏览器回退到时间戳 + 随机串，避免同一毫秒内 ID 冲突。
 */
export function genId(prefix = ""): string {
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${uid}` : uid;
}

export function syncLinkedItems(events: EventItem[], todos: TodoItem[]) {
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const todoMap = new Map(todos.map((todo) => [todo.id, todo]));

  const eventLinksFromTodos = new Map<string, string[]>();
  todos.forEach((todo) => {
    todo.linkedEventIds?.forEach((eventId) => {
      if (!eventMap.has(eventId)) return;
      eventLinksFromTodos.set(eventId, [...(eventLinksFromTodos.get(eventId) ?? []), todo.id]);
    });
  });

  const todoLinksFromEvents = new Map<string, string[]>();
  events.forEach((event) => {
    event.linkedTodoIds?.forEach((todoId) => {
      if (!todoMap.has(todoId)) return;
      todoLinksFromEvents.set(todoId, [...(todoLinksFromEvents.get(todoId) ?? []), event.id]);
    });
  });

  return {
    events: events.map((event) => ({
      ...event,
      linkedTodoIds: Array.from(
        new Set([...(event.linkedTodoIds ?? []), ...(eventLinksFromTodos.get(event.id) ?? [])].filter((todoId) => todoMap.has(todoId))),
      ),
    })),
    todos: todos.map((todo) => ({
      ...todo,
      linkedEventIds: Array.from(
        new Set([...(todo.linkedEventIds ?? []), ...(todoLinksFromEvents.get(todo.id) ?? [])].filter((eventId) => eventMap.has(eventId))),
      ),
    })),
  };
}

const priorityWeight: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const statusLabel: Record<TodoStatus, string> = {
  pending: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};

export function formatDateTime(value?: string) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDiaryDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function buildTodoTree(items: TodoItem[]): TodoTreeNode[] {
  const map = new Map<string, TodoTreeNode>();

  items.forEach((item) => {
    map.set(item.id, {
      ...item,
      children: [],
      computedStatus: item.status,
    });
  });

  const roots: TodoTreeNode[] = [];

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const computeStatus = (node: TodoTreeNode): TodoStatus => {
    if (!node.children.length) {
      node.computedStatus = node.status;
      return node.computedStatus;
    }

    const childStatuses = node.children.map(computeStatus);
    if (childStatuses.every((status) => status === "completed")) {
      node.computedStatus = "completed";
    } else if (childStatuses.some((status) => status === "in_progress" || status === "completed")) {
      node.computedStatus = "in_progress";
    } else {
      node.computedStatus = node.status === "cancelled" ? "cancelled" : "pending";
    }
    return node.computedStatus;
  };

  return roots
    .map((root) => ({ ...root, computedStatus: computeStatus(root) }))
    .sort(sortTodos);
}

export function sortTodos(a: TodoItem, b: TodoItem) {
  const aPinned = a.pinnedToToday ? -1 : 0;
  const bPinned = b.pinnedToToday ? -1 : 0;

  if (aPinned !== bPinned) {
    return aPinned - bPinned;
  }

  const priorityCompare = priorityWeight[a.priority] - priorityWeight[b.priority];
  if (priorityCompare !== 0) {
    return priorityCompare;
  }

  if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title, "zh-CN");
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

export function getTodayFocus(items: TodoItem[]) {
  return items
    .filter((item) => item.parentId === null && item.status !== "completed" && item.status !== "cancelled")
    .sort(sortTodos);
}

/**
 * 是否处于"待办中"状态：未开始 / 进行中。
 * 用于待办列表（未完成数量、活跃待办树）。
 */
export function isTodoActive(todo: TodoItem): boolean {
  return todo.status === "pending" || todo.status === "in_progress";
}

/**
 * 是否已归档：已完成 / 已取消。
 * 已归档任务不再显示在待办列表，进入归档区。
 */
export function isTodoArchived(todo: TodoItem): boolean {
  return todo.status === "completed" || todo.status === "cancelled";
}

export function getFilterValues(items: TodoItem[], key: "department" | "contactPerson") {
  return Array.from(
    new Set(items.map((item) => item[key]).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function exportRows(
  events: EventItem[] = [],
  todos: TodoItem[] = [],
  memos: MemoItem[] = [],
) {
  return {
    events: events.map((event) => ({
      日期: event.startTime.slice(0, 10),
      开始时间: event.startTime,
      结束时间: event.endTime,
      标题: event.title,
      详情: event.detail ?? "",
      标签: event.tags.join("、"),
      关联待办ID: (event.linkedTodoIds ?? []).join("、"),
    })),
    todos: todos.map((todo) => ({
      待办标题: todo.title,
      截止日期: todo.dueDate ?? "",
      优先级: todo.priority,
      状态: statusLabel[todo.status],
      部门: todo.department ?? "",
      联系人: todo.contactPerson ?? "",
      备注: todo.remarks ?? "",
      标签: todo.tags.join("、"),
      父任务ID: todo.parentId ?? "",
      关联时间轴ID: (todo.linkedEventIds ?? []).join("、"),
    })),
    memos: memos.map((memo) => ({
      类型: memo.type === "note" ? "心得" : "备忘",
      标题: memo.title,
      关联日期: memo.date ?? "",
      标签: memo.tags.join("、"),
      正文: memo.content ?? "",
      步骤: (memo.steps ?? []).map((s) => s.content).join(" | "),
    })),
  };
}

export function toJsonBlock(data: unknown) {
  return JSON.stringify(data, null, 2);
}

/**
 * 将文本转为无音调拼音（全拼），非中文字符按原样保留。
 * 用于支持拼音搜索：如输入 "dangjian" 可匹配到 "党建"。
 */
export function toPinyin(text: string): string {
  return pinyin(text, { toneType: "none", type: "array", nonZh: "consecutive" })
    .join("")
    .toLowerCase();
}

/**
 * 将文本转为拼音首字母（如 "党建" → "dj"）。
 */
export function toPinyinInitials(text: string): string {
  return pinyin(text, {
    pattern: "first",
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
  })
    .join("")
    .toLowerCase();
}
