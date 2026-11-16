-- =====================================================================
-- BizAI — Supabase setup for the Employee Management page
-- Run once in Supabase → SQL Editor → paste everything → Run.
-- Safe to run again: it skips anything that already exists.
-- =====================================================================


-- 1. Lock every table ---------------------------------------------------
-- Turns on row level security everywhere. With no policies, the public
-- (anon) key cannot read or change any table directly. The app only
-- talks to the three functions in step 6.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;


-- 2. Salary currency ----------------------------------------------------
alter table public.employees
  add column if not exists salary_currency varchar not null default 'BDT';


-- 3. Per-person permissions ---------------------------------------------
-- Each business member gets their own list of permissions
-- (role_permissions stays as it is for role defaults, if you want it later).
create table if not exists public.member_permissions (
  id                 uuid primary key default gen_random_uuid(),
  business_member_id uuid not null references public.business_members(id) on delete cascade,
  permission_id      uuid not null references public.permissions(id) on delete cascade,
  created_at         timestamptz default now(),
  unique (business_member_id, permission_id)
);
alter table public.member_permissions enable row level security;


-- 4. Starter roles and permissions (only added if missing) --------------
insert into public.roles (name, description)
select v.name, v.description
from (values
  ('EMPLOYEE', 'Standard team member'),
  ('MANAGER',  'Team leadership'),
  ('ADMIN',    'Elevated access')
) as v(name, description)
where not exists (select 1 from public.roles r where upper(r.name) = v.name);

insert into public.permissions (name, description)
select v.name, v.description
from (values
  ('VIEW_DASHBOARD',   'View dashboard'),
  ('MANAGE_PRODUCTS',  'Manage products'),
  ('MANAGE_ORDERS',    'Manage orders'),
  ('MANAGE_CUSTOMERS', 'Manage customers'),
  ('MANAGE_INVENTORY', 'Manage inventory'),
  ('VIEW_FINANCES',    'View finances'),
  ('MANAGE_FINANCES',  'Manage finances'),
  ('MANAGE_TASKS',     'Manage tasks'),
  ('MANAGE_DOCUMENTS', 'Manage documents'),
  ('MANAGE_EMPLOYEES', 'Manage employees')
) as v(name, description)
where not exists (select 1 from public.permissions p where upper(p.name) = v.name);


-- 5. A business to put employees in (only if you have none) -------------
insert into public.businesses (name)
select 'Acme Workspace'
where not exists (select 1 from public.businesses);


-- 6. Functions the app calls --------------------------------------------
-- "security definer" lets them work even though the tables are locked.
-- Each one only touches employees of the business ID it is given.

-- 6a. List employees of a business
create or replace function public.list_employees(p_business_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(x) order by x."createdAt"), '[]'::json)
  from (
    select
      e.id,
      bm.id                 as "memberId",
      u.full_name           as name,
      u.email,
      u.phone,
      e.job_title           as "jobTitle",
      upper(r.name)         as role,
      e.salary,
      e.salary_currency     as "salaryCurrency",
      e.department,
      e.employment_type     as "employmentType",
      e.hire_date           as "hireDate",
      coalesce((
        select json_agg(upper(p.name) order by p.name)
        from member_permissions mp
        join permissions p on p.id = mp.permission_id
        where mp.business_member_id = bm.id
      ), '[]'::json)        as permissions,
      e.created_at          as "createdAt"
    from employees e
    join business_members bm on bm.id = e.business_member_id
    join users u             on u.id  = bm.user_id
    join roles r             on r.id  = bm.role_id
    where bm.business_id = p_business_id
  ) x;
$$;


-- 6b. Add or update an employee (no "id" = add, with "id" = update)
create or replace function public.save_employee(p_business_id uuid, p_employee json)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid    := nullif(p_employee->>'id', '')::uuid;
  v_name        text    := nullif(trim(p_employee->>'name'), '');
  v_email       text    := lower(nullif(trim(p_employee->>'email'), ''));
  v_phone       text    := nullif(trim(p_employee->>'phone'), '');
  v_job_title   text    := nullif(trim(p_employee->>'jobTitle'), '');
  v_department  text    := nullif(trim(p_employee->>'department'), '');
  v_emp_type    text    := nullif(trim(p_employee->>'employmentType'), '');
  v_hire_date   date    := nullif(p_employee->>'hireDate', '')::date;
  v_salary      numeric := nullif(p_employee->>'salary', '')::numeric;
  v_currency    text    := upper(coalesce(nullif(p_employee->>'salaryCurrency', ''), 'BDT'));
  v_role        text    := upper(coalesce(nullif(p_employee->>'role', ''), 'EMPLOYEE'));
  v_perms       json    := p_employee->'permissions';
  v_role_id     uuid;
  v_user_id     uuid;
  v_member_id   uuid;
