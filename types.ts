export type Priority = "high" | "medium" | "low";
export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type EventItem = {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  detail?: string;
  tags: string[];
  linkedTodoIds?: string[];
  updatedAt: string;
};

export type TodoStep = {
  id: string;
  content: string;
  completed: boolean;
  scheduledTime?: string;
};

export type TodoItem = {
  id: string;
  title: string;
  startTime?: string;
  dueDate?: string;
  priority: Priority;
  status: TodoStatus;
  tags: string[];
  department?: string;
  contactPerson?: string;
  remarks?: string;
  parentId: string | null;
  pinnedToToday?: boolean;
  linkedEventIds?: string[];
  steps?: TodoStep[];
  updatedAt: string;
};

export type TodoTreeNode = TodoItem & {
  children: TodoTreeNode[];
  computedStatus: TodoStatus;
};

export type SearchResult = {
  id: string;
  kind: "event" | "todo" | "memo";
  title: string;
  snippet: string;
  dateLabel: string;
  tags: string[];
};

export type MemoType = "note" | "checklist";

export type MemoStep = {
  id: string;
  content: string;
  completed: boolean;
  /** 易错点：渲染为红色高亮提示 */
  isWarning?: boolean;
};

export type MemoItem = {
  id: string;
  type: MemoType;
  title: string;
  tags: string[];
  /** 关联日期 "YYYY-MM-DD"（记录完成总结的日期，非截止日） */
  date?: string;
  /** note 类型的富文本正文（HTML） */
  content?: string;
  /** checklist 类型的步骤清单 */
  steps?: MemoStep[];
  createdAt: string;
  updatedAt: string;
};
