import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import type {
  AppNotification,
  BlackoutPeriod,
  Booking,
  BookingPayment,
  BookingPaymentStatus,
  Category,
  EquipmentCondition,
  EquipmentItem,
  Feedback,
  LoanRequest,
  LoanRequestStatus,
  NotificationType,
  OrgStatus,
  Review,
  RequestStatusHistory,
  User,
} from "@/lib/types";
import type { AvailabilityBooking } from "@/lib/availability";
import type {
  BookingFulfillmentHistoryEvent,
  BookingFulfillmentEventType,
  BookingFulfillmentStatus,
} from "@/lib/fulfillment";
import { depositChargeIdempotencyKey } from "@/lib/payment-idempotency";
import { calculateHireFeeCents, shouldCollectDeposit } from "@/lib/booking-payment";
import {
  omitOrganizationRequestPaymentData,
} from "@/lib/organization-request";

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
    transactionType: row.transaction_type as EquipmentItem["transactionType"],
    hireFee: row.hire_fee as number,
    condition: row.equipment_condition as EquipmentItem["condition"],
    conditionNotes: (row.condition_notes as string) ?? "",
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
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripePaymentMethodId: (row.stripe_payment_method_id as string | null) ?? null,
    depositChargeStatus: row.deposit_charge_status as LoanRequest["depositChargeStatus"],
    depositChargedAt: (row.deposit_charged_at as string | null) ?? null,
    bookingPayments: [],
  };
}

function mapStatusHistory(row: Row): RequestStatusHistory {
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    fromStatus: (row.from_status as LoanRequestStatus | null) ?? null,
    toStatus: row.to_status as LoanRequestStatus,
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorName: (row.actor_name as string | null) ?? null,
    reason: row.reason as string,
    createdAt: row.created_at as string,
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
      (id, name, category, description, images, total_quantity, transaction_type, hire_fee, equipment_condition, condition_notes,
       deposit_required, booking_conditions, cancellation_rules, retired, owner_id, pickup_notes, dropoff_notes)
    values
      (${item.id}, ${item.name}, ${item.category}, ${item.description}, ${item.images},
       ${item.totalQuantity}, ${item.transactionType}, ${item.hireFee}, ${item.condition}, ${item.conditionNotes},
       ${item.depositRequired}, ${item.bookingConditions}, ${item.cancellationRules}, ${item.retired}, ${item.ownerId},
       ${item.pickupNotes}, ${item.dropoffNotes})
    returning *
  `;
  return mapItem(rows[0]);
}

export async function updateItem(
  id: string,
  patch: Partial<Omit<EquipmentItem, "id">>
): Promise<{ item: EquipmentItem | null; quantityConflict: boolean }> {
  const existing = await getItemById(id, { includeRetired: true });
  if (!existing) return { item: null, quantityConflict: false };

  const merged = { ...existing, ...patch };
  const [lockedRows, updatedRows] = await sql.transaction([
    sql`
      select id
      from equipment_items
      where id = ${id}
      for update
    `,
    sql`
      with candidate_days as (
        select booking.start_date::date as day
        from bookings booking
        where booking.item_id = ${id}
        union
        select booking.end_date::date
        from bookings booking
        where booking.item_id = ${id}
        union
        select booking.end_date::date + 1
        from bookings booking
        where booking.item_id = ${id}
        union
        select left(event.occurred_at, 10)::date
        from booking_fulfillment_events event
        join bookings booking on booking.id = event.booking_id
        where booking.item_id = ${id}
          and event.event_type in ('collection_confirmed', 'return_inspected')
        union
        select left(event.occurred_at, 10)::date + 1
        from booking_fulfillment_events event
        join bookings booking on booking.id = event.booking_id
        where booking.item_id = ${id}
          and event.event_type in ('collection_confirmed', 'return_inspected')
      ),
      daily_commitments as (
        select
          candidate.day,
          coalesce(sum(
            case
              when booking.fulfillment_status = 'donation_completed' then 0
              else
                case
                  when booking.status = 'approved'
                    and candidate.day between booking.start_date::date and booking.end_date::date
                    then greatest(0, booking.quantity - events.collected_by_day)
                  else 0
                end
                + greatest(0, events.collected_by_day - events.returned_before_day)
                + case
                    when booking.status = 'approved'
                      and candidate.day > booking.end_date::date
                      and (
                        booking.fulfillment_status = 'legacy_unknown'
                        or (
                          booking.fulfillment_status in ('collected', 'returned')
                          and events.total_collected = 0
                        )
                      )
                      then greatest(0, booking.quantity - events.total_collected)
                    else 0
                  end
            end
          ), 0) as committed
        from candidate_days candidate
        left join bookings booking on booking.item_id = ${id}
        left join lateral (
          select
            coalesce(sum(quantity) filter (
              where event_type = 'collection_confirmed'
                and left(occurred_at, 10)::date <= candidate.day
            ), 0) as collected_by_day,
            coalesce(sum(quantity) filter (
              where event_type = 'return_inspected'
                and left(occurred_at, 10)::date < candidate.day
            ), 0) as returned_before_day,
            coalesce(sum(quantity) filter (
              where event_type = 'collection_confirmed'
            ), 0) as total_collected
          from booking_fulfillment_events
          where booking_id = booking.id
        ) events on booking.id is not null
        group by candidate.day
      ),
      capacity_guard as (
        select 1 as allowed
        where not ${patch.totalQuantity !== undefined}
          or not exists (
            select 1
            from daily_commitments
            where committed > ${merged.totalQuantity}
          )
      )
      update equipment_items set
        name = case when ${patch.name !== undefined} then ${merged.name} else name end,
        category = case when ${patch.category !== undefined} then ${merged.category} else category end,
        description = case when ${patch.description !== undefined} then ${merged.description} else description end,
        images = case when ${patch.images !== undefined} then ${merged.images} else images end,
        total_quantity = case when ${patch.totalQuantity !== undefined} then ${merged.totalQuantity} else total_quantity end,
        transaction_type = case when ${patch.transactionType !== undefined} then ${merged.transactionType} else transaction_type end,
        hire_fee = case when ${patch.hireFee !== undefined} then ${merged.hireFee} else hire_fee end,
        equipment_condition = case when ${patch.condition !== undefined} then ${merged.condition} else equipment_condition end,
        condition_notes = case when ${patch.conditionNotes !== undefined} then ${merged.conditionNotes} else condition_notes end,
        deposit_required = case when ${patch.depositRequired !== undefined} then ${merged.depositRequired} else deposit_required end,
        booking_conditions = case when ${patch.bookingConditions !== undefined} then ${merged.bookingConditions} else booking_conditions end,
        cancellation_rules = case when ${patch.cancellationRules !== undefined} then ${merged.cancellationRules} else cancellation_rules end,
        retired = case when ${patch.retired !== undefined} then ${merged.retired} else retired end,
        pickup_notes = case when ${patch.pickupNotes !== undefined} then ${merged.pickupNotes} else pickup_notes end,
        dropoff_notes = case when ${patch.dropoffNotes !== undefined} then ${merged.dropoffNotes} else dropoff_notes end
      where id = ${id}
        and exists (select 1 from capacity_guard)
      returning *
    `,
  ], { isolationLevel: "ReadCommitted" });

  if (lockedRows.length === 0) return { item: null, quantityConflict: false };
  if (updatedRows.length === 0) return { item: null, quantityConflict: true };
  return { item: mapItem(updatedRows[0]), quantityConflict: false };
}

export interface BookingFulfillmentDetails {
  id: string;
  requestId: string;
  itemId: string;
  bookingStatus: Booking["status"];
  quantity: number;
  fulfillmentStatus: BookingFulfillmentStatus;
  transactionType: EquipmentItem["transactionType"];
  ownerId: string | null;
}

export async function getBookingFulfillmentDetails(
  bookingId: string
): Promise<BookingFulfillmentDetails | null> {
  const rows = await sql`
    select
      booking.id,
      booking.request_id,
      booking.item_id,
      booking.status as booking_status,
      booking.quantity,
      booking.fulfillment_status,
      item.transaction_type,
      item.owner_id
    from bookings booking
    join equipment_items item on item.id = booking.item_id
    where booking.id = ${bookingId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    itemId: row.item_id as string,
    bookingStatus: row.booking_status as Booking["status"],
    quantity: row.quantity as number,
    fulfillmentStatus: row.fulfillment_status as BookingFulfillmentStatus,
    transactionType: row.transaction_type as EquipmentItem["transactionType"],
    ownerId: (row.owner_id as string | null) ?? null,
  };
}

