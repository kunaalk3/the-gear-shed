import type { RequestStatusHistory as RequestStatusHistoryEntry } from "@/lib/types";

const statusLabel = (status: RequestStatusHistoryEntry["toStatus"]) =>
  status.charAt(0).toUpperCase() + status.slice(1);

export default function RequestStatusHistory({
  events,
}: {
  events: RequestStatusHistoryEntry[];
}) {
  return (
    <ol aria-label="Request status history" className="mt-3 flex flex-col gap-2 border-t border-dashed border-canvas-line pt-3">
      {events.map((event) => (
        <li key={event.id} className="font-body text-sm text-ink/70">
          <span className="font-semibold text-ink">
            {event.fromStatus
              ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`
              : `Request created · ${statusLabel(event.toStatus)}`}
          </span>
          <span className="ml-2 text-ink/50">{new Date(event.createdAt).toLocaleString()}</span>
          <span className="ml-2 text-ink/50">
            {event.actorName ? `by ${event.actorName}` : "by a previous reviewer"}
          </span>
          {event.reason && <p className="mt-1 text-ink/60">Reason: {event.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
