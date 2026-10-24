-- Dates are stored as ISO text (e.g. "2026-08-10") rather than Postgres `date`/`timestamptz`
-- so they compare and serialize exactly like the app's existing string-based date logic
-- (lib/availability.ts), with no driver-side Date object coercion to account for.

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  organisation text not null default '',
  phone text not null default '',
  role text not null check (role in ('requester', 'admin', 'org')),
  org_status text not null default 'approved' check (org_status in ('pending', 'approved', 'rejected', 'retired')),
  accepted_payment_methods text[] not null default '{}',
  terms_accepted boolean not null default false,
  terms_version text not null default ''
);

create table if not exists equipment_items (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  images text[] not null default '{}',
  total_quantity integer not null,
  transaction_type text not null default 'temporary_free_loan'
    check (transaction_type in ('paid_hire', 'temporary_free_loan', 'permanent_donation')),
  hire_fee integer not null default 0
    check (hire_fee >= 0)
    constraint equipment_items_hire_fee_type_check
    check (transaction_type = 'paid_hire' or hire_fee = 0),
  equipment_condition text not null default 'unknown'
    check (equipment_condition in ('excellent', 'good', 'fair', 'poor', 'unknown')),
  condition_notes text not null default '',
  deposit_required integer not null default 0,
  booking_conditions text not null default '',
  cancellation_rules text not null default '',
  retired boolean not null default false,
  owner_id text references users(id),
  pickup_notes text not null default '',
  dropoff_notes text not null default ''
);

create table if not exists blackout_periods (
  id text primary key,
  item_id text not null references equipment_items(id),
  start_date text not null,
  end_date text not null,
  reason text not null default '',
  created_at text not null
);

create table if not exists loan_requests (
  id text primary key,
  item_id text not null references equipment_items(id),
  user_id text not null references users(id),
  requester_name text not null,
  requester_email text not null,
  requester_organisation text not null default '',
  requester_phone text not null default '',
  start_date text not null,
  end_date text not null,
  quantity integer not null,
  notes text not null default '',
  status text not null check (status in ('pending', 'approved', 'declined', 'cancelled')),
  admin_note text not null default '',
  created_at text not null,
  reviewed_at text,
  terms_accepted boolean not null default false,
  terms_version text not null default 'v1',
  bad_hire boolean not null default false,
  stripe_customer_id text,
  stripe_payment_method_id text,
  deposit_charge_status text not null default 'none'
    check (deposit_charge_status in ('none', 'card_saved', 'charged', 'failed')),
  deposit_charged_at text
);

create table if not exists deposit_charge_attempts (
  id text primary key,
  request_id text not null references loan_requests(id),
  stripe_idempotency_key text not null unique,
  stripe_payment_intent_id text unique,
  status text not null check (status in ('in_progress', 'succeeded', 'failed')),
  created_at text not null,
  completed_at text
);

create unique index if not exists idx_deposit_charge_attempts_in_progress
  on deposit_charge_attempts(request_id)
  where status = 'in_progress';

create table if not exists request_status_history (
  id text primary key,
  request_id text not null references loan_requests(id),
  from_status text check (from_status in ('pending', 'approved', 'declined', 'cancelled')),
  to_status text not null check (to_status in ('pending', 'approved', 'declined', 'cancelled')),
  actor_user_id text references users(id),
  reason text not null default '',
  created_at text not null
);

create table if not exists feedback (
  id text primary key,
  name text not null,
  email text not null,
  message text not null,
  created_at text not null
);

create table if not exists notifications (
  id text primary key,
  user_id text not null references users(id),
  type text not null,
  message text not null,
  link text not null default '',
  read boolean not null default false,
  created_at text not null
);

create table if not exists reviews (
  id text primary key,
  request_id text not null unique references loan_requests(id),
  item_id text not null references equipment_items(id),
  user_id text not null references users(id),
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at text not null
);

create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_reviews_item_id on reviews(item_id);

create table if not exists bookings (
  id text primary key,
  item_id text not null references equipment_items(id),
  request_id text not null,
  start_date text not null,
  end_date text not null,
  quantity integer not null,
  status text not null check (status in ('pending', 'approved', 'cancelled')),
  fulfillment_status text not null default 'not_started'
    constraint bookings_fulfillment_status_check
    check (fulfillment_status in ('not_started', 'collected', 'returned', 'donation_completed', 'legacy_unknown'))
);

create table if not exists booking_fulfillment_events (
  id text primary key,
  booking_id text not null references bookings(id),
  event_type text not null
    check (event_type in ('collection_confirmed', 'return_inspected', 'donation_handover_confirmed')),
  actor_user_id text not null references users(id),
  occurred_at text not null,
  quantity integer not null check (quantity > 0),
  condition text not null
    check (condition in ('excellent', 'good', 'fair', 'poor', 'unknown')),
  notes text not null default '',
  evidence_refs text[] not null default '{}'
);

create index if not exists idx_bookings_item_id on bookings(item_id);
create index if not exists idx_bookings_request_id on bookings(request_id);
create index if not exists idx_booking_fulfillment_events_booking_time
  on booking_fulfillment_events(booking_id, occurred_at);
create index if not exists idx_booking_fulfillment_events_actor
  on booking_fulfillment_events(actor_user_id);
create index if not exists idx_request_status_history_request_id on request_status_history(request_id);
create index if not exists idx_blackouts_item_id on blackout_periods(item_id);
create index if not exists idx_loan_requests_user_id on loan_requests(user_id);
create index if not exists idx_loan_requests_item_id on loan_requests(item_id);
