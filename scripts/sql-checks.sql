\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 't1@x'), ('22222222-2222-2222-2222-222222222222', 't2@x');

-- 교사1: 학급 만들고 학생 2명 등록
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","is_anonymous":false}', false);
insert into classes (teacher_id, name, class_code) values ('11111111-1111-1111-1111-111111111111', '1반', 'ABC234');
select teacher_add_student((select id from classes), '토리', 'bear', '0123', 'ga');
select teacher_add_student((select id from classes), '모모', 'cat', '4567', 'na');
do $$ begin
  begin perform teacher_add_student((select id from classes), '나쁜', 'bear', '9999', 'ga'); raise exception 'bad pin accepted';
  exception when others then if sqlerrm = 'bad pin accepted' then raise; end if; end;
end $$;
-- pin_hash는 교사도 못 읽는다
do $$ begin
  begin perform pin_hash from students limit 1; raise exception 'pin_hash readable';
  exception when insufficient_privilege then null; end;
end $$;

-- 교사2는 교사1 학급을 못 본다
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","is_anonymous":false}', false);
do $$ begin
  if (select count(*) from classes) <> 0 then raise exception 'teacher2 sees classes'; end if;
  if (select count(*) from students) <> 0 then raise exception 'teacher2 sees students'; end if;
  begin perform teacher_set_level((select 1)::int::text::uuid, 'da'); exception when others then null; end;
end $$;

-- 학생(익명) 기기 A
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","is_anonymous":true}', false);
do $$
declare r record; tori uuid; momo uuid; ok boolean;
begin
  select id into tori from list_roster('abc234') where nickname = '토리';
  select id into momo from list_roster('ABC234') where nickname = '모모';
  if tori is null or momo is null then raise exception 'roster failed'; end if;
  if student_login(tori, '9999') then raise exception 'wrong pin accepted'; end if;
  if not student_login(tori, '0123') then raise exception 'right pin rejected'; end if;
  perform record_progress('obi', 'ga', true, 2);
  perform record_progress('obi', 'ga', true, 1);
  perform grant_items(array['shoes']);
  perform set_equipped('{"shoes":true}'::jsonb);
  perform log_mistakes('obi', 'ga', array['run_on_ice']);
  if (select stars from progress where game_key = 'obi') <> 2 then raise exception 'stars not max'; end if;
  if (select play_count from progress where game_key = 'obi') <> 2 then raise exception 'play_count'; end if;
  -- 자기 것만 보인다 (모모 기록은 없음)
  if (select count(*) from students) <> 1 then raise exception 'student sees others'; end if;
  -- 학생은 학급 생성/레벨 변경/직접 쓰기 불가
  begin insert into classes (teacher_id, name, class_code) values (auth.uid(), 'x', 'ZZZ999'); raise exception 'anon created class';
  exception when others then if sqlerrm = 'anon created class' then raise; end if; end;
  begin update students set level = 'da'; raise exception 'direct update ok';
  exception when insufficient_privilege then null; end;
  begin perform teacher_set_level(tori, 'da'); raise exception 'anon set level';
  exception when others then if sqlerrm = 'anon set level' then raise; end if; end;
end $$;

-- 학생 기기 B는 로그인 전엔 아무것도 못 본다
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","is_anonymous":true}', false);
do $$ begin
  if (select count(*) from progress) <> 0 or (select count(*) from students) <> 0 then raise exception 'B sees data'; end if;
  begin perform record_progress('obi','ga',true,3); raise exception 'B wrote without login';
  exception when others then if sqlerrm = 'B wrote without login' then raise; end if; end;
end $$;

-- 5번 틀리면 잠금
do $$ declare t uuid; i int; begin
  select id into t from list_roster('ABC234') where nickname = '모모';
  for i in 1..5 loop perform student_login(t, '0000'); end loop;
  if student_login(t, '4567') then raise exception 'lock not applied'; end if;
end $$;

-- 교사1은 학생 진행을 본다
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","is_anonymous":false}', false);
do $$ begin
  if (select count(*) from progress) <> 1 then raise exception 'teacher cannot see progress'; end if;
  if (select count(*) from mistakes) <> 1 then raise exception 'teacher cannot see mistakes'; end if;
  perform teacher_set_level((select id from students where nickname = '토리'), 'da');
  if (select level from students where nickname = '토리') <> 'da' then raise exception 'level not set'; end if;
end $$;
