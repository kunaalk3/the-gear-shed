import Image from "next/image";
import Link from "next/link";
import type { EquipmentItem } from "@/lib/types";

export default function EquipmentCard({ item }: { item: EquipmentItem }) {
  return (
    <Link
      href={`/equipment/${item.id}`}
      className="gear-tag transition-standard flex flex-col overflow-hidden p-3 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-md bg-canvas-dark">
        <Image
          src={item.images[0]}
          alt={item.name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="mt-3">
        <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
          {item.category}
        </p>
        <h3 className="mt-0.5 font-display text-lg font-bold leading-tight text-ink">
          {item.name}
        </h3>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-canvas-line pt-2 font-tag text-xs uppercase tracking-wide text-ink/60">
        <span>x{item.totalQuantity} in the shed</span>
        {item.depositRequired > 0 ? (
          <span>${item.depositRequired} deposit</span>
        ) : (
          <span className="text-moss">No deposit</span>
        )}
      </div>
    </Link>
  );
}