export async function recordBookingFulfillment(
  input: {
    bookingId: string;
    actorUserId: string;
    actorRole: "admin" | "org";
    eventType: BookingFulfillmentEventType;
    condition: EquipmentCondition;
    notes: string;
    evidenceRefs: string[];
    occurredAt: string;
  }
): Promise<boolean> {
  const [, rows] = await sql.transaction([
    sql`
      select item.id
      from bookings booking
      join equipment_items item on item.id = booking.item_id
      where booking.id = ${input.bookingId}
      for update of item, booking
    `,
    sql`
      with eligible_booking as (
        select
          booking.id,
          booking.item_id,
          booking.quantity,
          booking.fulfillment_status,
          item.transaction_type,
          item.owner_id
        from bookings booking
        join equipment_items item on item.id = booking.item_id
        where booking.id = ${input.bookingId}
          and booking.status = 'approved'
          and (
            ${input.actorRole === "admin"}
            or (${input.actorRole === "org"} and item.owner_id = ${input.actorUserId})
          )
          and (
            (
              ${input.eventType} = 'collection_confirmed'
              and item.transaction_type in ('paid_hire', 'temporary_free_loan')
              and booking.fulfillment_status = 'not_started'
              and not exists (
                select 1
                from booking_payments payment
                where payment.request_id = booking.request_id
                  and payment.status <> 'succeeded'
              )
            )
            or (
              ${input.eventType} = 'return_inspected'
              and item.transaction_type in ('paid_hire', 'temporary_free_loan')
              and booking.fulfillment_status = 'collected'
            )
            or (
              ${input.eventType} = 'donation_handover_confirmed'
              and item.transaction_type = 'permanent_donation'
              and booking.fulfillment_status = 'not_started'
            )
          )
        for update of booking, item
      ),
      remaining_candidate_days as (
          select booking.start_date::date as day
          from bookings booking
          join eligible_booking eligible on eligible.item_id = booking.item_id
          where booking.id <> eligible.id
          union
          select booking.end_date::date
          from bookings booking
          join eligible_booking eligible on eligible.item_id = booking.item_id
          where booking.id <> eligible.id
          union
          select booking.end_date::date + 1
          from bookings booking
          join eligible_booking eligible on eligible.item_id = booking.item_id
          where booking.id <> eligible.id
          union
          select left(event.occurred_at, 10)::date
          from booking_fulfillment_events event
          join bookings booking on booking.id = event.booking_id
          join eligible_booking eligible on eligible.item_id = booking.item_id
          where booking.id <> eligible.id
            and event.event_type in ('collection_confirmed', 'return_inspected')
          union
          select left(event.occurred_at, 10)::date + 1
          from booking_fulfillment_events event
          join bookings booking on booking.id = event.booking_id
          join eligible_booking eligible on eligible.item_id = booking.item_id
          where booking.id <> eligible.id
            and event.event_type in ('collection_confirmed', 'return_inspected')
      ),
      remaining_daily_commitments as (
          select
            candidate.day,
            coalesce(sum(
              case
                when booking.fulfillment_status = 'donation_completed' then 0
                else
                  case
                    when booking.status = 'approved'
                      and candidate.day between booking.start_date::date and booking.end_date::date
                      then greatest(0, booking.quantity - events.collected_by_day)
                    else 0
                  end
                  + greatest(0, events.collected_by_day - events.returned_before_day)
                  + case
                      when booking.status = 'approved'
                        and candidate.day > booking.end_date::date
                        and (
                          booking.fulfillment_status = 'legacy_unknown'
                          or (
                            booking.fulfillment_status in ('collected', 'returned')
                            and events.total_collected = 0
                          )
                        )
                        then greatest(0, booking.quantity - events.total_collected)
                      else 0
                    end
              end
            ), 0) as committed
          from remaining_candidate_days candidate
          join eligible_booking eligible on true
          left join bookings booking
            on booking.item_id = eligible.item_id
            and booking.id <> eligible.id
          left join lateral (
            select
              coalesce(sum(quantity) filter (
                where event_type = 'collection_confirmed'
                  and left(occurred_at, 10)::date <= candidate.day
              ), 0) as collected_by_day,
              coalesce(sum(quantity) filter (
                where event_type = 'return_inspected'
                  and left(occurred_at, 10)::date < candidate.day
              ), 0) as returned_before_day,
              coalesce(sum(quantity) filter (
                where event_type = 'collection_confirmed'
              ), 0) as total_collected
            from booking_fulfillment_events
            where booking_id = booking.id
          ) events on booking.id is not null
          group by candidate.day
      ),
      inventory_update as (
          update equipment_items item
          set total_quantity = item.total_quantity - eligible.quantity
        from eligible_booking eligible
        where item.id = eligible.item_id
          and ${input.eventType} = 'donation_handover_confirmed'
          and item.total_quantity >= eligible.quantity
          and item.total_quantity - eligible.quantity >= (
            select coalesce(max(committed), 0)
            from remaining_daily_commitments
          )
        returning item.id
      ),
      updated_booking as (
        update bookings booking
        set fulfillment_status = case
          when ${input.eventType} = 'collection_confirmed' then 'collected'
          when ${input.eventType} = 'return_inspected' then 'returned'
          else 'donation_completed'
        end
        from eligible_booking eligible
        where booking.id = eligible.id
          and (
            ${input.eventType} <> 'donation_handover_confirmed'
            or exists (select 1 from inventory_update)
          )
        returning booking.id, booking.quantity
      ),
      inserted_event as (
        insert into booking_fulfillment_events
          (id, booking_id, event_type, actor_user_id, occurred_at, quantity, condition, notes, evidence_refs)
        select
          ${randomUUID()},
          updated_booking.id,
          ${input.eventType},
          ${input.actorUserId},
          ${input.occurredAt},
          updated_booking.quantity,
          ${input.condition},
          ${input.notes},
          ${input.evidenceRefs}
        from updated_booking
        returning booking_id
      )
      select booking_id from inserted_event
    `,
  ], { isolationLevel: "ReadCommitted" });
  return rows.length > 0;
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
  const rows = await sql`
    select * from bookings
    where item_id = ${itemId} and status != 'cancelled'
  `;
  return rows.map(mapBooking);
}

