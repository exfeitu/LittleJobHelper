import { SearchResult } from "@/types";

export type SearchSort = "default" | "date-desc" | "date-asc" | "title";

export function filterAndSortResults(
  results: SearchResult[],
  kind: SearchResult["kind"] | "all",
  tag: string,
  sort: SearchSort,
): SearchResult[] {
  const filtered = results.filter((result) =>
    (kind === "all" || result.kind === kind) && (!tag || result.tags.includes(tag)),
  );
  if (sort === "default") return filtered;
  const timestamp = (result: SearchResult) => {
    const value = result.dateValue ? new Date(result.dateValue).getTime() : NaN;
    return Number.isFinite(value) ? value : null;
  };
  return filtered.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "zh-CN", { numeric: true });
    const first = timestamp(a);
    const second = timestamp(b);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return sort === "date-asc" ? first - second : second - first;
  });
}
