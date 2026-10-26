import type {
  BookingFulfillmentHistoryEvent,
  BookingFulfillmentStatus,
} from "@/lib/fulfillment";
import { formatTimestamp } from "@/lib/format-timestamp";
import { EQUIPMENT_CONDITION_LABELS } from "@/lib/types";

const STATUS_LABELS: Record<BookingFulfillmentStatus, string> = {
  not_started: "Not started",
  collected: "Collected",
  returned: "Returned",
  donation_completed: "Donation completed",
  legacy_unknown: "Legacy fulfilment needs reconciliation",
};

const EVENT_LABELS: Record<BookingFulfillmentHistoryEvent["eventType"], string> = {
  collection_confirmed: "Collection confirmed",
  return_inspected: "Return inspected",
  donation_handover_confirmed: "Donation handover completed",
};

export default function RequestFulfillmentHistory({
  status,
  events,
}: {
  status: BookingFulfillmentStatus;
  events: BookingFulfillmentHistoryEvent[];
}) {
  return (
    <section
      aria-label="Booking fulfilment"
      className="mt-3 border-t border-dashed border-canvas-line pt-3"
    >
      <p className="font-tag text-xs uppercase tracking-wide text-pine">
        Fulfilment status: {STATUS_LABELS[status]}
      </p>
      {events.length > 0 && (
        <ol aria-label="Fulfilment history" className="mt-2 flex flex-col gap-2">
          {events.map((event) => {
            const occurredAt = formatTimestamp(event.occurredAt);
            return (
              <li key={event.id} className="font-body text-sm text-ink/70">
                <p className="font-semibold text-ink">{EVENT_LABELS[event.eventType]}</p>
                <p className="text-ink/50">
                  {occurredAt ?? "Time unavailable"}
                  {event.actorName ? ` · recorded by ${event.actorName}` : ""}
                  {` · x${event.quantity}`}
                </p>
                <p className="text-ink/60">
                  Condition: {EQUIPMENT_CONDITION_LABELS[event.condition]}
                </p>
                {event.notes && <p className="mt-1 text-ink/60">Notes: {event.notes}</p>}
                {event.evidenceRefs.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-x-3">
                    {event.evidenceRefs.map((reference) => {
                      let safeReference: string | null = null;
                      try {
                        const url = new URL(reference);
                        if (url.protocol === "https:") safeReference = url.href;
                      } catch {
                        safeReference = null;
                      }
                      return safeReference ? (
                        <li key={reference}>
                          <a
                            href={safeReference}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pine underline underline-offset-2"
                          >
                            Evidence
                          </a>
                        </li>
                      ) : null;
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