export async function getAvailabilityBookingsForItem(
  itemId: string
): Promise<AvailabilityBooking[]> {
  const rows = await sql`
    select
      booking.id as booking_id,
      booking.start_date,
      booking.end_date,
      booking.quantity,
      booking.status,
      booking.fulfillment_status,
      event.event_type,
      event.occurred_at,
      event.quantity as event_quantity
    from bookings booking
    left join booking_fulfillment_events event
      on event.booking_id = booking.id
      and event.event_type in ('collection_confirmed', 'return_inspected')
    where booking.item_id = ${itemId}
    order by booking.id, event.occurred_at
  `;

  const bookings = new Map<string, AvailabilityBooking>();
  for (const row of rows) {
    const id = row.booking_id as string;
    let booking = bookings.get(id);
    if (!booking) {
      booking = {
        id,
        startDate: row.start_date as string,
        endDate: row.end_date as string,
        quantity: row.quantity as number,
        status: row.status as AvailabilityBooking["status"],
        fulfillmentStatus: row.fulfillment_status as AvailabilityBooking["fulfillmentStatus"],
        fulfillmentEvents: [],
      };
      bookings.set(id, booking);
    }
    if (row.event_type) {
      booking.fulfillmentEvents.push({
        eventType: row.event_type as AvailabilityBooking["fulfillmentEvents"][number]["eventType"],
        occurredAt: row.occurred_at as string,
        quantity: row.event_quantity as number,
      });
    }
  }

  return [...bookings.values()];
}

export async function createBooking(booking: Booking): Promise<Booking> {
  await sql`
    insert into bookings (id, item_id, request_id, start_date, end_date, quantity, status)
    values (${booking.id}, ${booking.itemId}, ${booking.requestId}, ${booking.startDate}, ${booking.endDate}, ${booking.quantity}, ${booking.status})
  `;
  return booking;
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
  itemDepositRequired: number;
  ownerId: string | null;
  ownerOrganisation: string | null;
  bookingId: string | null;
  bookingStatus: Booking["status"] | null;
  fulfillmentStatus: BookingFulfillmentStatus | null;
  transactionType: EquipmentItem["transactionType"] | null;
};

type RequestWithItem = RequestWithItemRow & { statusHistory: RequestStatusHistory[] };
type OrganizationRequestWithItem = Omit<
  RequestWithItem,
  "stripeCustomerId" | "stripePaymentMethodId" | "bookingPayments"
>;

async function addStatusHistory<T extends { id: string }>(
  requests: T[]
): Promise<(T & { statusHistory: RequestStatusHistory[] })[]> {
  if (requests.length === 0) return [];

  const rows = await sql`
    select h.*, u.name as actor_name
    from request_status_history h
    left join users u on u.id = h.actor_user_id
    where h.request_id = any(${requests.map((request) => request.id)})
    order by h.created_at asc, h.id asc
  `;
  const historyByRequest = new Map<string, RequestStatusHistory[]>();
  for (const row of rows) {
    const history = mapStatusHistory(row);
    const current = historyByRequest.get(history.requestId) ?? [];
    current.push(history);
    historyByRequest.set(history.requestId, current);
  }

  return requests.map((request) => ({
    ...request,
    statusHistory: historyByRequest.get(request.id) ?? [],
  }));
}

async function addFulfillmentEvents<
  T extends { bookingId: string | null }
>(
  requests: T[]
): Promise<(T & { fulfillmentStatus: BookingFulfillmentStatus | null; fulfillmentEvents: BookingFulfillmentHistoryEvent[] })[]> {
  const bookingIds = requests
    .map((request) => request.bookingId)
    .filter((bookingId): bookingId is string => bookingId !== null);
  if (bookingIds.length === 0) {
    return requests.map((request) => ({
      ...request,
      fulfillmentStatus: null,
      fulfillmentEvents: [],
    }));
  }

  const rows = await sql`
    select
      booking.id as booking_id,
      booking.fulfillment_status,
      event.id as event_id,
      event.event_type,
      event.actor_user_id,
      actor.name as actor_name,
      event.occurred_at,
      event.quantity,
      event.condition,
      event.notes,
      event.evidence_refs
    from bookings booking
    left join booking_fulfillment_events event on event.booking_id = booking.id
    left join users actor on actor.id = event.actor_user_id
    where booking.id = any(${bookingIds})
    order by event.occurred_at asc, event.id asc
  `;
  const statusByBooking = new Map<string, BookingFulfillmentStatus>();
  const eventsByBooking = new Map<string, BookingFulfillmentHistoryEvent[]>();
  for (const row of rows) {
    const bookingId = row.booking_id as string;
    statusByBooking.set(
      bookingId,
      row.fulfillment_status as BookingFulfillmentStatus
    );
    if (row.event_id === null) continue;

    const event: BookingFulfillmentHistoryEvent = {
      id: row.event_id as string,
      eventType: row.event_type as BookingFulfillmentEventType,
      actorName: (row.actor_name as string | null) ?? null,
      occurredAt: row.occurred_at as string,
      quantity: row.quantity as number,
      condition: row.condition as EquipmentCondition,
      notes: row.notes as string,
      evidenceRefs: (row.evidence_refs as string[]) ?? [],
    };
    const bookingEvents = eventsByBooking.get(bookingId) ?? [];
    bookingEvents.push(event);
    eventsByBooking.set(bookingId, bookingEvents);
  }

  return requests.map((request) => ({
    ...request,
    fulfillmentStatus: request.bookingId
      ? statusByBooking.get(request.bookingId) ?? null
      : null,
    fulfillmentEvents: request.bookingId
      ? eventsByBooking.get(request.bookingId) ?? []
      : [],
  }));
}

function mapRequestWithItem(row: Row): RequestWithItemRow {
  return {
    ...mapRequest(row),
    itemName: row.item_name as string,
    itemDepositRequired: (row.item_deposit_required as number) ?? 0,
    ownerId: (row.owner_id as string | null) ?? null,
    ownerOrganisation: (row.owner_organisation as string | null) ?? null,
    bookingId: (row.booking_id as string | null) ?? null,
    bookingStatus: (row.booking_status as Booking["status"] | null) ?? null,
    fulfillmentStatus: (row.fulfillment_status as BookingFulfillmentStatus | null) ?? null,
    transactionType: (row.transaction_type as EquipmentItem["transactionType"] | null) ?? null,
  };
}

