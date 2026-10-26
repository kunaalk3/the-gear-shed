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
