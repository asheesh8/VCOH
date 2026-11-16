-- Vermont Comforts of Home: live content store for the site editor.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- After running it:
--   1. Authentication → Users → "Add user" → "Create new user"
--        email:    the editor login (also goes in js/supabase-config.js)
--        password: the editor passcode
--        tick "Auto Confirm User"
--   2. Add that same email to site_editors (last statement below).
--   3. Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".

-- ------------------------------------------------------------------
-- Who may edit. Only emails listed here can write, even if someone
-- manages to create another account.
-- ------------------------------------------------------------------
create table if not exists public.site_editors (
  email text primary key
);
alter table public.site_editors enable row level security;
-- No policies: the table is invisible to the public API.

create or replace function public.is_site_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_editors
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ------------------------------------------------------------------
-- The published site content (one row, id = 'live').
-- ------------------------------------------------------------------
create table if not exists public.site_content (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.site_content enable row level security;

drop policy if exists "Anyone can read site content" on public.site_content;
create policy "Anyone can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "Editors can insert site content" on public.site_content;
create policy "Editors can insert site content"
  on public.site_content for insert
  to authenticated
  with check (public.is_site_editor());

drop policy if exists "Editors can update site content" on public.site_content;
create policy "Editors can update site content"
  on public.site_content for update
  to authenticated
  using (public.is_site_editor())
  with check (public.is_site_editor());

-- ------------------------------------------------------------------
-- History: every save keeps the previous version, so a bad edit can
-- always be rolled back from the Table Editor.
-- ------------------------------------------------------------------
create table if not exists public.site_content_history (
  history_id  bigint generated always as identity primary key,
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null,
  updated_by  text,
  replaced_at timestamptz not null default now()
);
alter table public.site_content_history enable row level security;

drop policy if exists "Editors can read history" on public.site_content_history;
create policy "Editors can read history"
  on public.site_content_history for select
  to authenticated
  using (public.is_site_editor());

create or replace function public.site_content_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_content_history (id, data, updated_at, updated_by)
  values (old.id, old.data, old.updated_at, old.updated_by);
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;

drop trigger if exists site_content_history on public.site_content;
create trigger site_content_history
  before update on public.site_content
  for each row execute function public.site_content_keep_history();

-- ------------------------------------------------------------------
-- Photos uploaded from the editor.
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Editors can upload site media" on storage.objects;
create policy "Editors can upload site media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-media' and public.is_site_editor());

drop policy if exists "Editors can replace site media" on storage.objects;
create policy "Editors can replace site media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-media' and public.is_site_editor());

-- ------------------------------------------------------------------
-- Put the editor login here (same email as in step 1).
-- ------------------------------------------------------------------
insert into public.site_editors (email)
values ('REPLACE-WITH-EDITOR-EMAIL@example.org')
on conflict do nothing;
