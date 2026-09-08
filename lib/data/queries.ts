import { sql } from "@/lib/db";
import type {
  BlackoutPeriod,
  Booking,
  Category,
  EquipmentItem,
  LoanRequest,
  LoanRequestStatus,
  User,
} from "@/lib/types";

// Neon's `sql` template returns loosely-typed rows; these mappers are the one
// place snake_case columns become the camelCase shapes the rest of the app expects.

type Row = Record<string, unknown>;

function mapItem(row: Row): EquipmentItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as Category,
    description: row.description as string,
    images: (row.images as string[]) ?? [],
    totalQuantity: row.total_quantity as number,
    depositRequired: row.deposit_required as number,
    bookingConditions: row.booking_conditions as string,
    cancellationRules: row.cancellation_rules as string,
    retired: row.retired as boolean,
  };
}

function mapUser(row: Row): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    organisation: row.organisation as string,
    phone: row.phone as string,
    role: row.role as User["role"],
  };
}

function mapBooking(row: Row): Booking {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    requestId: row.request_id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    quantity: row.quantity as number,
    status: row.status as Booking["status"],
  };
}

function mapBlackout(row: Row): BlackoutPeriod {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    reason: row.reason as string,
    createdAt: row.created_at as string,
  };
}

function mapRequest(row: Row): LoanRequest {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    userId: row.user_id as string,
    requesterName: row.requester_name as string,
    requesterEmail: row.requester_email as string,
    requesterOrganisation: row.requester_organisation as string,
    requesterPhone: row.requester_phone as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    quantity: row.quantity as number,
    notes: row.notes as string,
    status: row.status as LoanRequestStatus,
    adminNote: row.admin_note as string,
    createdAt: row.created_at as string,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
  };
}

// ---- equipment items ----

export async function getActiveItems(): Promise<EquipmentItem[]> {
  const rows = await sql`select * from equipment_items where retired = false order by name`;
  return rows.map(mapItem);
}

export async function getAllItemsAdmin(): Promise<EquipmentItem[]> {
  const rows = await sql`select * from equipment_items order by name`;
  return rows.map(mapItem);
}

export async function getItems(filter: {
  category?: Category | null;
  search?: string | null;
}): Promise<EquipmentItem[]> {
  const { category, search } = filter;
  const like = search ? `%${search}%` : null;

  const rows =
    category && like
      ? await sql`
          select * from equipment_items
          where retired = false and category = ${category}
            and (name ilike ${like} or description ilike ${like})
          order by name
        `
      : category
        ? await sql`select * from equipment_items where retired = false and category = ${category} order by name`
        : like
          ? await sql`
              select * from equipment_items
              where retired = false and (name ilike ${like} or description ilike ${like})
              order by name
            `
          : await sql`select * from equipment_items where retired = false order by name`;

  return rows.map(mapItem);
}

