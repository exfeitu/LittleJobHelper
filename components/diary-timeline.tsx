import { EventItem } from "@/types";
import { formatTime } from "@/lib/utils";

type DiaryProps = {
  events: EventItem[];
};

export function DiaryTimeline({ events }: DiaryProps) {
  return (
    <div className="diary-list">
      {events.map((event) => (
        <article key={event.id} className="diary-entry">
          <div className="diary-time">
            <strong>{formatTime(event.startTime)}</strong>
            <span>{formatTime(event.endTime)}</span>
          </div>
          <div className="diary-content">
            <h4>{event.title}</h4>
            <p>{event.detail}</p>
            <div className="tag-row">
              {event.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
