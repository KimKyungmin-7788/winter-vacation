-- 눈꽃마을 안전 광장 DB (Supabase SQL Editor에 통째로 붙여 넣어 실행)
-- 전제: Authentication > Providers 에서 "Anonymous sign-ins" 와 "Email" 을 켠다.
-- 원칙: 모든 테이블에 RLS. 학생의 쓰기는 전부 아래 RPC 함수(security definer)로만 한다.

create extension if not exists pgcrypto with schema extensions;

-- ───────── 테이블 ─────────
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  class_code text not null unique check (class_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  character_key text not null,
  pin_hash text not null,
  level text not null default 'ga' check (level in ('ga', 'na', 'da')),
  equipped jsonb not null default '{}'::jsonb,
  pin_fail_count int not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- 이 기기(익명 로그인)가 어느 학생으로 들어왔는지
create table if not exists public.student_sessions (
  auth_uid uuid primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  student_id uuid not null references public.students (id) on delete cascade,
  game_key text not null check (game_key in ('obi', 'tycoon', 'snow', 'patrol')),
  level text not null check (level in ('ga', 'na', 'da')),
  cleared boolean not null default false,
  stars int not null default 0 check (stars between 0 and 3),
  play_count int not null default 0,
  last_played_at timestamptz not null default now(),
  primary key (student_id, game_key)
);

create table if not exists public.inventory (
  student_id uuid not null references public.students (id) on delete cascade,
  item_key text not null check (item_key in ('shoes', 'helmet', 'hat', 'gloves', 'scarf', 'vest')),
  acquired_at timestamptz not null default now(),
  primary key (student_id, item_key)
);

create table if not exists public.mistakes (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  game_key text not null check (game_key in ('obi', 'tycoon', 'snow', 'patrol')),
  level text not null check (level in ('ga', 'na', 'da')),
  mistake_key text not null check (char_length(mistake_key) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists mistakes_student_idx on public.mistakes (student_id);

-- ───────── 도우미 함수 ─────────
create or replace function public.is_teacher() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

create or replace function public.current_student_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select student_id from public.student_sessions where auth_uid = auth.uid()
$$;

create or replace function public.owns_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_teacher() and exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid())
$$;

create or replace function public.owns_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_teacher() and exists (
    select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = p_student and c.teacher_id = auth.uid())
$$;

-- ───────── RLS ─────────
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_sessions enable row level security;
alter table public.progress enable row level security;
alter table public.inventory enable row level security;
alter table public.mistakes enable row level security;

drop policy if exists classes_teacher_all on public.classes;
create policy classes_teacher_all on public.classes for all to authenticated
  using (public.is_teacher() and teacher_id = auth.uid())
  with check (public.is_teacher() and teacher_id = auth.uid());

drop policy if exists students_teacher_select on public.students;
create policy students_teacher_select on public.students for select to authenticated
  using (public.owns_class(class_id));
drop policy if exists students_self_select on public.students;
create policy students_self_select on public.students for select to authenticated
  using (id = public.current_student_id());
drop policy if exists students_teacher_delete on public.students;
create policy students_teacher_delete on public.students for delete to authenticated
  using (public.owns_class(class_id));

drop policy if exists sessions_self_select on public.student_sessions;
create policy sessions_self_select on public.student_sessions for select to authenticated
  using (auth_uid = auth.uid());

drop policy if exists progress_read on public.progress;
create policy progress_read on public.progress for select to authenticated
  using (student_id = public.current_student_id() or public.owns_student(student_id));
drop policy if exists inventory_read on public.inventory;
create policy inventory_read on public.inventory for select to authenticated
  using (student_id = public.current_student_id() or public.owns_student(student_id));
drop policy if exists mistakes_read on public.mistakes;
create policy mistakes_read on public.mistakes for select to authenticated
  using (student_id = public.current_student_id() or public.owns_student(student_id));

-- 테이블 직접 권한: 읽기만. 쓰기는 RPC로만. pin_hash 등 민감 열은 읽기에서도 뺀다.
revoke all on public.classes, public.students, public.student_sessions, public.progress, public.inventory, public.mistakes from anon, authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select (id, class_id, nickname, character_key, level, equipped, created_at) on public.students to authenticated;
grant delete on public.students to authenticated;
grant select on public.student_sessions, public.progress, public.inventory, public.mistakes to authenticated;

-- ───────── 학생용 RPC ─────────
-- 학급 코드로 친구 목록 (별명·캐릭터만)
create or replace function public.list_roster(p_code text)
returns table (id uuid, nickname text, character_key text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.nickname, s.character_key
  from public.students s join public.classes c on c.id = s.class_id
  where c.class_code = upper(p_code)
  order by s.created_at
$$;

-- 그림 비밀번호 확인 후 이 기기를 학생에 연결. 5번 틀리면 1분 잠금.
create or replace function public.student_login(p_student uuid, p_pin text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare s public.students%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into s from public.students where id = p_student for update;
  if not found then return false; end if;
  if s.pin_locked_until is not null and s.pin_locked_until > now() then return false; end if;
  if s.pin_hash = extensions.crypt(p_pin, s.pin_hash) then
    update public.students set pin_fail_count = 0, pin_locked_until = null where id = s.id;
    insert into public.student_sessions (auth_uid, student_id) values (auth.uid(), s.id)
      on conflict (auth_uid) do update set student_id = excluded.student_id, created_at = now();
    return true;
  end if;
  update public.students
    set pin_fail_count = case when pin_fail_count >= 4 then 0 else pin_fail_count + 1 end,
        pin_locked_until = case when pin_fail_count >= 4 then now() + interval '1 minute' else null end
    where id = s.id;
  return false;
end $$;

create or replace function public.student_logout() returns void
language sql security definer set search_path = '' as $$
  delete from public.student_sessions where auth_uid = auth.uid()
$$;

create or replace function public.record_progress(p_game text, p_level text, p_cleared boolean, p_stars int)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid := public.current_student_id();
begin
  if sid is null then raise exception 'not logged in'; end if;
  insert into public.progress (student_id, game_key, level, cleared, stars, play_count, last_played_at)
    values (sid, p_game, p_level, p_cleared, greatest(0, least(3, p_stars)), 1, now())
  on conflict (student_id, game_key) do update set
    level = excluded.level,
    cleared = public.progress.cleared or excluded.cleared,
    stars = greatest(public.progress.stars, excluded.stars),
    play_count = public.progress.play_count + 1,
    last_played_at = now();
end $$;

create or replace function public.grant_items(p_items text[])
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid := public.current_student_id(); k text;
begin
  if sid is null then raise exception 'not logged in'; end if;
  foreach k in array p_items loop
    insert into public.inventory (student_id, item_key) values (sid, k) on conflict do nothing;
  end loop;
end $$;

create or replace function public.set_equipped(p_equipped jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid := public.current_student_id();
begin
  if sid is null then raise exception 'not logged in'; end if;
  update public.students set equipped = p_equipped where id = sid;
end $$;

create or replace function public.log_mistakes(p_game text, p_level text, p_keys text[])
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid := public.current_student_id(); k text;
begin
  if sid is null then raise exception 'not logged in'; end if;
  foreach k in array p_keys loop
    insert into public.mistakes (student_id, game_key, level, mistake_key) values (sid, p_game, p_level, left(k, 60));
  end loop;
end $$;

-- ───────── 교사용 RPC ─────────
create or replace function public.teacher_add_student(p_class uuid, p_nickname text, p_character text, p_pin text, p_level text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.owns_class(p_class) then raise exception 'not your class'; end if;
  if p_pin !~ '^[0-7]{4}$' then raise exception 'bad pin'; end if;
  insert into public.students (class_id, nickname, character_key, pin_hash, level)
    values (p_class, p_nickname, p_character, extensions.crypt(p_pin, extensions.gen_salt('bf')), p_level)
    returning id into new_id;
  return new_id;
end $$;

create or replace function public.teacher_set_level(p_student uuid, p_level text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_student(p_student) then raise exception 'not your student'; end if;
  update public.students set level = p_level where id = p_student;
end $$;

-- 함수 실행 권한
revoke execute on all functions in schema public from public, anon;
grant execute on function public.list_roster(text) to anon, authenticated;
grant execute on function public.student_login(uuid, text), public.student_logout(),
  public.record_progress(text, text, boolean, int), public.grant_items(text[]),
  public.set_equipped(jsonb), public.log_mistakes(text, text, text[]),
  public.teacher_add_student(uuid, text, text, text, text), public.teacher_set_level(uuid, text),
  public.is_teacher(), public.current_student_id(), public.owns_class(uuid), public.owns_student(uuid)
  to authenticated;
