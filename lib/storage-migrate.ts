import { EventItem, TodoItem } from "@/types";

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
 *   2 — 为所有条目添加 updatedAt 字段（用于多端同步冲突检测）
 */
export const CURRENT_DATA_VERSION = 2;

export type DataBundle = { events: EventItem[]; todos: TodoItem[]; customTags?: string[] };

/**
 * 迁移函数数组：migrations[i] 负责从版本 i 迁移到 i+1。
 * 例如 migrations[0] 把版本 0 的数据升级到版本 1。
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
export function parseVersion(version: unknown): number {
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
