import { describe, expect, it } from "vitest";
import { mergeItems } from "@/lib/storage-gist";

type Item = { id: string; updatedAt: string };

describe("mergeItems", () => {
  it("本地独有的保留", () => {
    const local: Item[] = [{ id: "a", updatedAt: "2026-01-01T00:00:00Z" }];
    const remote: Item[] = [];
    const { merged, fromRemote } = mergeItems(local, remote);
    expect(merged.map((m) => m.id)).toEqual(["a"]);
    expect(fromRemote).toEqual([]);
  });

  it("远端独有的采纳并标记 fromRemote", () => {
    const local: Item[] = [];
    const remote: Item[] = [{ id: "b", updatedAt: "2026-01-01T00:00:00Z" }];
    const { merged, fromRemote } = mergeItems(local, remote);
    expect(merged.map((m) => m.id)).toEqual(["b"]);
    expect(fromRemote).toEqual(["b"]);
  });

  it("相同 ID 时 updatedAt 较新的胜出", () => {
    const local: Item[] = [{ id: "a", updatedAt: "2026-01-01T00:00:00Z" }];
    const remote: Item[] = [{ id: "a", updatedAt: "2026-02-01T00:00:00Z" }];
    const { merged, fromRemote } = mergeItems(local, remote);
    expect(merged[0].updatedAt).toBe("2026-02-01T00:00:00Z");
    expect(fromRemote).toEqual(["a"]);
  });

  it("本地更新较新时保留本地", () => {
    const local: Item[] = [{ id: "a", updatedAt: "2026-03-01T00:00:00Z" }];
    const remote: Item[] = [{ id: "a", updatedAt: "2026-02-01T00:00:00Z" }];
    const { merged, fromRemote } = mergeItems(local, remote);
    expect(merged[0].updatedAt).toBe("2026-03-01T00:00:00Z");
    expect(fromRemote).toEqual([]);
  });

  it("合并双方独有条目", () => {
    const local: Item[] = [{ id: "a", updatedAt: "2026-01-01T00:00:00Z" }];
    const remote: Item[] = [{ id: "b", updatedAt: "2026-01-01T00:00:00Z" }];
    const { merged } = mergeItems(local, remote);
    expect(merged.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });
});
