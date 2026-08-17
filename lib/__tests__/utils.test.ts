import { describe, expect, it } from "vitest";
import {
  buildTodoTree,
  exportRows,
  getTodayFocus,
  isTodoActive,
  isTodoArchived,
  sortTodos,
  syncLinkedItems,
  toPinyin,
  toPinyinInitials,
} from "@/lib/utils";
import type { EventItem, TodoItem } from "@/types";

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "t1",
    title: "测试任务",
    priority: "medium",
    status: "pending",
    tags: [],
    parentId: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "e1",
    startTime: "2026-01-01T09:00:00",
    endTime: "2026-01-01T10:00:00",
    title: "测试记录",
    tags: [],
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("syncLinkedItems", () => {
  it("补全 Event → Todo 的反向链接", () => {
    const event = makeEvent({ id: "e1", linkedTodoIds: ["t1"] });
    const todo = makeTodo({ id: "t1" });
    const { events, todos } = syncLinkedItems([event], [todo]);
    expect(events[0].linkedTodoIds).toEqual(["t1"]);
    expect(todos[0].linkedEventIds).toEqual(["e1"]);
  });

  it("清理指向已删除条目的断链", () => {
    const event = makeEvent({ id: "e1", linkedTodoIds: ["gone"] });
    const { events } = syncLinkedItems([event], []);
    expect(events[0].linkedTodoIds).toEqual([]);
  });

  it("保留 Todo → Event 的正向链接", () => {
    const event = makeEvent({ id: "e1" });
    const todo = makeTodo({ id: "t1", linkedEventIds: ["e1"] });
    const { events, todos } = syncLinkedItems([event], [todo]);
    expect(todos[0].linkedEventIds).toEqual(["e1"]);
    expect(events[0].linkedTodoIds).toEqual(["t1"]);
  });
});

describe("buildTodoTree", () => {
  it("构建父子嵌套结构", () => {
    const parent = makeTodo({ id: "p1", title: "父" });
    const child = makeTodo({ id: "c1", title: "子", parentId: "p1" });
    const roots = buildTodoTree([child, parent]);
    expect(roots).toHaveLength(1);
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].id).toBe("c1");
  });

  it("子任务全部完成时父任务提升为 completed", () => {
    const parent = makeTodo({ id: "p1", title: "父", status: "in_progress" });
    const c1 = makeTodo({ id: "c1", title: "子1", parentId: "p1", status: "completed" });
    const c2 = makeTodo({ id: "c2", title: "子2", parentId: "p1", status: "completed" });
    const roots = buildTodoTree([parent, c1, c2]);
    expect(roots[0].computedStatus).toBe("completed");
  });

  it("孤儿节点（parentId 不存在）作为根节点", () => {
    const orphan = makeTodo({ id: "o1", parentId: "missing" });
    const roots = buildTodoTree([orphan]);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe("o1");
  });
});

describe("sortTodos", () => {
  it("置顶优先", () => {
    const pinned = makeTodo({ id: "a", pinnedToToday: true });
    const normal = makeTodo({ id: "b" });
    expect(sortTodos(normal, pinned)).toBeGreaterThan(0);
  });

  it("高优先级在前", () => {
    const high = makeTodo({ id: "a", priority: "high" });
    const low = makeTodo({ id: "b", priority: "low" });
    expect(sortTodos(high, low)).toBeLessThan(0);
  });

  it("有截止日期的排在无截止日期之前", () => {
    const hasDue = makeTodo({ id: "a", dueDate: "2026-02-01T10:00:00" });
    const noDue = makeTodo({ id: "b" });
    expect(sortTodos(hasDue, noDue)).toBeLessThan(0);
  });
});

describe("getTodayFocus", () => {
  it("过滤已完成和已取消", () => {
    const items = [
      makeTodo({ id: "a" }),
      makeTodo({ id: "b", status: "completed" }),
      makeTodo({ id: "c", status: "cancelled" }),
      makeTodo({ id: "d", parentId: "x" }),
    ];
    const focus = getTodayFocus(items);
    expect(focus.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("isTodoActive / isTodoArchived", () => {
  it("pending 与 in_progress 属于活跃待办", () => {
    expect(isTodoActive(makeTodo({ status: "pending" }))).toBe(true);
    expect(isTodoActive(makeTodo({ status: "in_progress" }))).toBe(true);
  });

  it("completed 与 cancelled 不属于活跃待办", () => {
    expect(isTodoActive(makeTodo({ status: "completed" }))).toBe(false);
    expect(isTodoActive(makeTodo({ status: "cancelled" }))).toBe(false);
  });

  it("completed 与 cancelled 属于归档", () => {
    expect(isTodoArchived(makeTodo({ status: "completed" }))).toBe(true);
    expect(isTodoArchived(makeTodo({ status: "cancelled" }))).toBe(true);
  });

  it("pending 与 in_progress 不属于归档", () => {
    expect(isTodoArchived(makeTodo({ status: "pending" }))).toBe(false);
    expect(isTodoArchived(makeTodo({ status: "in_progress" }))).toBe(false);
  });
});

describe("exportRows", () => {
  it("输出包含中文表头的行", () => {
    const event = makeEvent({ id: "e1", title: "写材料", tags: ["党建"] });
    const todo = makeTodo({ id: "t1", title: "送材料" });
    const { events, todos } = exportRows([event], [todo]);
    expect(events[0].标题).toBe("写材料");
    expect(events[0].标签).toBe("党建");
    expect(todos[0].待办标题).toBe("送材料");
    expect(todos[0].状态).toBe("未开始");
  });

  it("带备忘录时输出备忘映射行", () => {
    const memo = {
      id: "m1",
      type: "checklist" as const,
      title: "办理晋升",
      tags: ["人事"],
      date: "2026-08-01",
      steps: [
        { id: "s1", content: "核对身份证", completed: true },
        { id: "s2", content: "盖章", completed: false },
      ],
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    };
    const { memos } = exportRows([], [], [memo]);
    expect(memos[0].标题).toBe("办理晋升");
    expect(memos[0].类型).toBe("备忘");
    expect(memos[0].步骤).toBe("核对身份证 | 盖章");
  });
});

describe("toPinyin / toPinyinInitials", () => {
  it("全拼转换", () => {
    expect(toPinyin("党建")).toBe("dangjian");
  });

  it("首字母转换", () => {
    expect(toPinyinInitials("党建")).toBe("dj");
  });

  it("混合中英文", () => {
    expect(toPinyin("党建2026")).toBe("dangjian2026");
  });
});
