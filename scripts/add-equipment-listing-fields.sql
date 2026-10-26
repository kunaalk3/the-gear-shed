begin;

alter table equipment_items
  add column if not exists transaction_type text not null default 'temporary_free_loan';
alter table equipment_items
  add column if not exists hire_fee integer not null default 0;
alter table equipment_items
  add column if not exists equipment_condition text not null default 'unknown';
alter table equipment_items
  add column if not exists condition_notes text not null default '';

update equipment_items set transaction_type = 'temporary_free_loan' where transaction_type is null;
update equipment_items set hire_fee = 0 where hire_fee is null;
update equipment_items set hire_fee = 0 where transaction_type <> 'paid_hire' and hire_fee <> 0;
update equipment_items set equipment_condition = 'unknown' where equipment_condition is null;
update equipment_items set condition_notes = '' where condition_notes is null;

alter table equipment_items
  alter column transaction_type set default 'temporary_free_loan',
  alter column transaction_type set not null,
  alter column hire_fee set default 0,
  alter column hire_fee set not null,
  alter column equipment_condition set default 'unknown',
  alter column equipment_condition set not null,
  alter column condition_notes set default '',
  alter column condition_notes set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_items_transaction_type_check'
      and conrelid = 'equipment_items'::regclass
  ) then
    alter table equipment_items
      add constraint equipment_items_transaction_type_check
      check (transaction_type in ('paid_hire', 'temporary_free_loan', 'permanent_donation'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_items_hire_fee_check'
      and conrelid = 'equipment_items'::regclass
  ) then
    alter table equipment_items
      add constraint equipment_items_hire_fee_check check (hire_fee >= 0);
  end if;

  alter table equipment_items
    drop constraint if exists equipment_items_hire_fee_type_check;
  alter table equipment_items
    add constraint equipment_items_hire_fee_type_check
    check (transaction_type = 'paid_hire' or hire_fee = 0);

  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_items_equipment_condition_check'
      and conrelid = 'equipment_items'::regclass
  ) then
    alter table equipment_items
      add constraint equipment_items_equipment_condition_check
      check (equipment_condition in ('excellent', 'good', 'fair', 'poor', 'unknown'));
  end if;
end $$;

commit;