begin
  -- Checks
  if not exists (select 1 from businesses where id = p_business_id) then
    raise exception 'Business not found. Check VITE_BUSINESS_ID in your .env file.';
  end if;
  if v_name is null  then raise exception 'Full name is required.'; end if;
  if v_email is null then raise exception 'Email address is required.'; end if;
  if v_salary is not null and v_salary < 0 then
    raise exception 'Salary cannot be negative.';
  end if;
  if v_currency not in ('BDT', 'USD', 'EUR') then
    raise exception 'Unsupported salary currency: %', v_currency;
  end if;

  select id into v_role_id from roles
  where upper(name) = v_role order by created_at limit 1;
  if v_role_id is null then
    raise exception 'Role "%" does not exist in the roles table.', v_role;
  end if;

  if v_employee_id is null then
    -- ---------- Add ----------
    -- Reuse an existing user with this email, if there is one
    select id into v_user_id from users
    where lower(email) = v_email order by created_at limit 1;

    if v_user_id is not null and exists (
      select 1 from business_members
      where business_id = p_business_id and user_id = v_user_id
    ) then
      raise exception 'An employee with this email already exists.';
    end if;

    if v_user_id is null then
      insert into users (full_name, email, phone)
      values (v_name, v_email, v_phone)
      returning id into v_user_id;
    end if;

    insert into business_members (business_id, user_id, role_id)
    values (p_business_id, v_user_id, v_role_id)
    returning id into v_member_id;

    insert into employees (business_member_id, job_title, department, employment_type,
                           hire_date, salary, salary_currency)
    values (v_member_id, v_job_title, v_department, v_emp_type,
            v_hire_date, v_salary, v_currency)
    returning id into v_employee_id;

  else
    -- ---------- Update ----------
    select e.business_member_id, bm.user_id into v_member_id, v_user_id
    from employees e
    join business_members bm on bm.id = e.business_member_id
    where e.id = v_employee_id and bm.business_id = p_business_id;

    if v_member_id is null then
      raise exception 'Employee not found.';
    end if;

    if exists (
      select 1 from users u
      join business_members bm on bm.user_id = u.id
      where bm.business_id = p_business_id
        and lower(u.email) = v_email
        and u.id <> v_user_id
    ) then
      raise exception 'Another employee already uses this email.';
    end if;

    update users
    set full_name = v_name, email = v_email, phone = v_phone, updated_at = now()
    where id = v_user_id;

    update business_members set role_id = v_role_id where id = v_member_id;

    update employees
    set job_title = v_job_title, department = v_department, employment_type = v_emp_type,
        hire_date = v_hire_date, salary = v_salary, salary_currency = v_currency,
        updated_at = now()
    where id = v_employee_id;
  end if;

  -- Replace this person's permissions with the ones ticked in the form
  delete from member_permissions where business_member_id = v_member_id;
  if v_perms is not null and json_typeof(v_perms) = 'array' then
    insert into member_permissions (business_member_id, permission_id)
    select v_member_id, p.id
    from permissions p
    where upper(p.name) in (select upper(value) from json_array_elements_text(v_perms));
  end if;

  return v_employee_id;
end;
$$;


-- 6c. Delete an employee
create or replace function public.delete_employee(p_business_id uuid, p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_user_id   uuid;
begin
  select e.business_member_id, bm.user_id into v_member_id, v_user_id
  from employees e
  join business_members bm on bm.id = e.business_member_id
  where e.id = p_employee_id and bm.business_id = p_business_id;

  if v_member_id is null then
    raise exception 'Employee not found.';
  end if;

  delete from employees          where id = p_employee_id;
  delete from member_permissions where business_member_id = v_member_id;

  begin
    delete from business_members where id = v_member_id;
  exception when foreign_key_violation then
    raise exception 'This employee has shared notes or documents, so they cannot be deleted yet.';
  end;

  -- Remove the user too, if they belong to no other business, have no
  -- login, and nothing else points to them
  if not exists (select 1 from business_members where user_id = v_user_id)
     and (select auth_user_id from users where id = v_user_id) is null then
    begin
      delete from users where id = v_user_id;
    exception when foreign_key_violation then
      null;  -- still referenced elsewhere (notes, documents…); keep the user row
    end;
  end if;
end;
$$;


-- 7. Only these functions are open to the app ---------------------------
revoke all on function public.list_employees(uuid)        from public;
revoke all on function public.save_employee(uuid, json)   from public;
revoke all on function public.delete_employee(uuid, uuid) from public;
grant execute on function public.list_employees(uuid)        to anon, authenticated;
grant execute on function public.save_employee(uuid, json)   to anon, authenticated;
grant execute on function public.delete_employee(uuid, uuid) to anon, authenticated;


-- 8. Your business ID ---------------------------------------------------
-- Copy the id shown in the results into VITE_BUSINESS_ID in frontend/.env
select id, name from public.businesses order by created_at;