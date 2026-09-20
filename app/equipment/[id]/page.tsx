import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getItemById, getReviewSummaryForItem, getReviewsForItem } from "@/lib/data/queries";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemById(id);
  return { title: item ? `${item.name} | ComRes` : "Not found | ComRes" };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemById(id);
  if (!item) notFound();

  const [reviews, reviewSummary] = await Promise.all([getReviewsForItem(id), getReviewSummaryForItem(id)]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <Link
        href="/equipment"
        className="font-tag text-xs uppercase tracking-widest text-pine/70 transition-standard hover:text-pine"
      >
        ← Back to the shed
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-canvas-dark">
            <Image
              src={item.images[0]}
              alt={item.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          {item.images.length > 1 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {item.images.slice(1).map((src, i) => (
                <div key={i} className="relative aspect-4/3 overflow-hidden rounded-lg bg-canvas-dark">
                  <Image src={src} alt="" fill sizes="200px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="font-tag text-xs uppercase tracking-widest text-pine/70">{item.category}</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-pine">{item.name}</h1>
          {reviewSummary.count > 0 && (
            <p className="mt-1 font-tag text-xs uppercase tracking-wide text-amber-dark">
              {"★".repeat(Math.round(reviewSummary.average))}
              {"☆".repeat(5 - Math.round(reviewSummary.average))} {reviewSummary.average.toFixed(1)} (
              {reviewSummary.count} review{reviewSummary.count === 1 ? "" : "s"})
            </p>
          )}
          <p className="mt-4 leading-relaxed font-body text-ink/80">{item.description}</p>

          <dl className="gear-tag mt-6 grid grid-cols-2 gap-4 p-4">
            <div>
              <dt className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/50">
                In the shed
              </dt>
              <dd className="font-display text-2xl font-bold text-ink">x{item.totalQuantity}</dd>
            </div>
            <div>
              <dt className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/50">Deposit</dt>
              <dd className="font-display text-2xl font-bold text-ink">
                {item.depositRequired > 0 ? `$${item.depositRequired}` : "None"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-4">
            <div>
              <h2 className="font-tag text-xs uppercase tracking-widest text-ink/50">
                Booking conditions
              </h2>
              <p className="mt-1 font-body text-sm text-ink/70">{item.bookingConditions}</p>
            </div>
            <div>
              <h2 className="font-tag text-xs uppercase tracking-widest text-ink/50">
                Cancellation rules
              </h2>
              <p className="mt-1 font-body text-sm text-ink/70">{item.cancellationRules}</p>
            </div>
            {item.pickupNotes && (
              <div>
                <h2 className="font-tag text-xs uppercase tracking-widest text-ink/50">Pickup</h2>
                <p className="mt-1 font-body text-sm text-ink/70">{item.pickupNotes}</p>
              </div>
            )}
            {item.dropoffNotes && (
              <div>
                <h2 className="font-tag text-xs uppercase tracking-widest text-ink/50">Drop-off</h2>
                <p className="mt-1 font-body text-sm text-ink/70">{item.dropoffNotes}</p>
              </div>
            )}
          </div>

          <Link
            href={`/equipment/${item.id}/request`}
            className="transition-standard mt-8 inline-block rounded-full bg-amber px-6 py-3 font-body font-semibold text-pine hover:bg-amber-dark"
          >
            Request to loan this →
          </Link>

          <div className="mt-8">
            <h2 className="mb-3 font-display text-xl font-bold text-pine">Check availability</h2>
            <AvailabilityCalendar itemId={item.id} totalQuantity={item.totalQuantity} />
          </div>
        </div>
      </div>

      <div className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl font-bold text-pine">
          Feedback &amp; reviews {reviewSummary.count > 0 && `(${reviewSummary.count})`}
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 font-body text-sm text-ink/60">No reviews yet — be the first to borrow and rate it.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {reviews.map((review) => (
              <div key={review.id} className="gear-tag p-4">
                <div className="flex items-center justify-between">
                  <p className="font-tag text-xs uppercase tracking-wide text-amber-dark">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </p>
                  <p className="font-tag text-[0.65rem] uppercase tracking-wide text-ink/40">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="mt-1 font-tag text-xs uppercase tracking-wide text-ink/60">{review.reviewerName}</p>
                {review.comment && <p className="mt-1 font-body text-sm text-ink/80">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
