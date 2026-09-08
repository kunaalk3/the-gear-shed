import Link from "next/link";
import { CATEGORIES } from "@/lib/types";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-canvas-line bg-canvas-dark">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold uppercase text-pine">Community ShareSpace SA</p>
          <p className="mt-2 max-w-xs font-body text-sm text-ink/70">
            A shared equipment library run by Community Resource Network SA, so local
            groups can borrow instead of buy.
          </p>
        </div>

        <div>
          <p className="font-tag text-xs uppercase tracking-widest text-ink/50">Categories</p>
          <ul className="mt-2 space-y-1 font-body text-sm">
            {CATEGORIES.map((category) => (
              <li key={category}>
                <Link
                  href={`/equipment?category=${encodeURIComponent(category)}`}
                  className="text-ink/70 transition-standard hover:text-pine"
                >
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-tag text-xs uppercase tracking-widest text-ink/50">Get in touch</p>
          <p className="mt-2 font-body text-sm text-ink/70">
            Community Resource Network SA
            <br />
            hello@communityresourcenetwork.org.au
          </p>
        </div>
      </div>
    </footer>
  );
}
