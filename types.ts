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
};

export type TodoTreeNode = TodoItem & {
  children: TodoTreeNode[];
  computedStatus: TodoStatus;
};

export type SearchResult = {
  id: string;
  kind: "event" | "todo";
  title: string;
  snippet: string;
  dateLabel: string;
  tags: string[];
};
