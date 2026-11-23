import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ClassRecord, MistakeRow, ProgressRow, StudentRecord, StudentSnapshot } from '../data/types';
import { Backend, ClassOverview, TeacherUser, makeClassCode, validPin } from './backend';

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const toTeacher = (u: { id: string; email?: string | null }): TeacherUser => ({ id: u.id, email: u.email ?? '' });

  /** 학생 화면은 익명 로그인 상태에서만 움직인다 */
  async function ensureAnonymous(): Promise<void> {
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      const { error } = await sb.auth.signInAnonymously();
      fail(error);
    }
  }

  async function snapshotFor(): Promise<StudentSnapshot | null> {
    const { data: sid } = await sb.rpc('current_student_id');
    if (!sid) return null;
    const [st, pr, inv] = await Promise.all([
      sb.from('students').select('id, class_id, nickname, character_key, level, equipped').eq('id', sid).maybeSingle(),
      sb.from('progress').select('*').eq('student_id', sid),
      sb.from('inventory').select('item_key').eq('student_id', sid),
    ]);
    fail(st.error);
    fail(pr.error);
    fail(inv.error);
    if (!st.data) return null;
    return {
      student: st.data as StudentRecord,
      progress: (pr.data ?? []) as ProgressRow[],
      inventory: (inv.data ?? []).map((r: { item_key: string }) => r.item_key),
    };
  }

  return {
    mode: 'supabase',

    async listRoster(code) {
      await ensureAnonymous();
      const { data, error } = await sb.rpc('list_roster', { p_code: code.trim().toUpperCase() });
      fail(error);
      const rows = (data ?? []) as { id: string; nickname: string; character_key: string }[];
      if (rows.length === 0) return null;
      return rows;
    },

    async studentLogin(studentId, pin) {
      await ensureAnonymous();
      const { data, error } = await sb.rpc('student_login', { p_student: studentId, p_pin: pin });
      fail(error);
      if (!data) return null;
      return snapshotFor();
    },

    async restoreStudent() {
      const { data } = await sb.auth.getSession();
      if (!data.session?.user.is_anonymous) return null;
      return snapshotFor();
    },

    async studentLogout() {
      await sb.rpc('student_logout');
    },

    async recordProgress(game, level, cleared, stars) {
      const { error } = await sb.rpc('record_progress', {
        p_game: game,
        p_level: level,
        p_cleared: cleared,
        p_stars: stars,
      });
      fail(error);
    },
    async grantItems(keys) {
      const { error } = await sb.rpc('grant_items', { p_items: keys });
      fail(error);
    },
    async setEquipped(equipped) {
      const { error } = await sb.rpc('set_equipped', { p_equipped: equipped });
      fail(error);
    },
    async logMistakes(game, level, keys) {
      if (keys.length === 0) return;
      const { error } = await sb.rpc('log_mistakes', { p_game: game, p_level: level, p_keys: keys });
      fail(error);
    },
    loadSnapshot: snapshotFor,

    openRoom(room) {
      // 방 이름에 학급 id(추측할 수 없는 uuid)가 들어가므로 같은 반 친구끼리만 만난다
      const ch = sb.channel(`room:${room}`, { config: { broadcast: { self: false } } });
      let cb: (m: unknown) => void = () => undefined;
      let ready = false;
      const queue: unknown[] = [];
      ch.on('broadcast', { event: 'm' }, (p) => cb(p.payload)).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ready = true;
          queue.splice(0).forEach((m) => void ch.send({ type: 'broadcast', event: 'm', payload: m }));
        }
      });
      return {
        send: (msg) => {
          if (ready) void ch.send({ type: 'broadcast', event: 'm', payload: msg });
          else queue.push(msg);
        },
        onMessage: (f) => {
          cb = f;
        },
        close: () => void sb.removeChannel(ch),
      };
    },

    async teacherSession() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      if (!u || u.is_anonymous) return null;
      return toTeacher(u);
    },
    async teacherSignIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      fail(error);
      return toTeacher(data.user!);
    },
    async teacherSignUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      fail(error);
      if (!data.session) throw new Error('메일로 온 확인 링크를 누른 뒤 다시 로그인하세요.');
      return toTeacher(data.user!);
    },
    async teacherSignOut() {
      await sb.auth.signOut();
    },

    async listClasses() {
      const { data, error } = await sb.from('classes').select('*').order('created_at');
      fail(error);
      return (data ?? []) as ClassRecord[];
    },
    async createClass(name) {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) throw new Error('로그인이 필요해요.');
      for (let i = 0; i < 5; i++) {
        const { data, error } = await sb
          .from('classes')
          .insert({ teacher_id: u.user.id, name: name.trim(), class_code: makeClassCode() })
          .select()
          .single();
        if (!error) return data as ClassRecord;
        if (!/duplicate|unique/i.test(error.message)) fail(error);
      }
      throw new Error('학급 코드를 만들지 못했어요. 다시 눌러 보세요.');
    },
    async deleteClass(classId) {
      const { error } = await sb.from('classes').delete().eq('id', classId);
      fail(error);
    },
    async classOverview(classId): Promise<ClassOverview> {
      const st = await sb
        .from('students')
        .select('id, class_id, nickname, character_key, level, equipped')
        .eq('class_id', classId)
        .order('created_at');
      fail(st.error);
      const students = (st.data ?? []) as StudentRecord[];
      const ids = students.map((s) => s.id);
      if (ids.length === 0) return { students, progress: [], inventory: [], mistakes: [] };
      const [pr, inv, mi] = await Promise.all([
        sb.from('progress').select('*').in('student_id', ids),
        sb.from('inventory').select('student_id, item_key').in('student_id', ids),
        sb.from('mistakes').select('student_id, game_key, level, mistake_key, created_at').in('student_id', ids),
      ]);
      fail(pr.error);
      fail(inv.error);
      fail(mi.error);
      return {
        students,
        progress: (pr.data ?? []) as ProgressRow[],
        inventory: (inv.data ?? []) as { student_id: string; item_key: string }[],
        mistakes: (mi.data ?? []) as MistakeRow[],
      };
    },
    async addStudent(classId, nickname, characterKey, pin, level) {
      if (!validPin(pin)) throw new Error('그림 비밀번호는 그림 4개예요.');
      const { error } = await sb.rpc('teacher_add_student', {
        p_class: classId,
        p_nickname: nickname.trim(),
        p_character: characterKey,
        p_pin: pin,
        p_level: level,
      });
      fail(error);
    },
    async setStudentLevel(studentId, level) {
      const { error } = await sb.rpc('teacher_set_level', { p_student: studentId, p_level: level });
      fail(error);
    },
    async deleteStudent(studentId) {
      const { error } = await sb.from('students').delete().eq('id', studentId);
      fail(error);
    },
  };
}
