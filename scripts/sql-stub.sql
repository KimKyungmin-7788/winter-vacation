-- Supabase가 기본 제공하는 것들을 흉내 내는 검증용 틀 (로컬 Postgres 전용)
create role anon nologin; create role authenticated nologin;
create schema auth; create schema extensions;
grant usage on schema auth, extensions, public to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
