import { describe, expect, it } from "vitest";
import { htmlToText, memoProgress, memoSearchText, sortMemos } from "@/lib/memo";
import type { MemoItem } from "@/types";

function memo(overrides: Partial<MemoItem> = {}): MemoItem {
  return {
    id: "m1",
    type: "note",
    title: "2026年项目复盘",
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("htmlToText", () => {
  it("剥离标签并保留文本", () => {
    expect(htmlToText("<p>写<strong>重要</strong>材料</p>")).toBe("写重要材料");
  });

  it("<br> 与块级闭合标签转换为换行", () => {
    const out = htmlToText("<div>第一行<br>第二行</div><p>段落</p><li>条目</li>");
    expect(out).toContain("第一行\n第二行");
    expect(out).toContain("段落\n条目");
  });

  it("解码常见 HTML 实体", () => {
    expect(htmlToText("A &amp; B &lt;tag&gt; &nbsp; C")).toBe("A & B <tag>   C");
  });

  it("img 优先取 alt，无 alt 时 base64 显示为 [图片]", () => {
    expect(htmlToText('<img src="x.png" alt="截图">')).toBe("截图");
    expect(htmlToText('<img src="data:image/png;base64,abc">')).toBe("[图片]");
  });

  it("空输入返回空串", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(undefined as unknown as string)).toBe("");
  });
});

describe("memoProgress", () => {
  it("无步骤时进度为 0/0", () => {
    expect(memoProgress(memo())).toEqual({ completed: 0, total: 0 });
  });

  it("统计部分完成步骤", () => {
    const m = memo({
      type: "checklist",
      steps: [
        { id: "s1", content: "核对身份证", completed: true },
        { id: "s2", content: "盖章", completed: false, isWarning: true },
        { id: "s3", content: "归档", completed: true },
      ],
    });
    expect(memoProgress(m)).toEqual({ completed: 2, total: 3 });
  });

  it("全完成时进度为 total/total", () => {
    const m = memo({
      type: "checklist",
      steps: [
        { id: "s1", content: "a", completed: true },
        { id: "s2", content: "b", completed: true },
      ],
    });
    expect(memoProgress(m)).toEqual({ completed: 2, total: 2 });
  });
});

describe("memoSearchText", () => {
  it("拼接标题 + 正文（HTML 转文本）+ 步骤 + 标签", () => {
    const m = memo({
      title: "工资核算",
      type: "checklist",
      content: undefined,
      steps: [{ id: "s1", content: "核对工资表", completed: false }],
      tags: ["人事"],
    });
    const text = memoSearchText(m);
    expect(text).toContain("工资核算");
    expect(text).toContain("核对工资表");
    expect(text).toContain("人事");
  });

  it("note 正文 HTML 被转成文本后参与搜索", () => {
    const m = memo({
      title: "复盘",
      type: "note",
      content: "<p>这里提到了<strong>档案</strong>流程</p>",
      tags: [],
    });
    expect(memoSearchText(m)).toContain("这里提到了档案流程");
  });
});

describe("sortMemos", () => {
  it("按 updatedAt 倒序，最新在上", () => {
    const older = memo({ id: "a", updatedAt: "2026-01-01T00:00:00Z" });
    const newer = memo({ id: "b", updatedAt: "2026-03-01T00:00:00Z" });
    expect(sortMemos([older, newer])).toEqual([newer, older]);
  });

  it("不修改原数组", () => {
    const m = [memo({ id: "a" }), memo({ id: "b" })];
    const copy = [...m];
    sortMemos(m);
    expect(m).toEqual(copy);
  });
});
