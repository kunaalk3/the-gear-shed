import Link from "next/link";
import { getActiveItems } from "@/lib/data/queries";
import { CATEGORIES } from "@/lib/types";
import EquipmentCard from "@/components/EquipmentCard";

// Reads live inventory from Postgres on every request — without this it would be
// baked into a static page at build time and go stale until the next deploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const activeItems = await getActiveItems();

  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, category) => {
    acc[category] = activeItems.filter((item) => item.category === category).length;
    return acc;
  }, {});

  const featuredIds = ["trestle-table-1-8", "cricket-kit-full", "wireless-mic-dual"];
  const featured = featuredIds
    .map((id) => activeItems.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-canvas-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="font-tag text-xs uppercase tracking-widest text-pine/70">
              Community Resource Network SA
            </p>
            <h1 className="mt-3 font-display text-5xl leading-[0.95] font-bold uppercase text-pine sm:text-6xl">
              Borrow what your event needs.
            </h1>
            <p className="mt-5 max-w-md font-body text-lg text-ink/70">
              Marquees, tables, sound gear, sporting kit and cooking equipment — shared
              across local groups instead of sitting unused in a shed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/equipment"
                className="transition-standard rounded-full bg-amber px-6 py-3 font-body font-semibold text-pine hover:bg-amber-dark"
              >
                Browse equipment →
              </Link>
              <Link
                href="#how-it-works"
                className="transition-standard rounded-full border border-pine px-6 py-3 font-body font-semibold text-pine hover:bg-pine hover:text-canvas"
              >
                How it works
              </Link>
            </div>
          </div>

          <div className="relative h-72 sm:h-80" aria-hidden="true">
            <div className="gear-tag transition-standard absolute top-8 left-2 w-56 -rotate-6 p-4 shadow-md hover:-translate-y-1 sm:w-64">
              <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                Marquees
              </p>
              <p className="font-display text-lg font-bold text-ink">6x3m Pole Marquee</p>
              <p className="mt-1 font-tag text-xs text-moss">Available</p>
            </div>
            <div className="gear-tag transition-standard absolute top-0 right-0 w-56 rotate-3 p-4 shadow-lg hover:-translate-y-1 sm:w-64">
              <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                Audio Equipment
              </p>
              <p className="font-display text-lg font-bold text-ink">Portable PA System</p>
              <p className="mt-1 font-tag text-xs text-amber">Limited</p>
            </div>
            <div className="gear-tag transition-standard absolute bottom-0 left-16 w-56 rotate-1 p-4 shadow-lg hover:-translate-y-1 sm:w-64">
              <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                Cooking Facilities
              </p>
              <p className="font-display text-lg font-bold text-ink">LPG BBQ Trailer</p>
              <p className="mt-1 font-tag text-xs text-moss">Available</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-canvas-dark/50 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-3 px-5">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/equipment?category=${encodeURIComponent(category)}`}
              className="transition-standard rounded-full border border-canvas-line bg-canvas px-4 py-2 font-tag text-xs uppercase tracking-wide text-ink/70 hover:border-pine hover:text-pine"
            >
              {category} <span className="text-ink/40">· {categoryCounts[category] ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-5 py-16">
        <p className="font-tag text-xs uppercase tracking-widest text-pine/70">The process</p>
        <h2 className="mt-1 font-display text-3xl font-bold text-pine">How it works</h2>

        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          <Step
            n="01"
            title="Browse the shed"
            body="Check what's available and see live availability before you plan your dates."
          />
          <Step
            n="02"
            title="Send a request"
            body="Register a free account, pick your dates and quantity, and send the request."
          />
          <Step
            n="03"
            title="Get approved & collect"
            body="Community Resource Network SA reviews your request and arranges pickup."
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold text-pine">From the shed</h2>
          <Link
            href="/equipment"
            className="font-body text-sm font-semibold text-pine underline underline-offset-2"
          >
            See everything
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {featured.map((item) => (
            <EquipmentCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <span className="font-display text-4xl font-bold text-pine/20">{n}</span>
      <h3 className="mt-1 font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mt-1 font-body text-sm text-ink/70">{body}</p>
    </div>
  );
}