export async function getItemById(
  id: string,
  options?: { includeRetired?: boolean }
): Promise<EquipmentItem | null> {
  const rows = options?.includeRetired
    ? await sql`select * from equipment_items where id = ${id}`
    : await sql`select * from equipment_items where id = ${id} and retired = false`;
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function itemIdExists(id: string): Promise<boolean> {
  const rows = await sql`select 1 from equipment_items where id = ${id}`;
  return rows.length > 0;
}

export async function createItem(item: EquipmentItem): Promise<EquipmentItem> {
  const rows = await sql`
    insert into equipment_items
      (id, name, category, description, images, total_quantity, deposit_required, booking_conditions, cancellation_rules, retired)
    values
      (${item.id}, ${item.name}, ${item.category}, ${item.description}, ${item.images},
       ${item.totalQuantity}, ${item.depositRequired}, ${item.bookingConditions}, ${item.cancellationRules}, ${item.retired})
    returning *
  `;
  return mapItem(rows[0]);
}

export async function updateItem(
  id: string,
  patch: Partial<Omit<EquipmentItem, "id">>
): Promise<EquipmentItem | null> {
  const existing = await getItemById(id, { includeRetired: true });
  if (!existing) return null;

  const merged = { ...existing, ...patch };
  const rows = await sql`
    update equipment_items set
      name = ${merged.name},
      category = ${merged.category},
      description = ${merged.description},
      images = ${merged.images},
      total_quantity = ${merged.totalQuantity},
      deposit_required = ${merged.depositRequired},
      booking_conditions = ${merged.bookingConditions},
      cancellation_rules = ${merged.cancellationRules},
      retired = ${merged.retired}
    where id = ${id}
    returning *
  `;
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function retireItem(id: string): Promise<EquipmentItem | null> {
  const rows = await sql`update equipment_items set retired = true where id = ${id} returning *`;
  return rows[0] ? mapItem(rows[0]) : null;
}

// ---- users ----

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await sql`select * from users where email = ${email}`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql`select * from users where id = ${id}`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function createUser(user: User): Promise<User> {
  await sql`
    insert into users (id, name, email, password_hash, organisation, phone, role)
    values (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.organisation}, ${user.phone}, ${user.role})
  `;
  return user;
}

// ---- bookings ----

export async function getBookingsForItem(itemId: string): Promise<Booking[]> {
  const rows = await sql`select * from bookings where item_id = ${itemId}`;
  return rows.map(mapBooking);
}

export async function createBooking(booking: Booking): Promise<Booking> {
  await sql`
    insert into bookings (id, item_id, request_id, start_date, end_date, quantity, status)
    values (${booking.id}, ${booking.itemId}, ${booking.requestId}, ${booking.startDate}, ${booking.endDate}, ${booking.quantity}, ${booking.status})
  `;
  return booking;
}

async function approveBookingForRequest(requestId: string): Promise<void> {
  await sql`update bookings set status = 'approved' where request_id = ${requestId}`;
}

async function deleteBookingForRequest(requestId: string): Promise<void> {
  await sql`delete from bookings where request_id = ${requestId}`;
}

// ---- blackout periods ----

export async function getBlackoutsForItem(itemId: string): Promise<BlackoutPeriod[]> {
  const rows = await sql`select * from blackout_periods where item_id = ${itemId}`;
  return rows.map(mapBlackout);
}

export async function createBlackout(blackout: BlackoutPeriod): Promise<BlackoutPeriod> {
  await sql`
    insert into blackout_periods (id, item_id, start_date, end_date, reason, created_at)
    values (${blackout.id}, ${blackout.itemId}, ${blackout.startDate}, ${blackout.endDate}, ${blackout.reason}, ${blackout.createdAt})
  `;
  return blackout;
}

export async function deleteBlackout(id: string): Promise<boolean> {
  const rows = await sql`delete from blackout_periods where id = ${id} returning id`;
  return rows.length > 0;
}

// ---- loan requests ----

export async function getRequestsWithItemNames(
  status?: LoanRequestStatus | null
): Promise<(LoanRequest & { itemName: string })[]> {
  const rows = status
    ? await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name
        from loan_requests r
        left join equipment_items i on i.id = r.item_id
        where r.status = ${status}
        order by r.created_at desc
      `
    : await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name
        from loan_requests r
        left join equipment_items i on i.id = r.item_id
        order by r.created_at desc
      `;
  return rows.map((row) => ({ ...mapRequest(row), itemName: row.item_name as string }));
}

export async function getRequestsForUser(
  userId: string
): Promise<(LoanRequest & { itemName: string })[]> {
  const rows = await sql`
    select r.*, coalesce(i.name, 'Unknown item') as item_name
    from loan_requests r
    left join equipment_items i on i.id = r.item_id
    where r.user_id = ${userId}
    order by r.created_at desc
  `;
  return rows.map((row) => ({ ...mapRequest(row), itemName: row.item_name as string }));
}

export async function getRequestById(id: string): Promise<LoanRequest | null> {
  const rows = await sql`select * from loan_requests where id = ${id}`;
  return rows[0] ? mapRequest(rows[0]) : null;
}

export async function createRequestWithBooking(
  loanRequest: LoanRequest,
  booking: Booking
): Promise<LoanRequest> {
  await sql`
    insert into loan_requests
      (id, item_id, user_id, requester_name, requester_email, requester_organisation, requester_phone,
       start_date, end_date, quantity, notes, status, admin_note, created_at, reviewed_at)
    values
      (${loanRequest.id}, ${loanRequest.itemId}, ${loanRequest.userId}, ${loanRequest.requesterName},
       ${loanRequest.requesterEmail}, ${loanRequest.requesterOrganisation}, ${loanRequest.requesterPhone},
       ${loanRequest.startDate}, ${loanRequest.endDate}, ${loanRequest.quantity}, ${loanRequest.notes},
       ${loanRequest.status}, ${loanRequest.adminNote}, ${loanRequest.createdAt}, ${loanRequest.reviewedAt})
  `;
  await createBooking(booking);
  return loanRequest;
}

/** Marks a pending request approved and flips its linked booking, atomically. Returns null if it wasn't pending. */
export async function approveRequest(id: string): Promise<LoanRequest | null> {
  const reviewedAt = new Date().toISOString();
  const rows = await sql`
    update loan_requests set status = 'approved', reviewed_at = ${reviewedAt}
    where id = ${id} and status = 'pending'
    returning *
  `;
  if (!rows[0]) return null;
  await approveBookingForRequest(id);
  return mapRequest(rows[0]);
}

/** Marks a pending request declined and deletes its linked booking to free capacity. Returns null if it wasn't pending. */
export async function declineRequest(id: string, note: string): Promise<LoanRequest | null> {
  const reviewedAt = new Date().toISOString();
  const rows = await sql`
    update loan_requests set status = 'declined', admin_note = ${note}, reviewed_at = ${reviewedAt}
    where id = ${id} and status = 'pending'
    returning *
  `;
  if (!rows[0]) return null;
  await deleteBookingForRequest(id);
  return mapRequest(rows[0]);
}
