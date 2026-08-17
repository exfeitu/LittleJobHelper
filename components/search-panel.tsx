import { SearchResult } from "@/types";

type SearchPanelProps = {
  results: SearchResult[];
  query: string;
  onQueryChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
};

/** 将文本中匹配 query 的部分用 <mark> 高亮 */
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || !text) return text;

  const lower = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let index = 0;
  let start = lower.indexOf(lowerQuery);

  while (start !== -1) {
    if (start > index) parts.push(text.slice(index, start));
    parts.push(
      <mark key={`${start}-${text.slice(start, start + q.length)}`} className="search-mark">
        {text.slice(start, start + q.length)}
      </mark>,
    );
    index = start + q.length;
    start = lower.indexOf(lowerQuery, index);
  }
  if (index < text.length) parts.push(text.slice(index));
  return parts;
}

export function SearchPanel({ results, query, onQueryChange, inputRef }: SearchPanelProps) {
  const kindLabel = (kind: SearchResult["kind"]) => {
    if (kind === "todo") return "待办";
    if (kind === "event") return "工作记录";
    return "备忘录";
  };

  return (
    <div className="search-results-wrap" role="search">
      <div className="search-box">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索待办、工作记录、备忘录、联系人、标签（支持拼音）"
          aria-label="搜索"
        />
      </div>
      <div className="search-results">
        {results.length > 0 ? (
          results.map((result) => (
            <article key={result.id} className="search-card">
              <div className="search-card-top">
                <span className={`pill pill-${result.kind}`}>{kindLabel(result.kind)}</span>
                <span className="search-date">{result.dateLabel}</span>
              </div>
              <h4>{highlight(result.title, query)}</h4>
              <p>{highlight(result.snippet, query)}</p>
              <div className="tag-row">
                {result.tags.map((tag) => (
                  <span key={tag} className="tag chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>
            {query.trim() ? "未找到匹配结果" : "暂无数据"}
          </p>
        )}
      </div>
    </div>
  );
}
