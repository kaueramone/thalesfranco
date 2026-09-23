-- Execute no SQL Editor do projeto Supabase. Seguro para executar novamente.
begin;
create extension if not exists pgcrypto;
create table if not exists public.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.admins where user_id=auth.uid())$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create table if not exists public.students(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(length(name) between 2 and 150), birth_date date,
 email text not null default '', whatsapp text not null default '', active boolean not null default true,
 email_opt_in boolean not null default false, whatsapp_opt_in boolean not null default false,
 created_at timestamptz not null default now(), check(email<>'' or whatsapp<>''),
 check(whatsapp='' or whatsapp ~ '^\+[1-9][0-9]{7,14}$')
);
create table if not exists public.workouts(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 content jsonb not null, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create or replace function public.touch_workout() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end;$$;
drop trigger if exists workout_updated on public.workouts;
create trigger workout_updated before update on public.workouts for each row execute function public.touch_workout();
create table if not exists public.publications(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 workout_id uuid not null references public.workouts(id) on delete cascade, title text not null, content jsonb not null,
 content_hash text not null, token uuid not null unique default gen_random_uuid(), revoked boolean not null default false,
 created_at timestamptz not null default now(), unique(workout_id,content_hash)
);
create table if not exists public.deliveries(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 publication_id uuid not null references public.publications(id) on delete cascade,
 student_id uuid references public.students(id) on delete set null, channel text not null check(channel in ('email','whatsapp')),
 status text not null default 'processing' check(status in ('processing','accepted','failed','uncertain')),
 provider_id text, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(publication_id,student_id,channel)
);
create index if not exists students_owner on public.students(owner_id);
create index if not exists workouts_owner on public.workouts(owner_id);
create index if not exists deliveries_owner on public.deliveries(owner_id,created_at desc);
alter table public.admins enable row level security;
alter table public.students enable row level security;
alter table public.workouts enable row level security;
alter table public.publications enable row level security;
alter table public.deliveries enable row level security;
revoke all on public.admins,public.students,public.workouts,public.publications,public.deliveries from anon,authenticated;
grant select on public.admins to authenticated;
grant select,insert,update,delete on public.students,public.workouts to authenticated;
grant select on public.publications,public.deliveries to authenticated;
grant all on public.admins,public.students,public.workouts,public.publications,public.deliveries to service_role;
drop policy if exists admin_self on public.admins;
create policy admin_self on public.admins for select to authenticated using(user_id=auth.uid());
drop policy if exists students_owner on public.students;
create policy students_owner on public.students for all to authenticated using(public.is_admin() and owner_id=auth.uid()) with check(public.is_admin() and owner_id=auth.uid());
drop policy if exists workouts_owner on public.workouts;
create policy workouts_owner on public.workouts for all to authenticated using(public.is_admin() and owner_id=auth.uid()) with check(public.is_admin() and owner_id=auth.uid());
drop policy if exists publications_owner on public.publications;
create policy publications_owner on public.publications for select to authenticated using(public.is_admin() and owner_id=auth.uid());
drop policy if exists deliveries_owner on public.deliveries;
create policy deliveries_owner on public.deliveries for select to authenticated using(public.is_admin() and owner_id=auth.uid());
commit;
