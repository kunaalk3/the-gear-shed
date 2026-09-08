import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}

const sql = neon(url);

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function img(seed) {
  return `https://picsum.photos/seed/${seed}/640/480`;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

const items = [
  {
    id: "marquee-pole-6x3",
    name: "6x3m Pole Marquee (White)",
    category: "Marquees",
    description:
      "Classic peaked-roof marquee, seats around 30 under cover. Includes poles, guy ropes and stakes. Two people can pitch it in about 45 minutes.",
    images: [img("marquee-pole-6x3-a"), img("marquee-pole-6x3-b")],
    totalQuantity: 4,
    depositRequired: 150,
    bookingConditions: "Requires a hard or grassed site with room to peg out guy lines. Not rated for high wind — bring it down if gusts exceed 40km/h.",
    cancellationRules: "Free cancellation up to 7 days before pickup. Inside 7 days, the deposit is forfeited.",
  },
  {
    id: "gazebo-popup-3x3",
    name: "3x3m Pop-Up Gazebo",
    category: "Marquees",
    description: "Folding frame gazebo with wheeled carry bag. Up in under 5 minutes, no tools needed. Good for market stalls and small stands.",
    images: [img("gazebo-popup-3x3-a"), img("gazebo-popup-3x3-b")],
    totalQuantity: 8,
    depositRequired: 40,
    bookingConditions: "Use sandbags or stakes in any wind — the frame is light. Sandbags not supplied.",
    cancellationRules: "Free cancellation up to 48 hours before pickup.",
  },
  {
    id: "marquee-frame-6x6",
    name: "6x6m Frame Marquee (Heavy Duty)",
    category: "Marquees",
    description: "Steel-framed marquee with clear-span roof, walls included. Our largest unit — suits fetes, sausage sizzles and larger gatherings.",
    images: [img("marquee-frame-6x6-a"), img("marquee-frame-6x6-b")],
    totalQuantity: 2,
    depositRequired: 200,
    bookingConditions: "Requires 3+ people to pitch. Delivery/pickup by trailer can be arranged — ask when you submit your request.",
    cancellationRules: "Free cancellation up to 14 days before pickup. Inside 14 days, 50% of the deposit is forfeited.",
  },
  {
    id: "trestle-table-1-8",
    name: "Trestle Table (1.8m)",
    category: "Tables & Chairs",
    description: "Standard folding trestle table, seats 6-8. Wipeable laminate top.",
    images: [img("trestle-table-a")],
    totalQuantity: 20,
    depositRequired: 0,
    bookingConditions: "Stack no more than 6 high when transporting.",
    cancellationRules: "Free cancellation any time before pickup.",
  },
  {
    id: "stacking-chairs-10",
    name: "Stacking Chairs (Set of 10)",
    category: "Tables & Chairs",
    description: "Lightweight stackable chairs, indoor/outdoor use. Hired in sets of 10.",
    images: [img("stacking-chairs-a")],
    totalQuantity: 15,
    depositRequired: 0,
    bookingConditions: "Please keep chairs dry — store under cover if rain is forecast.",
    cancellationRules: "Free cancellation any time before pickup.",
  },
  {
    id: "banquet-table-round",
    name: "Round Banquet Table (1.5m, seats 8)",
    category: "Tables & Chairs",
    description: "Round folding table for sit-down events. Pairs well with our stacking chairs.",
    images: [img("banquet-table-a")],
    totalQuantity: 10,
    depositRequired: 20,
    bookingConditions: "Requires two people to fold and carry safely.",
    cancellationRules: "Free cancellation up to 48 hours before pickup.",
  },
  {
    id: "pa-system-portable",
    name: "Portable PA System (2 Speakers)",
    category: "Audio Equipment",
    description: "Battery-powered PA with two speakers, mixer and one wired microphone. Covers small-to-medium outdoor crowds.",
    images: [img("pa-system-a"), img("pa-system-b")],
    totalQuantity: 3,
    depositRequired: 100,
    bookingConditions: "A short walkthrough is required before first use — allow 15 minutes at pickup. Keep away from rain unless under cover.",
    cancellationRules: "Free cancellation up to 5 days before pickup. Inside 5 days, the deposit is forfeited.",
  },
  {
    id: "wireless-mic-dual",
    name: "Wireless Handheld Microphone (Dual Set)",
    category: "Audio Equipment",
    description: "Two wireless handheld mics with receiver. Pairs with the portable PA or your own sound gear.",
    images: [img("wireless-mic-a")],
    totalQuantity: 6,
    depositRequired: 50,
    bookingConditions: "Fresh batteries supplied — please return with the set, even if flat.",
    cancellationRules: "Free cancellation up to 48 hours before pickup.",
  },
  {
    id: "mixer-speaker-kit",
    name: "Powered Mixer & Speaker Kit",
    category: "Audio Equipment",
    description: "Compact powered mixer with a single full-range speaker on a stand. Good for MC duties and background music.",
    images: [img("mixer-speaker-a")],
    totalQuantity: 2,
    depositRequired: 100,
    bookingConditions: "Speaker stand included — check the base is on stable, level ground.",
    cancellationRules: "Free cancellation up to 5 days before pickup. Inside 5 days, the deposit is forfeited.",
  },
  {
    id: "cricket-kit-full",
    name: "Cricket Kit (Full Set)",
    category: "Sporting Equipment",
    description: "Bats, stumps, pads, gloves and balls for a full backyard or club-level game.",
    images: [img("cricket-kit-a")],
    totalQuantity: 4,
    depositRequired: 30,
    bookingConditions: "Please check all pieces are returned — a kit list is included in the bag.",
    cancellationRules: "Free cancellation any time before pickup.",
  },
  {
    id: "netball-hoop-set",
    name: "Netball / Basketball Set with Portable Hoop",
    category: "Sporting Equipment",
    description: "Wheeled portable hoop with adjustable height, plus two balls.",
    images: [img("netball-hoop-a")],
    totalQuantity: 3,
    depositRequired: 30,
    bookingConditions: "Needs a flat, hard surface. Base is water-filled for stability — fill on site, empty before return.",
    cancellationRules: "Free cancellation up to 48 hours before pickup.",
  },
  {
    id: "tug-of-war-rope",
    name: "Tug-of-War Rope (20m)",
    category: "Sporting Equipment",
    description: "Heavy-duty 20m rope with marked centre point, popular for school and community fun days.",
    images: [img("tug-of-war-a")],
    totalQuantity: 5,
    depositRequired: 0,
    bookingConditions: "Inspect for fraying before use on hard surfaces.",
    cancellationRules: "Free cancellation any time before pickup.",
  },
  {
    id: "bbq-trailer-lpg",
    name: "LPG BBQ Trailer (4-Burner)",
    category: "Cooking Facilities",
    description: "Tow-behind BBQ trailer with four burners and a full-length hotplate. Feeds a crowd.",
    images: [img("bbq-trailer-a"), img("bbq-trailer-b")],
    totalQuantity: 2,
    depositRequired: 150,
    bookingConditions: "Towing requires a valid licence and compatible tow ball. Must be returned with the hotplate cleaned and the gas bottle at the level it was collected at.",
    cancellationRules: "Free cancellation up to 7 days before pickup. Inside 7 days, the deposit is forfeited.",
  },
  {
    id: "catering-urn-20l",
    name: "Catering Urn (20L)",
    category: "Cooking Facilities",
    description: "Electric urn for tea and coffee service, makes around 100 cups per fill.",
    images: [img("catering-urn-a")],
    totalQuantity: 6,
    depositRequired: 0,
    bookingConditions: "Standard power point required (10A). Descale before return if used with hard water.",
    cancellationRules: "Free cancellation up to 48 hours before pickup.",
  },
  {
    id: "camp-oven-set",
    name: "Outdoor Camp Oven Set",
    category: "Cooking Facilities",
    description: "Cast-iron camp ovens in three sizes with lid lifter and trivets, for open-fire or coal cooking.",
    images: [img("camp-oven-a")],
    totalQuantity: 4,
    depositRequired: 20,
    bookingConditions: "Return cleaned and lightly oiled to prevent rust.",
    cancellationRules: "Free cancellation any time before pickup.",
  },
];

for (const item of items) {
  await sql`
    insert into equipment_items (id, name, category, description, images, total_quantity, deposit_required, booking_conditions, cancellation_rules, retired)
    values (${item.id}, ${item.name}, ${item.category}, ${item.description}, ${item.images}, ${item.totalQuantity}, ${item.depositRequired}, ${item.bookingConditions}, ${item.cancellationRules}, false)
    on conflict (id) do nothing
  `;
}

const users = [
  {
    id: "seed-user-admin",
    name: "Alex Ferraro",
    email: "admin@communityresourcenetwork.org.au",
    passwordHash: hashPassword("admin123"),
    organisation: "Community Resource Network SA",
    phone: "",
    role: "admin",
  },
  {
    id: "seed-user-requester",
    name: "Sam Wilson",
    email: "sam.wilson@example.com",
    passwordHash: hashPassword("password123"),
    organisation: "Westside Football Club",
    phone: "0400 111 222",
    role: "requester",
  },
];

for (const user of users) {
  await sql`
    insert into users (id, name, email, password_hash, organisation, phone, role)
    values (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.organisation}, ${user.phone}, ${user.role})
    on conflict (id) do nothing
  `;
}

const today = new Date();

const bookings = [
  {
    id: "seed-booking-1",
    itemId: "marquee-pole-6x3",
    requestId: "seed-legacy-1",
    startDate: iso(addDays(today, 5)),
    endDate: iso(addDays(today, 7)),
    quantity: 3,
    status: "approved",
  },
  {
    id: "seed-booking-2",
    itemId: "pa-system-portable",
    requestId: "seed-legacy-2",
    startDate: iso(addDays(today, 10)),
    endDate: iso(addDays(today, 10)),
    quantity: 2,
    status: "approved",
  },
  {
    id: "seed-booking-3",
    itemId: "bbq-trailer-lpg",
    requestId: "seed-legacy-3",
    startDate: iso(addDays(today, 3)),
    endDate: iso(addDays(today, 4)),
    quantity: 2,
    status: "pending",
  },
  {
    id: "seed-booking-demo",
    itemId: "cricket-kit-full",
    requestId: "seed-request-demo",
    startDate: iso(addDays(today, 12)),
    endDate: iso(addDays(today, 13)),
    quantity: 1,
    status: "pending",
  },
];

const requests = [
  {
    id: "seed-request-demo",
    itemId: "cricket-kit-full",
    userId: "seed-user-requester",
    requesterName: "Sam Wilson",
    requesterEmail: "sam.wilson@example.com",
    requesterOrganisation: "Westside Football Club",
    requesterPhone: "0400 111 222",
    startDate: iso(addDays(today, 12)),
    endDate: iso(addDays(today, 13)),
    quantity: 1,
    notes: "For our Sunday junior training day.",
    status: "pending",
    adminNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  },
];

const blackouts = [
  {
    id: "seed-blackout-1",
    itemId: "netball-hoop-set",
    startDate: iso(addDays(today, 1)),
    endDate: iso(addDays(today, 2)),
    reason: "Base repair — cracked wheel housing.",
    createdAt: new Date().toISOString(),
  },
];

for (const r of requests) {
  await sql`
    insert into loan_requests (id, item_id, user_id, requester_name, requester_email, requester_organisation, requester_phone, start_date, end_date, quantity, notes, status, admin_note, created_at, reviewed_at)
    values (${r.id}, ${r.itemId}, ${r.userId}, ${r.requesterName}, ${r.requesterEmail}, ${r.requesterOrganisation}, ${r.requesterPhone}, ${r.startDate}, ${r.endDate}, ${r.quantity}, ${r.notes}, ${r.status}, ${r.adminNote}, ${r.createdAt}, ${r.reviewedAt})
    on conflict (id) do nothing
  `;
}

for (const b of bookings) {
  await sql`
    insert into bookings (id, item_id, request_id, start_date, end_date, quantity, status)
    values (${b.id}, ${b.itemId}, ${b.requestId}, ${b.startDate}, ${b.endDate}, ${b.quantity}, ${b.status})
    on conflict (id) do nothing
  `;
}

for (const b of blackouts) {
  await sql`
    insert into blackout_periods (id, item_id, start_date, end_date, reason, created_at)
    values (${b.id}, ${b.itemId}, ${b.startDate}, ${b.endDate}, ${b.reason}, ${b.createdAt})
    on conflict (id) do nothing
  `;
}

console.log(`Seeded ${items.length} items, ${users.length} users, ${requests.length} requests, ${bookings.length} bookings, ${blackouts.length} blackouts.`);
