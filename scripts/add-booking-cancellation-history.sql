alter table loan_requests
  drop constraint if exists loan_requests_status_check;
alter table loan_requests
  add constraint loan_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'cancelled'));

alter table bookings
  drop constraint if exists bookings_status_check;
alter table bookings
  add constraint bookings_status_check
  check (status in ('pending', 'approved', 'cancelled'));

create table if not exists request_status_history (
  id text primary key,
  request_id text not null references loan_requests(id),
  from_status text check (from_status in ('pending', 'approved', 'declined', 'cancelled')),
  to_status text not null check (to_status in ('pending', 'approved', 'declined', 'cancelled')),
  actor_user_id text references users(id),
  reason text not null default '',
  created_at text not null
);

create index if not exists idx_request_status_history_request_id
  on request_status_history(request_id);

insert into request_status_history
  (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
select
  md5('request-created:' || id),
  id,
  null,
  'pending',
  user_id,
  '',
  created_at
from loan_requests
on conflict (id) do nothing;

insert into request_status_history
  (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
select
  md5('request-reviewed:' || id),
  id,
  'pending',
  status,
  null,
  case when status = 'declined' then admin_note else '' end,
  reviewed_at
from loan_requests
where status in ('approved', 'declined')
  and reviewed_at is not null
on conflict (id) do nothing;
