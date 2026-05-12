import { SearchResult } from "@/types";

type SearchPanelProps = {
  results: SearchResult[];
  query: string;
  onQueryChange: (value: string) => void;
};

export function SearchPanel({ results, query, onQueryChange }: SearchPanelProps) {
  return (
    <div className="search-results-wrap">
      <div className="search-box">
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索待办、日程、联系人、标签" />
      </div>
      <div className="search-results">
        {results.map((result) => (
          <article key={result.id} className="search-card">
            <div className="search-card-top">
              <span className={`pill pill-${result.kind}`}>{result.kind === "todo" ? "待办" : "日程"}</span>
              <span className="search-date">{result.dateLabel}</span>
            </div>
            <h4>{result.title}</h4>
            <p>{result.snippet}</p>
            <div className="tag-row">
              {result.tags.map((tag) => (
                <span key={tag} className="tag chip">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
