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
  role text not null check (role in ('requester', 'admin'))
);

create table if not exists equipment_items (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  images text[] not null default '{}',
  total_quantity integer not null,
  deposit_required integer not null default 0,
  booking_conditions text not null default '',
  cancellation_rules text not null default '',
  retired boolean not null default false
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
  status text not null check (status in ('pending', 'approved', 'declined')),
  admin_note text not null default '',
  created_at text not null,
  reviewed_at text
);

create table if not exists bookings (
  id text primary key,
  item_id text not null references equipment_items(id),
  request_id text not null,
  start_date text not null,
  end_date text not null,
  quantity integer not null,
  status text not null check (status in ('pending', 'approved'))
);

create index if not exists idx_bookings_item_id on bookings(item_id);
create index if not exists idx_bookings_request_id on bookings(request_id);
create index if not exists idx_blackouts_item_id on blackout_periods(item_id);
create index if not exists idx_loan_requests_user_id on loan_requests(user_id);
create index if not exists idx_loan_requests_item_id on loan_requests(item_id);