export async function getRequestsWithItemNames(
  status?: LoanRequestStatus | null
): Promise<RequestWithItem[]> {
  const rows = status
    ? await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.deposit_required as item_deposit_required, i.owner_id, o.organisation as owner_organisation,
          b.id as booking_id, b.status as booking_status, b.fulfillment_status, i.transaction_type
        from loan_requests r
        left join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        left join bookings b on b.request_id = r.id
        where r.status = ${status}
        order by r.created_at desc
      `
    : await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.deposit_required as item_deposit_required, i.owner_id, o.organisation as owner_organisation,
          b.id as booking_id, b.status as booking_status, b.fulfillment_status, i.transaction_type
        from loan_requests r
        left join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        left join bookings b on b.request_id = r.id
        order by r.created_at desc
      `;
  const withHistory = await addStatusHistory(rows.map(mapRequestWithItem));
  return attachBookingPayments(withHistory);
}

/** Requests for items owned by a specific organisation account. */
export async function getRequestsForOwner(
  ownerId: string,
  status?: LoanRequestStatus | null
): Promise<OrganizationRequestWithItem[]> {
  const rows = status
    ? await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.deposit_required as item_deposit_required, i.owner_id, o.organisation as owner_organisation,
          b.id as booking_id, b.status as booking_status, b.fulfillment_status, i.transaction_type
        from loan_requests r
        join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        left join bookings b on b.request_id = r.id
        where i.owner_id = ${ownerId} and r.status = ${status}
        order by r.created_at desc
      `
    : await sql`
        select r.*, coalesce(i.name, 'Unknown item') as item_name, i.deposit_required as item_deposit_required, i.owner_id, o.organisation as owner_organisation,
          b.id as booking_id, b.status as booking_status, b.fulfillment_status, i.transaction_type
        from loan_requests r
        join equipment_items i on i.id = r.item_id
        left join users o on o.id = i.owner_id
        left join bookings b on b.request_id = r.id
        where i.owner_id = ${ownerId}
        order by r.created_at desc
      `;
  const withHistory = await addStatusHistory(rows.map(mapRequestWithItem));
  return withHistory.map(omitOrganizationRequestPaymentData);
}

export async function getRequestsForUser(
  userId: string
): Promise<
  (LoanRequest & {
    itemName: string;
    itemDepositRequired: number;
    bookingId: string | null;
    statusHistory: RequestStatusHistory[];
    fulfillmentStatus: BookingFulfillmentStatus | null;
    fulfillmentEvents: BookingFulfillmentHistoryEvent[];
  })[]
> {
  const rows = await sql`
    select
      r.*,
      coalesce(i.name, 'Unknown item') as item_name,
      coalesce(i.deposit_required, 0) as item_deposit_required,
      booking.id as booking_id
    from loan_requests r
    left join equipment_items i on i.id = r.item_id
    left join bookings booking on booking.request_id = r.id
    where r.user_id = ${userId}
    order by r.created_at desc
  `;
  const requests = rows.map((row) => ({
    ...mapRequest(row),
    itemName: row.item_name as string,
    itemDepositRequired: row.item_deposit_required as number,
    bookingId: (row.booking_id as string | null) ?? null,
  }));
  const withStatusHistory = await addStatusHistory(requests);
  const withFulfillment = await addFulfillmentEvents(withStatusHistory);
  return attachBookingPayments(withFulfillment);
}

export async function getRequestById(id: string): Promise<LoanRequest | null> {
  const rows = await sql`select * from loan_requests where id = ${id}`;
  return rows[0] ? mapRequest(rows[0]) : null;
}

function mapBookingPayment(row: Row): BookingPayment {
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    kind: row.payment_kind as BookingPayment["kind"],
    amountCents: Number(row.amount_cents),
    currency: "aud",
    status: row.status as BookingPaymentStatus,
    stripePaymentIntentId: (row.stripe_payment_intent_id as string | null) ?? null,
    stripeRefundId: (row.stripe_refund_id as string | null) ?? null,
    chargedAt: (row.charged_at as string | null) ?? null,
    refundedAt: (row.refunded_at as string | null) ?? null,
    failureMessage: (row.failure_message as string | null) ?? null,
  };
}

export interface BookingPaymentAttempt {
  id: string;
  paymentId: string;
  operation: "charge" | "refund";
  idempotencyKey: string;
  stripeObjectId: string | null;
  createdAt: string;
}

export async function getBookingPaymentsForRequest(requestId: string): Promise<BookingPayment[]> {
  const rows = await sql`
    select * from booking_payments where request_id = ${requestId} order by payment_kind
  `;
  return rows.map(mapBookingPayment);
}

export async function hasUnsettledBookingPayments(requestId: string): Promise<boolean> {
  const rows = await sql`
    select id from booking_payments
    where request_id = ${requestId} and status <> 'succeeded'
    limit 1
  `;
  return rows.length > 0;
}

async function attachBookingPayments<T extends { id: string }>(
  requests: T[]
): Promise<(T & { bookingPayments: BookingPayment[] })[]> {
  return Promise.all(requests.map(async (request) => ({
    ...request,
    bookingPayments: await getBookingPaymentsForRequest(request.id),
  })));
}

/** Snapshots the approved booking's fee and deposit once, so listing edits cannot alter its price. */
export async function ensureBookingPayments(requestId: string): Promise<BookingPayment[]> {
  const request = await getRequestById(requestId);
  if (!request || request.status !== "approved") return [];
  const item = await getItemById(request.itemId, { includeRetired: true });
  if (!item) throw new Error(`Cannot prepare payment for missing item on request ${requestId}.`);

  const charges: { kind: BookingPayment["kind"]; amountCents: number }[] = [];
  if (item.transactionType === "paid_hire" && item.hireFee > 0) {
    charges.push({
      kind: "hire_fee",
      amountCents: calculateHireFeeCents(
        item.hireFee,
        request.startDate,
        request.endDate,
        request.quantity
      ),
    });
  }
  if (shouldCollectDeposit(item.transactionType) && item.depositRequired > 0) {
    charges.push({ kind: "deposit", amountCents: item.depositRequired * 100 });
  }
  if (charges.some((charge) => !Number.isSafeInteger(charge.amountCents) || charge.amountCents > 2_147_483_647)) {
    throw new RangeError("A booking payment exceeds the supported amount.");
  }
  if (charges.length === 0) return [];

  const now = new Date().toISOString();
  await sql.transaction(charges.map((charge) => sql`
    insert into booking_payments
      (id, request_id, payment_kind, amount_cents, currency, status, created_at, updated_at)
    values
      (${randomUUID()}, ${requestId}, ${charge.kind}, ${charge.amountCents}, 'aud',
       ${request.stripePaymentMethodId ? "pending" : "awaiting_payment_method"}, ${now}, ${now})
    on conflict (request_id, payment_kind) do nothing
  `));
  return getBookingPaymentsForRequest(requestId);
}

export async function getBookingPaymentById(paymentId: string): Promise<BookingPayment | null> {
  const rows = await sql`select * from booking_payments where id = ${paymentId}`;
  return rows[0] ? mapBookingPayment(rows[0]) : null;
}

/** Creates or resumes one persisted operation; active/uncertain operations retain their key. */
export async function beginBookingPaymentAttempt(
  paymentId: string,
  operation: "charge" | "refund"
): Promise<BookingPaymentAttempt | null> {
  const attemptId = randomUUID();
  const key = `booking-payment-${operation}-${attemptId}`;
  const createdAt = new Date().toISOString();
  const [, rows] = await sql.transaction([
    sql`select id from booking_payments where id = ${paymentId} for update`,
    sql`
      with eligible as (
        select id, status
        from booking_payments
        where id = ${paymentId}
          and (
            (${operation} = 'charge' and status in ('pending', 'failed', 'processing'))
            or             (${operation} = 'refund' and status in ('succeeded', 'refund_failed', 'refund_pending', 'manual_review'))
          )
        for update
      ), active as (
        select attempt.*
        from booking_payment_attempts attempt
        join eligible on eligible.id = attempt.payment_id
        where attempt.operation = ${operation}
          and attempt.status in ('in_progress', 'uncertain')
      ), inserted as (
        insert into booking_payment_attempts
          (id, payment_id, operation, stripe_idempotency_key, status, created_at)
        select ${attemptId}, eligible.id, ${operation}, ${key}, 'in_progress', ${createdAt}
        from eligible
        where (
          (${operation} = 'charge' and eligible.status in ('pending', 'failed'))
          or (${operation} = 'refund' and eligible.status in ('succeeded', 'refund_failed', 'manual_review'))
        )
          and not exists (select 1 from active)
        returning id, payment_id, operation, stripe_idempotency_key, stripe_object_id, created_at
      ), changed_payment as (
        update booking_payments payment
        set status = ${operation === "charge" ? "processing" : "refund_pending"},
            failure_message = null,
            updated_at = ${createdAt}
        where payment.id = ${paymentId}
          and exists (select 1 from inserted)
        returning payment.id
      )
      select
        inserted.id, inserted.payment_id, inserted.operation,
        inserted.stripe_idempotency_key, inserted.stripe_object_id, inserted.created_at
      from inserted
      union all
      select
        active.id, active.payment_id, active.operation,
        active.stripe_idempotency_key, active.stripe_object_id, active.created_at
      from active
      limit 1
    `,
  ]);
  const row = rows[0];
  return row ? {
    id: row.id as string,
    paymentId: row.payment_id as string,
    operation: row.operation as "charge" | "refund",
    idempotencyKey: row.stripe_idempotency_key as string,
    stripeObjectId: (row.stripe_object_id as string | null) ?? null,
    createdAt: row.created_at as string,
  } : null;
}

export async function recordBookingPaymentStripeObject(
  attemptId: string,
  stripeObjectId: string
): Promise<boolean> {
  const rows = await sql`
    with updated_attempt as (
      update booking_payment_attempts
      set stripe_object_id = ${stripeObjectId}
      where id = ${attemptId}
        and status in ('in_progress', 'uncertain')
        and (stripe_object_id is null or stripe_object_id = ${stripeObjectId})
      returning payment_id, operation
    )
    update booking_payments payment
    set stripe_payment_intent_id = case
        when updated.operation = 'charge' and payment.status = 'processing' then ${stripeObjectId}
        else payment.stripe_payment_intent_id
      end,
      stripe_refund_id = case
        when updated.operation = 'refund' and payment.status = 'refund_pending' then ${stripeObjectId}
        else payment.stripe_refund_id
      end,
      updated_at = ${new Date().toISOString()}
    from updated_attempt updated
    where payment.id = updated.payment_id
    and (
      (updated.operation = 'charge' and payment.status = 'processing')
      or (updated.operation = 'refund' and payment.status = 'refund_pending')
    )
    returning payment.id
  `;
  if (rows.length > 0) return true;
  const existing = await sql`
    select stripe_object_id from booking_payment_attempts where id = ${attemptId}
  `;
  return existing[0]?.stripe_object_id === stripeObjectId;
}

export async function finishBookingPaymentAttempt(
  attemptId: string,
  outcome: "succeeded" | "failed" | "uncertain",
  message: string | null = null
): Promise<boolean> {
  const completedAt = outcome === "uncertain" ? null : new Date().toISOString();
  const rows = await sql`
    with updated_attempt as (
      update booking_payment_attempts
      set status = ${outcome},
          completed_at = ${completedAt},
          error_message = ${message}
      where id = ${attemptId}
        and status in ('in_progress', 'uncertain')
      returning payment_id, operation
    )
    update booking_payments payment
    set status = case
          when updated.operation = 'charge' and ${outcome} = 'succeeded' then 'succeeded'
          when updated.operation = 'charge' and ${outcome} = 'failed' then 'failed'
          when updated.operation = 'charge' then 'processing'
          when updated.operation = 'refund' and ${outcome} = 'succeeded' then 'refunded'
          when updated.operation = 'refund' and ${outcome} = 'failed' then 'refund_failed'
          else 'refund_pending'
        end,
        charged_at = case
          when updated.operation = 'charge' and ${outcome} = 'succeeded'
            then coalesce(payment.charged_at, ${completedAt})
          else payment.charged_at
        end,
        refunded_at = case
          when updated.operation = 'refund' and ${outcome} = 'succeeded'
            then coalesce(payment.refunded_at, ${completedAt})
          else payment.refunded_at
        end,
        failure_message = ${message},
        updated_at = ${new Date().toISOString()}
    from updated_attempt updated
    where payment.id = updated.payment_id
    returning payment.id
  `;
  return rows.length > 0;
}

export async function setBookingPaymentsPending(requestId: string): Promise<void> {
  await sql`
    update booking_payments
    set status = 'pending', updated_at = ${new Date().toISOString()}
    where request_id = ${requestId} and status = 'awaiting_payment_method'
  `;
}

export async function updateBookingPaymentFromIntent(
  paymentIntentId: string,
  paymentIntentStatus: string,
  bookingPaymentId?: string
): Promise<{ requestId: string; status: BookingPaymentStatus } | null> {
  const status = paymentIntentStatus === "succeeded"
    ? "succeeded"
    : ["requires_payment_method", "requires_action", "canceled"].includes(paymentIntentStatus)
      ? "failed"
      : "processing";
  const now = new Date().toISOString();
  const rows = await sql`
    with changed as (
      update booking_payments
      set status = case
            when status in ('refunded', 'refund_pending', 'refund_failed') then status
            else ${status}
          end,
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, ${paymentIntentId}),
          charged_at = case when ${status} = 'succeeded' then coalesce(charged_at, ${now}) else charged_at end,
          updated_at = ${now}
      where stripe_payment_intent_id = ${paymentIntentId}
        or (
          ${bookingPaymentId ?? null}::text is not null
          and id = ${bookingPaymentId ?? null}
          and (stripe_payment_intent_id is null or stripe_payment_intent_id = ${paymentIntentId})
        )
      returning id, request_id, status
    )
    update booking_payment_attempts attempt
    set status = case when ${status} = 'succeeded' then 'succeeded' else 'failed' end,
        completed_at = ${now},
        stripe_object_id = coalesce(attempt.stripe_object_id, ${paymentIntentId})
    from changed
    where attempt.payment_id = changed.id
      and attempt.operation = 'charge'
      and attempt.status in ('in_progress', 'uncertain')
    returning changed.request_id, changed.status
  `;
  if (rows[0]) return {
    requestId: rows[0].request_id as string,
    status: rows[0].status as BookingPaymentStatus,
  };
  const existing = await sql`
    select request_id, status from booking_payments where stripe_payment_intent_id = ${paymentIntentId}
  `;
  return existing[0] ? {
    requestId: existing[0].request_id as string,
    status: existing[0].status as BookingPaymentStatus,
  } : null;
}

export async function updateBookingPaymentFromRefund(
  refundId: string,
  refundStatus: string
): Promise<void> {
  const status = refundStatus === "succeeded" ? "refunded" : refundStatus === "failed" || refundStatus === "canceled"
    ? "refund_failed"
    : "refund_pending";
  const now = new Date().toISOString();
  await sql`
    with changed as (
      update booking_payments
      set status = case when status = 'refunded' then 'refunded' else ${status} end,
          refunded_at = case
            when status = 'refunded' or ${status} = 'refunded' then coalesce(refunded_at, ${now})
            else refunded_at
          end,
          updated_at = ${now}
      where stripe_refund_id = ${refundId}
      returning id, status
    )
    update booking_payment_attempts attempt
    set status = case when changed.status = 'refunded' then 'succeeded'
                      when changed.status = 'refund_failed' then 'failed'
                      else 'uncertain' end,
        completed_at = case when changed.status = 'refund_pending' then null else ${now} end
    from changed
    where attempt.payment_id = changed.id
      and attempt.operation = 'refund'
      and attempt.stripe_object_id = ${refundId}
      and attempt.status in ('in_progress', 'uncertain')
  `;
}

export async function getBookingPaymentByStripeIntent(
  paymentIntentId: string
): Promise<BookingPayment | null> {
  const rows = await sql`
    select * from booking_payments where stripe_payment_intent_id = ${paymentIntentId}
  `;
  return rows[0] ? mapBookingPayment(rows[0]) : null;
}

export async function markBookingPaymentManualReview(
  paymentId: string,
  message: string
): Promise<void> {
  await sql`
    update booking_payments
    set status = 'manual_review', failure_message = ${message}, updated_at = ${new Date().toISOString()}
    where id = ${paymentId} and status in ('processing', 'refund_pending')
  `;
}

export async function markDepositForManualReview(
  requestId: string,
  message: string
): Promise<void> {
  await sql`
    update booking_payments
    set status = 'manual_review',
        failure_message = ${message},
        updated_at = ${new Date().toISOString()}
    where request_id = ${requestId}
      and payment_kind = 'deposit'
      and status = 'succeeded'
  `;
}

export async function getBookingFulfillmentStatusForRequest(
  requestId: string
): Promise<BookingFulfillmentStatus | null> {
  const rows = await sql`
    select fulfillment_status
    from bookings
    where request_id = ${requestId}
    limit 1
  `;
  return (rows[0]?.fulfillment_status as BookingFulfillmentStatus | undefined) ?? null;
}

export async function createRequestWithBooking(
  loanRequest: LoanRequest,
  booking: Booking
): Promise<boolean> {
  const [, insertedRows] = await sql.transaction([
    sql`
      select id
      from equipment_items
      where id = ${loanRequest.itemId}
      for update
    `,
    sql`
      with item_capacity as (
        select total_quantity
        from equipment_items
        where id = ${loanRequest.itemId}
      ),
      candidate_days as (
        select generate_series(
          ${loanRequest.startDate}::date,
          ${loanRequest.endDate}::date,
          interval '1 day'
        )::date as day
      ),
      daily_reservations as (
        select
          candidate.day,
          coalesce(sum(
            case
              when booking.fulfillment_status = 'donation_completed' then 0
              else
                case
                  when booking.status = 'approved'
                    and candidate.day between booking.start_date::date and booking.end_date::date
                    then greatest(0, booking.quantity - events.collected_by_day)
                  else 0
                end
                + greatest(0, events.collected_by_day - events.returned_before_day)
                + case
                    when booking.status = 'approved'
                      and candidate.day > booking.end_date::date
                      and (
                        booking.fulfillment_status = 'legacy_unknown'
                        or (
                          booking.fulfillment_status in ('collected', 'returned')
                          and events.total_collected = 0
                        )
                      )
                      then greatest(0, booking.quantity - events.total_collected)
                    else 0
                  end
            end
          ), 0) as reserved
        from candidate_days candidate
        left join bookings booking
          on booking.item_id = ${loanRequest.itemId}
        left join lateral (
          select
            coalesce(sum(quantity) filter (
              where event_type = 'collection_confirmed'
                and left(occurred_at, 10)::date <= candidate.day
            ), 0) as collected_by_day,
            coalesce(sum(quantity) filter (
              where event_type = 'return_inspected'
                and left(occurred_at, 10)::date < candidate.day
            ), 0) as returned_before_day,
            coalesce(sum(quantity) filter (
              where event_type = 'collection_confirmed'
            ), 0) as total_collected
          from booking_fulfillment_events
          where booking_id = booking.id
        ) events on booking.id is not null
        group by candidate.day
      ),
      availability_guard as (
        select 1
        from item_capacity capacity
        where not exists (
          select 1
          from daily_reservations
          where capacity.total_quantity - reserved < ${booking.quantity}
        )
          and not exists (
            select 1
            from blackout_periods blackout
            where blackout.item_id = ${loanRequest.itemId}
              and blackout.start_date::date <= ${loanRequest.endDate}::date
              and blackout.end_date::date >= ${loanRequest.startDate}::date
          )
      ),
      created_request as (
        insert into loan_requests
          (id, item_id, user_id, requester_name, requester_email, requester_organisation, requester_phone,
           start_date, end_date, quantity, notes, status, admin_note, created_at, reviewed_at, terms_accepted, terms_version, bad_hire)
        select
          ${loanRequest.id}, ${loanRequest.itemId}, ${loanRequest.userId}, ${loanRequest.requesterName},
          ${loanRequest.requesterEmail}, ${loanRequest.requesterOrganisation}, ${loanRequest.requesterPhone},
          ${loanRequest.startDate}, ${loanRequest.endDate}, ${loanRequest.quantity}, ${loanRequest.notes},
          ${loanRequest.status}, ${loanRequest.adminNote}, ${loanRequest.createdAt}, ${loanRequest.reviewedAt},
          ${loanRequest.termsAccepted}, ${loanRequest.termsVersion}, ${loanRequest.badHire}
        from availability_guard
        returning id
      ),
      created_booking as (
        insert into bookings (id, item_id, request_id, start_date, end_date, quantity, status)
        select ${booking.id}, ${booking.itemId}, request.id, ${booking.startDate}, ${booking.endDate}, ${booking.quantity}, ${booking.status}
        from created_request request
        returning request_id
      ),
      created_history as (
        insert into request_status_history
          (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
        select ${randomUUID()}, request_id, null, ${loanRequest.status}, ${loanRequest.userId}, '', ${loanRequest.createdAt}
        from created_booking
        returning request_id
      )
      select request_id from created_history
    `,
  ], { isolationLevel: "ReadCommitted" });
  return insertedRows.length > 0;
}

export type ApproveRequestResult =
  | { ok: true; request: LoanRequest }
  | { ok: false; reason: "unavailable" | "not_pending" };

/** Revalidates and approves a pending request while holding its item's inventory lock. */
export async function approveRequest(
  id: string,
  actorUserId: string
): Promise<ApproveRequestResult> {
  const reviewedAt = new Date().toISOString();
  const [, approvedRows, pendingRows] = await sql.transaction([
    sql`
      select item.id
      from equipment_items item
      join bookings booking on booking.item_id = item.id
      join loan_requests request on request.id = booking.request_id
      where request.id = ${id}
      for update of item
    `,
    sql`
      with target as (
        select
          request.id,
          request.item_id,
          request.start_date,
          request.end_date,
          request.quantity
        from loan_requests request
        join bookings target_booking
          on target_booking.request_id = request.id
          and target_booking.status = 'pending'
        where request.id = ${id}
          and request.status = 'pending'
      ),
      item_capacity as (
        select item.id, item.total_quantity
        from equipment_items item
        join target on target.item_id = item.id
      ),
      candidate_days as (
        select target.id, target.item_id, target.quantity,
          generate_series(
            target.start_date::date,
            target.end_date::date,
            interval '1 day'
          )::date as day
        from target
      ),
      daily_reservations as (
        select
          candidate.day,
          candidate.quantity,
          capacity.total_quantity,
          coalesce(sum(
            case
              when booking.fulfillment_status = 'donation_completed' then 0
              else
                case
                  when booking.status = 'approved'
                    and candidate.day between booking.start_date::date and booking.end_date::date
                    then greatest(0, booking.quantity - events.collected_by_day)
                  else 0
                end
                + greatest(0, events.collected_by_day - events.returned_before_day)
                + case
                    when booking.status = 'approved'
                      and candidate.day > booking.end_date::date
                      and (
                        booking.fulfillment_status = 'legacy_unknown'
                        or (
                          booking.fulfillment_status in ('collected', 'returned')
                          and events.total_collected = 0
                        )
                      )
                      then greatest(0, booking.quantity - events.total_collected)
                    else 0
                  end
            end
          ), 0) as reserved
        from candidate_days candidate
        join item_capacity capacity on capacity.id = candidate.item_id
        left join bookings booking on booking.item_id = candidate.item_id
        left join lateral (
          select
            coalesce(sum(quantity) filter (
              where event_type = 'collection_confirmed'
                and left(occurred_at, 10)::date <= candidate.day
            ), 0) as collected_by_day,
            coalesce(sum(quantity) filter (
              where event_type = 'return_inspected'
                and left(occurred_at, 10)::date < candidate.day
            ), 0) as returned_before_day,
            coalesce(sum(quantity) filter (
              where event_type = 'collection_confirmed'
            ), 0) as total_collected
          from booking_fulfillment_events
          where booking_id = booking.id
        ) events on booking.id is not null
        group by candidate.day, candidate.quantity, capacity.total_quantity
      ),
      approval_guard as (
        select target.id
        from target
        where not exists (
          select 1
          from daily_reservations
          where total_quantity - reserved < quantity
        )
          and not exists (
            select 1
            from blackout_periods blackout
            where blackout.item_id = target.item_id
              and blackout.start_date::date <= target.end_date::date
              and blackout.end_date::date >= target.start_date::date
          )
      ),
      updated_request as (
        update loan_requests request
        set status = 'approved', reviewed_at = ${reviewedAt}
        where request.id = ${id}
          and request.status = 'pending'
          and exists (select 1 from approval_guard where approval_guard.id = request.id)
        returning request.*
      ),
      updated_booking as (
        update bookings booking set status = 'approved'
        where booking.request_id = ${id}
          and booking.status = 'pending'
          and exists (select 1 from updated_request)
        returning booking.request_id
      ),
      inserted_history as (
        insert into request_status_history
          (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
        select ${randomUUID()}, request.id, 'pending', 'approved', ${actorUserId}, '', ${reviewedAt}
        from updated_request request
        where exists (select 1 from updated_booking)
        returning request_id
      )
      select request.*
      from updated_request request
      join inserted_history history on history.request_id = request.id
    `,
    sql`select status from loan_requests where id = ${id}`,
  ], { isolationLevel: "ReadCommitted" });

  if (approvedRows[0]) return { ok: true, request: mapRequest(approvedRows[0]) };
  return pendingRows[0]?.status === "pending"
    ? { ok: false, reason: "unavailable" }
    : { ok: false, reason: "not_pending" };
}

/** Marks a pending request declined, deletes its booking, and records the actor atomically. */
export async function declineRequest(id: string, note: string, actorUserId: string): Promise<LoanRequest | null> {
  const reviewedAt = new Date().toISOString();
  const rows = await sql`
    with updated_request as (
      update loan_requests set status = 'declined', admin_note = ${note}, reviewed_at = ${reviewedAt}
      where id = ${id} and status = 'pending'
      returning *
    ), deleted_booking as (
      delete from bookings
      where request_id = ${id} and exists (select 1 from updated_request)
      returning request_id
    ), inserted_history as (
      insert into request_status_history
        (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
      select ${randomUUID()}, id, 'pending', 'declined', ${actorUserId}, ${note}, ${reviewedAt}
      from updated_request
      returning request_id
    )
    select * from updated_request
  `;
  return rows[0] ? mapRequest(rows[0]) : null;
}

/** Cancels an active request while retaining its booking row for audit. */
export async function cancelRequest(
  id: string,
  fromStatus: LoanRequestStatus,
  reason: string,
  actorUserId: string
): Promise<LoanRequest | null> {
  const cancelledAt = new Date().toISOString();
  const rows = await sql`
    with eligible_booking as (
      select id, request_id
      from bookings
      where request_id = ${id}
        and status in ('pending', 'approved')
        and fulfillment_status not in ('collected', 'returned', 'donation_completed')
      for update
    ), updated_request as (
      update loan_requests as request set status = 'cancelled'
      where request.id = ${id}
        and request.status = ${fromStatus}
        and request.status in ('pending', 'approved')
        and (
          not exists (select 1 from bookings where request_id = request.id)
          or exists (
            select 1 from eligible_booking
            where eligible_booking.request_id = request.id
          )
        )
      returning *
    ), cancelled_booking as (
      update bookings as booking set status = 'cancelled'
      where booking.request_id = ${id}
        and booking.status in ('pending', 'approved')
        and booking.fulfillment_status not in ('collected', 'returned', 'donation_completed')
        and exists (select 1 from updated_request)
      returning booking.request_id
    ), inserted_history as (
      insert into request_status_history
        (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
      select ${randomUUID()}, id, ${fromStatus}, 'cancelled', ${actorUserId}, ${reason}, ${cancelledAt}
      from updated_request
      returning request_id
    )
    select * from updated_request
  `;
  return rows[0] ? mapRequest(rows[0]) : null;
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

export interface DepositChargeAttempt {
  id: string;
  idempotencyKey: string;
  paymentIntentId: string | null;
  customerId: string;
  paymentMethodId: string;
  createdAt: string;
}

/** Begins or resumes the single in-progress charge attempt for an eligible request. */
export async function beginDepositChargeAttempt(
  requestId: string
): Promise<DepositChargeAttempt | null> {
  const attemptId = randomUUID();
  const idempotencyKey = depositChargeIdempotencyKey(attemptId);
  const createdAt = new Date().toISOString();
  const [, rows] = await sql.transaction([
    sql`
      select id
      from loan_requests
      where id = ${requestId}
      for update
    `,
    sql`
      with eligible_request as (
        select id, stripe_customer_id, stripe_payment_method_id
        from loan_requests
        where id = ${requestId}
          and bad_hire = true
          and deposit_charge_status in ('card_saved', 'failed')
          and stripe_customer_id is not null
          and stripe_payment_method_id is not null
        for update
      ), active_attempt as (
        select
          attempt.id,
          attempt.stripe_idempotency_key,
          attempt.stripe_payment_intent_id,
          attempt.created_at,
          eligible.stripe_customer_id,
          eligible.stripe_payment_method_id
        from deposit_charge_attempts attempt
        join eligible_request eligible on eligible.id = attempt.request_id
        where attempt.status = 'in_progress'
      ), inserted_attempt as (
        insert into deposit_charge_attempts
          (id, request_id, stripe_idempotency_key, status, created_at)
        select ${attemptId}, eligible.id, ${idempotencyKey}, 'in_progress', ${createdAt}
        from eligible_request eligible
        where not exists (select 1 from active_attempt)
        returning id, request_id, stripe_idempotency_key, created_at, stripe_payment_intent_id
      )
      select
        inserted.id,
        inserted.stripe_idempotency_key,
        inserted.stripe_payment_intent_id,
        inserted.created_at,
        eligible.stripe_customer_id,
        eligible.stripe_payment_method_id
      from inserted_attempt inserted
      join eligible_request eligible on eligible.id = inserted.request_id
      union all
      select
        active.id,
        active.stripe_idempotency_key,
        active.stripe_payment_intent_id,
        active.created_at,
        active.stripe_customer_id,
        active.stripe_payment_method_id
      from active_attempt active
      limit 1
    `,
  ], { isolationLevel: "ReadCommitted" });
  const row = rows[0];
  return row
    ? {
        id: row.id as string,
        idempotencyKey: row.stripe_idempotency_key as string,
        paymentIntentId: (row.stripe_payment_intent_id as string | null) ?? null,
        customerId: row.stripe_customer_id as string,
        paymentMethodId: row.stripe_payment_method_id as string,
        createdAt: row.created_at as string,
      }
    : null;
}

/** Persists the created intent so uncertain attempts can be safely retrieved later. */
export async function recordDepositChargePaymentIntent(
  attemptId: string,
  paymentIntentId: string
): Promise<boolean> {
  const rows = await sql`
    update deposit_charge_attempts
    set stripe_payment_intent_id = ${paymentIntentId}
    where id = ${attemptId}
      and status = 'in_progress'
      and (
        stripe_payment_intent_id is null
        or stripe_payment_intent_id = ${paymentIntentId}
      )
    returning id
  `;
  if (rows.length > 0) return true;

  const existingRows = await sql`
    select stripe_payment_intent_id
    from deposit_charge_attempts
    where id = ${attemptId}
  `;
  return existingRows[0]?.stripe_payment_intent_id === paymentIntentId;
}

/** Atomically records a charge result and its matching request status. */
export async function finishDepositChargeAttempt(
  attemptId: string,
  status: "succeeded" | "failed",
  chargedAt: string | null
): Promise<boolean> {
  const completedAt = chargedAt ?? new Date().toISOString();
  const rows = await sql`
    with eligible_attempt as (
      select id, request_id
      from deposit_charge_attempts
      where id = ${attemptId} and status = 'in_progress'
    ), updated_request as (
      update loan_requests request
      set deposit_charge_status = ${status === "succeeded" ? "charged" : "failed"},
          deposit_charged_at = ${status === "succeeded" ? chargedAt : null}
      from eligible_attempt attempt
      where request.id = attempt.request_id
        and ( ${status === "succeeded"} or request.deposit_charge_status <> 'charged' )
      returning request.id
    ), updated_attempt as (
      update deposit_charge_attempts attempt
      set status = ${status},
          completed_at = ${completedAt}
      where attempt.id = ${attemptId}
        and attempt.status = 'in_progress'
        and exists (select 1 from updated_request)
      returning attempt.id
    )
    select id from updated_attempt
  `;
  if (rows.length > 0) return true;

  const currentRows = await sql`
    select attempt.status as attempt_status, request.deposit_charge_status
    from deposit_charge_attempts attempt
    join loan_requests request on request.id = attempt.request_id
    where attempt.id = ${attemptId}
  `;
  return currentRows[0]?.attempt_status === status &&
    currentRows[0]?.deposit_charge_status === (status === "succeeded" ? "charged" : "failed");
}

/** Records a saved card against a request. Only the Stripe webhook handler should call this. */
export async function saveStripePaymentMethod(
  requestId: string,
  customerId: string,
  paymentMethodId: string
): Promise<LoanRequest | null> {
  const rows = await sql`
    with previous as materialized (
      select stripe_payment_method_id
      from loan_requests
      where id = ${requestId}
      for update
    ), updated as (
      update loan_requests request
      set stripe_customer_id = ${customerId},
          stripe_payment_method_id = ${paymentMethodId},
          deposit_charge_status = 'card_saved'
      from previous
      where request.id = ${requestId}
      returning request.*
    ), reopened_payments as (
      update booking_payments payment
      set status = 'pending', updated_at = ${new Date().toISOString()}
      from previous
      where payment.request_id = ${requestId}
        and (
          payment.status = 'awaiting_payment_method'
          or (
            payment.status = 'failed'
            and previous.stripe_payment_method_id is distinct from ${paymentMethodId}
          )
        )
      returning payment.id
    )
    select * from updated
  `;
  return rows[0] ? mapRequest(rows[0]) : null;
}

/** Records the outcome of a deposit charge attempt. */
export async function setDepositChargeResult(
  requestId: string,
  status: "charged" | "failed",
  chargedAt: string | null
): Promise<LoanRequest | null> {
  const rows = await sql`
    update loan_requests
    set deposit_charge_status = ${status},
        deposit_charged_at = ${chargedAt}
    where id = ${requestId}
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

export async function createNotificationOnce(notification: AppNotification): Promise<void> {
  await sql`
    insert into notifications (id, user_id, type, message, link, read, created_at)
    values (${notification.id}, ${notification.userId}, ${notification.type}, ${notification.message},
            ${notification.link}, ${notification.read}, ${notification.createdAt})
    on conflict (id) do nothing
  `;
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
