import { sql } from "@/lib/db";
import type {
  AppNotification,
  BlackoutPeriod,
  Booking,
  Category,
  EquipmentItem,
  Feedback,
  LoanRequest,
  LoanRequestStatus,
  NotificationType,
  OrgStatus,
  Review,
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
    ownerId: (row.owner_id as string | null) ?? null,
    pickupNotes: (row.pickup_notes as string) ?? "",
    dropoffNotes: (row.dropoff_notes as string) ?? "",
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
    orgStatus: row.org_status as User["orgStatus"],
    acceptedPaymentMethods: (row.accepted_payment_methods as string[]) ?? [],
    termsAccepted: (row.terms_accepted as boolean) ?? false,
    termsVersion: (row.terms_version as string) ?? "",
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
    termsAccepted: row.terms_accepted as boolean,
    termsVersion: row.terms_version as string,
    badHire: row.bad_hire as boolean,
  };
}

function mapFeedback(row: Row): Feedback {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    message: row.message as string,
    createdAt: row.created_at as string,
  };
}

function mapNotification(row: Row): AppNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    message: row.message as string,
    link: row.link as string,
    read: row.read as boolean,
    createdAt: row.created_at as string,
  };
}

function mapReview(row: Row): Review {
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    itemId: row.item_id as string,
    userId: row.user_id as string,
    rating: row.rating as number,
    comment: row.comment as string,
    createdAt: row.created_at as string,
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

export async function getItemsForOwner(ownerId: string): Promise<EquipmentItem[]> {
  const rows = await sql`select * from equipment_items where owner_id = ${ownerId} order by name`;
  return rows.map(mapItem);
}

export async function itemIdExists(id: string): Promise<boolean> {
  const rows = await sql`select 1 from equipment_items where id = ${id}`;
  return rows.length > 0;
}

export async function createItem(item: EquipmentItem): Promise<EquipmentItem> {
  const rows = await sql`
    insert into equipment_items
      (id, name, category, description, images, total_quantity, deposit_required, booking_conditions, cancellation_rules, retired, owner_id, pickup_notes, dropoff_notes)
    values
      (${item.id}, ${item.name}, ${item.category}, ${item.description}, ${item.images},
       ${item.totalQuantity}, ${item.depositRequired}, ${item.bookingConditions}, ${item.cancellationRules}, ${item.retired}, ${item.ownerId},
       ${item.pickupNotes}, ${item.dropoffNotes})
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
      retired = ${merged.retired},
      pickup_notes = ${merged.pickupNotes},
      dropoff_notes = ${merged.dropoffNotes}
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
    insert into users (id, name, email, password_hash, organisation, phone, role, org_status, terms_accepted, terms_version)
    values (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.organisation}, ${user.phone}, ${user.role}, ${user.orgStatus}, ${user.termsAccepted}, ${user.termsVersion})
  `;
  return user;
}

// ---- organisation accounts ----

export async function getOrgAccounts(status?: OrgStatus | null): Promise<User[]> {
  const rows = status
    ? await sql`select * from users where role = 'org' and org_status = ${status} order by name`
    : await sql`select * from users where role = 'org' order by name`;
  return rows.map(mapUser);
}

/** Marks a pending org account approved. Returns null if it wasn't pending. */
export async function approveOrg(id: string): Promise<User | null> {
  const rows = await sql`
    update users set org_status = 'approved'
    where id = ${id} and role = 'org' and org_status = 'pending'
    returning *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

/** Marks a pending org account rejected. Returns null if it wasn't pending. */
export async function rejectOrg(id: string): Promise<User | null> {
  const rows = await sql`
    update users set org_status = 'rejected'
    where id = ${id} and role = 'org' and org_status = 'pending'
    returning *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

/** Marks an approved org account retired. Returns null if it wasn't approved. */
export async function retireOrg(id: string): Promise<User | null> {
  const rows = await sql`
    update users set org_status = 'retired'
    where id = ${id} and role = 'org' and org_status = 'approved'
    returning *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function setAcceptedPaymentMethods(id: string, methods: string[]): Promise<User | null> {
  const rows = await sql`
    update users set accepted_payment_methods = ${methods}
    where id = ${id} and role = 'org'
    returning *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getAdminUsers(): Promise<User[]> {
  const rows = await sql`select * from users where role = 'admin'`;
  return rows.map(mapUser);
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

export async function getBlackoutById(id: string): Promise<BlackoutPeriod | null> {
  const rows = await sql`select * from blackout_periods where id = ${id}`;
  return rows[0] ? mapBlackout(rows[0]) : null;
}

// ---- loan requests ----

type RequestWithItemRow = LoanRequest & {
  itemName: string;
  ownerId: string | null;
  ownerOrganisation: string | null;
};

function mapRequestWithItem(row: Row): RequestWithItemRow {
  return {
    ...mapRequest(row),
    itemName: row.item_name as string,
    ownerId: (row.owner_id as string | null) ?? null,
    ownerOrganisation: (row.owner_organisation as string | null) ?? null,
  };
}

export async function getRequestsWithItemNames(
  status?: LoanRequestStatus | null
): Promise<RequestWithItemRow[]> {
  const rows = status
    ? await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.owner_id, o.organisation as owner_organisation
        from loan_requests r
        left join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        where r.status = ${status}
        order by r.created_at desc
      `
    : await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.owner_id, o.organisation as owner_organisation
        from loan_requests r
        left join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        order by r.created_at desc
      `;
  return rows.map(mapRequestWithItem);
}

/** Requests for items owned by a specific organisation account. */
export async function getRequestsForOwner(
  ownerId: string,
  status?: LoanRequestStatus | null
): Promise<RequestWithItemRow[]> {
  const rows = status
    ? await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.owner_id, o.organisation as owner_organisation
        from loan_requests r
        join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        where i.owner_id = ${ownerId} and r.status = ${status}
        order by r.created_at desc
      `
    : await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.owner_id, o.organisation as owner_organisation
        from loan_requests r
        join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        where i.owner_id = ${ownerId}
        order by r.created_at desc
      `;
  return rows.map(mapRequestWithItem);
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
       start_date, end_date, quantity, notes, status, admin_note, created_at, reviewed_at, terms_accepted, terms_version, bad_hire)
    values
      (${loanRequest.id}, ${loanRequest.itemId}, ${loanRequest.userId}, ${loanRequest.requesterName},
       ${loanRequest.requesterEmail}, ${loanRequest.requesterOrganisation}, ${loanRequest.requesterPhone},
       ${loanRequest.startDate}, ${loanRequest.endDate}, ${loanRequest.quantity}, ${loanRequest.notes},
       ${loanRequest.status}, ${loanRequest.adminNote}, ${loanRequest.createdAt}, ${loanRequest.reviewedAt},
       ${loanRequest.termsAccepted}, ${loanRequest.termsVersion}, ${loanRequest.badHire})
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

/** Sets or clears the admin "bad hire" flag on a request, regardless of its status. */
export async function setBadHire(id: string, badHire: boolean): Promise<LoanRequest | null> {
  const rows = await sql`
    update loan_requests set bad_hire = ${badHire}
    where id = ${id}
    returning *
  `;
  return rows[0] ? mapRequest(rows[0]) : null;
}

// ---- feedback ----

export async function createFeedback(feedback: Feedback): Promise<Feedback> {
  await sql`
    insert into feedback (id, name, email, message, created_at)
    values (${feedback.id}, ${feedback.name}, ${feedback.email}, ${feedback.message}, ${feedback.createdAt})
  `;
  return feedback;
}

export async function getAllFeedback(): Promise<Feedback[]> {
  const rows = await sql`select * from feedback order by created_at desc`;
  return rows.map(mapFeedback);
}

// ---- notifications ----

export async function createNotification(notification: AppNotification): Promise<AppNotification> {
  await sql`
    insert into notifications (id, user_id, type, message, link, read, created_at)
    values (${notification.id}, ${notification.userId}, ${notification.type}, ${notification.message},
            ${notification.link}, ${notification.read}, ${notification.createdAt})
  `;
  return notification;
}

export async function getNotificationsForUser(userId: string): Promise<AppNotification[]> {
  const rows = await sql`
    select * from notifications where user_id = ${userId} order by created_at desc limit 30
  `;
  return rows.map(mapNotification);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await sql`
    select count(*)::int as count from notifications where user_id = ${userId} and read = false
  `;
  return (rows[0]?.count as number) ?? 0;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await sql`update notifications set read = true where id = ${id} and user_id = ${userId}`;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await sql`update notifications set read = true where user_id = ${userId} and read = false`;
}

// ---- reviews ----

export async function createReview(review: Review): Promise<Review> {
  await sql`
    insert into reviews (id, request_id, item_id, user_id, rating, comment, created_at)
    values (${review.id}, ${review.requestId}, ${review.itemId}, ${review.userId}, ${review.rating}, ${review.comment}, ${review.createdAt})
  `;
  return review;
}

export async function getReviewsForItem(itemId: string): Promise<(Review & { reviewerName: string })[]> {
  const rows = await sql`
    select rv.*, u.name as reviewer_name
    from reviews rv
    join users u on u.id = rv.user_id
    where rv.item_id = ${itemId}
    order by rv.created_at desc
  `;
  return rows.map((row) => ({ ...mapReview(row), reviewerName: row.reviewer_name as string }));
}

export async function getReviewSummaryForItem(itemId: string): Promise<{ average: number; count: number }> {
  const rows = await sql`
    select avg(rating)::float as average, count(*)::int as count from reviews where item_id = ${itemId}
  `;
  return {
    average: (rows[0]?.average as number) ?? 0,
    count: (rows[0]?.count as number) ?? 0,
  };
}

export async function getReviewedRequestIds(userId: string): Promise<Set<string>> {
  const rows = await sql`select request_id from reviews where user_id = ${userId}`;
  return new Set(rows.map((row) => row.request_id as string));
}
