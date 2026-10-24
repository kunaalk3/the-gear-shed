begin;

alter table bookings
  add column if not exists fulfillment_status text;

update bookings
set fulfillment_status = 'legacy_unknown'
where fulfillment_status is null;

alter table bookings
  alter column fulfillment_status set default 'not_started',
  alter column fulfillment_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_fulfillment_status_check'
      and conrelid = 'bookings'::regclass
  ) then
    alter table bookings
      add constraint bookings_fulfillment_status_check
      check (fulfillment_status in ('not_started', 'collected', 'returned', 'donation_completed', 'legacy_unknown'));
  end if;
end $$;

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

create index if not exists idx_booking_fulfillment_events_booking_time
  on booking_fulfillment_events(booking_id, occurred_at);
create index if not exists idx_booking_fulfillment_events_actor
  on booking_fulfillment_events(actor_user_id);

commit;
