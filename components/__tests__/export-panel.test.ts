import { describe, expect, it } from "vitest";
import { buildCsv } from "@/components/export-panel";
import type { EventItem, TodoItem } from "@/types";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "e1",
    startTime: "2026-01-01T09:00:00",
    endTime: "2026-01-01T10:00:00",
    title: "写材料",
    tags: ["党建"],
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function todo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "t1",
    title: "送材料",
    priority: "medium",
    status: "pending",
    tags: [],
    parentId: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildCsv", () => {
  it("生成带表头的事件行", () => {
    const { eventRows } = buildCsv([event()], []);
    const lines = eventRows.split("\n");
    expect(lines[0]).toBe("日期,开始时间,结束时间,标题,详情,标签");
    expect(lines[1]).toContain("写材料");
    expect(lines[1]).toContain("党建");
  });

  it("生成带表头的待办行", () => {
    const { todoRows } = buildCsv([], [todo()]);
    const lines = todoRows.split("\n");
    expect(lines[0]).toBe("标题,截止日期,优先级,状态,部门,联系人,备注,标签");
    expect(lines[1]).toContain("送材料");
    expect(lines[1]).toContain("未开始");
  });

  it("单元格包含逗号 / 引号 / 换行时正确转义", () => {
    const e = event({ title: '写"重要",材料\n下一行' });
    const { eventRows } = buildCsv([e], []);
    // 含特殊字符的单元格应被双引号包裹，内部引号翻倍；换行保留在单元格内
    expect(eventRows).toContain('"写""重要"",材料\n下一行"');
  });

  it("事件关联待办标题不进入 CSV（保持当前格式）", () => {
    const e = event({ title: "开会", linkedTodoIds: ["t1"] });
    const { eventRows } = buildCsv([e], []);
    expect(eventRows).not.toContain("t1");
  });

  it("自定义标签进入 tagRows，一个标签一行", () => {
    const { tagRows } = buildCsv([], [], ["党建", "人事", "纪检"]);
    expect(tagRows).toBe("党建\n人事\n纪检");
  });

  it("无自定义标签时 tagRows 为空串（导出面板显示（无））", () => {
    const { tagRows } = buildCsv([], [], []);
    expect(tagRows).toBe("");
  });

  it("备忘录进入 memoRows，带表头且类型转换正确", () => {
    const memo = {
      id: "m1",
      type: "checklist" as const,
      title: "办理晋升,含逗号",
      tags: ["人事"],
      steps: [
        { id: "s1", content: "核对身份证", completed: true },
        { id: "s2", content: "盖章", completed: false, isWarning: true },
      ],
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    };
    const { memoRows } = buildCsv([], [], [], [memo]);
    const lines = memoRows.split("\n");
    expect(lines[0]).toBe("类型,标题,关联日期,标签,内容摘要,步骤");
    expect(lines[1]).toContain("备忘");
    expect(lines[1]).toContain('"办理晋升,含逗号"'); // 含逗号被转义
    expect(lines[1]).toContain("核对身份证 | 盖章");
  });

  it("无备忘录时 memoRows 仅表头（导出面板显示（无））", () => {
    const { memoRows } = buildCsv([], [], [], []);
    expect(memoRows.split("\n")[0]).toBe("类型,标题,关联日期,标签,内容摘要,步骤");
  });
});
