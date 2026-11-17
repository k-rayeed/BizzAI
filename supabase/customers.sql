-- Customer Management: functions the app calls (same pattern as employees)

create or replace function public.list_customers(p_business_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(x) order by x."createdAt" desc), '[]'::json)
  from (
    select
      c.id,
      c.full_name       as name,
      c.email,
      c.phone,
      c.internal_notes  as notes,
      c.created_at      as "createdAt"
    from customers c
    where c.business_id = p_business_id
  ) x;
$$;

create or replace function public.save_customer(p_business_id uuid, p_customer json)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := nullif(p_customer->>'id', '')::uuid;
  v_name  text := nullif(trim(p_customer->>'name'), '');
  v_email text := lower(nullif(trim(p_customer->>'email'), ''));
  v_phone text := nullif(trim(p_customer->>'phone'), '');
  v_notes text := nullif(trim(p_customer->>'notes'), '');
begin
  if not exists (select 1 from businesses where id = p_business_id) then
    raise exception 'Business not found. Check VITE_BUSINESS_ID in your .env file.';
  end if;
  if v_name is null then
    raise exception 'Full name is required.';
  end if;

  if v_id is null then
    insert into customers (business_id, full_name, email, phone, internal_notes)
    values (p_business_id, v_name, v_email, v_phone, v_notes)
    returning id into v_id;
  else
    update customers
    set full_name = v_name, email = v_email, phone = v_phone,
        internal_notes = v_notes, updated_at = now()
    where id = v_id and business_id = p_business_id;
    if not found then
      raise exception 'Customer not found.';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_customer(p_business_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from customers
  where id = p_customer_id and business_id = p_business_id;
  if not found then
    raise exception 'Customer not found.';
  end if;
exception when foreign_key_violation then
  raise exception 'This customer has orders or other records, so it cannot be deleted yet.';
end;
$$;

revoke all on function public.list_customers(uuid)        from public;
revoke all on function public.save_customer(uuid, json)   from public;
revoke all on function public.delete_customer(uuid, uuid) from public;
grant execute on function public.list_customers(uuid)        to anon, authenticated;
grant execute on function public.save_customer(uuid, json)   to anon, authenticated;
grant execute on function public.delete_customer(uuid, uuid) to anon, authenticated;