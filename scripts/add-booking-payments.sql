create table booking_payments (
  id text primary key,
  request_id text not null references loan_requests(id),
  payment_kind text not null check (payment_kind in ('hire_fee', 'deposit')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'aud' check (currency = 'aud'),
  status text not null check (status in (
    'awaiting_payment_method', 'pending', 'processing', 'succeeded', 'failed',
    'refund_pending', 'refunded', 'refund_failed', 'manual_review'
  )),
  stripe_payment_intent_id text unique,
  stripe_refund_id text unique,
  charged_at text,
  refunded_at text,
  failure_message text,
  created_at text not null,
  updated_at text not null,
  unique (request_id, payment_kind)
);

create table booking_payment_attempts (
  id text primary key,
  payment_id text not null references booking_payments(id),
  operation text not null check (operation in ('charge', 'refund')),
  stripe_idempotency_key text not null unique,
  stripe_object_id text unique,
  status text not null check (status in ('in_progress', 'succeeded', 'failed', 'uncertain')),
  created_at text not null,
  completed_at text,
  error_message text
);

create unique index idx_booking_payment_attempts_active
  on booking_payment_attempts(payment_id, operation)
  where status in ('in_progress', 'uncertain');
