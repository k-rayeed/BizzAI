begin;

-- Check finance permissions.
create or replace function public.finance_access(
  p_business_id uuid,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    join public.users u
      on u.id = bm.user_id
    join public.member_permissions mp
      on mp.business_member_id = bm.id
    join public.permissions p
      on p.id = mp.permission_id
    where bm.business_id = p_business_id
      and u.auth_user_id = auth.uid()
      and (
        upper(p.name) = 'MANAGE_FINANCES'
        or (
          not p_write
          and upper(p.name) = 'VIEW_FINANCES'
        )
      )
  );
$$;

revoke all on function public.finance_access(uuid, boolean)
from public;

grant execute on function public.finance_access(uuid, boolean)
to authenticated;

-- Financial records.
create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id),

  kind text not null
    check (kind in ('expense', 'sale', 'income')),

  entry_date date not null,

  category text not null
    check (length(trim(category)) between 1 and 80),

  description text not null
    check (length(trim(description)) between 1 and 500),

  amount numeric(14, 2) not null
    check (amount > 0),

  currency text not null default 'BDT'
    check (currency in ('BDT', 'USD', 'EUR')),

  receipt_path text,

  created_by uuid not null default auth.uid()
    references auth.users(id),

  created_at timestamptz not null default now(),

  check (
    receipt_path is null
    or receipt_path like business_id::text || '/%'
  )
);

create index finance_entries_business_date
on public.finance_entries (business_id, entry_date);

alter table public.finance_entries
enable row level security;

revoke all on public.finance_entries from anon;

grant select, insert, update, delete
on public.finance_entries to authenticated;

-- Record access rules.
create policy finance_read
on public.finance_entries
for select to authenticated
using (
  public.finance_access(business_id)
);

create policy finance_insert
on public.finance_entries
for insert to authenticated
with check (
  public.finance_access(business_id, true)
  and created_by = auth.uid()
);

create policy finance_update
on public.finance_entries
for update to authenticated
using (
  public.finance_access(business_id, true)
)
with check (
  public.finance_access(business_id, true)
);

create policy finance_delete
on public.finance_entries
for delete to authenticated
using (
  public.finance_access(business_id, true)
);

-- Check access to receipt photos.
create or replace function public.finance_receipt_access(
  p_path text,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id::text = split_part(p_path, '/', 1)
      and public.finance_access(bm.business_id, p_write)
  );
$$;

revoke all on function public.finance_receipt_access(text, boolean)
from public;

grant execute on function public.finance_receipt_access(text, boolean)
to authenticated;

-- Private receipt storage.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'finance-receipts',
  'finance-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy finance_receipt_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'finance-receipts'
  and public.finance_receipt_access(name)
);

create policy finance_receipt_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'finance-receipts'
  and public.finance_receipt_access(name, true)
);

create policy finance_receipt_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'finance-receipts'
  and public.finance_receipt_access(name, true)
);

commit;