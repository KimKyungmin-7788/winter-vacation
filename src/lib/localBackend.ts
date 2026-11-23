import type {
  ClassRecord,
  Equipped,
  GameKey,
  Level,
  MistakeRow,
  ProgressRow,
  StudentRecord,
  StudentSnapshot,
} from '../data/types';
import { Backend, ClassOverview, TeacherUser, makeClassCode, normalizeCode, validPin } from './backend';
import { hashPin } from './hash';

interface LocalStudent extends StudentRecord {
  pin_hash: string;
}
interface DB {
  classes: ClassRecord[];
  students: LocalStudent[];
  progress: ProgressRow[];
  inventory: { student_id: string; item_key: string; acquired_at: string }[];
  mistakes: MistakeRow[];
}

const DB_KEY = 'svs.local.db.v1';
const SESSION_KEY = 'svs.local.student';
const TEACHER_KEY = 'svs.local.teacher';
const LOCAL_TEACHER: TeacherUser = { id: 'local-teacher', email: '이 태블릿(체험 모드)' };

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createLocalBackend(storage: Storage = globalThis.localStorage): Backend {
  const read = (): DB => {
    try {
      const raw = storage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw) as DB;
    } catch {
      /* 저장소를 못 읽으면 빈 DB */
    }
    return { classes: [], students: [], progress: [], inventory: [], mistakes: [] };
  };
  const write = (db: DB) => {
    try {
      storage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* 저장 실패는 무시 (게임은 계속) */
    }
  };
  const sessionId = () => storage.getItem(SESSION_KEY);
  const strip = (s: LocalStudent): StudentRecord => {
    const { pin_hash: _p, ...rest } = s;
    void _p;
    return rest;
  };
  const snapshot = (db: DB, id: string | null): StudentSnapshot | null => {
    const s = db.students.find((x) => x.id === id);
    if (!s) return null;
    return {
      student: strip(s),
      progress: db.progress.filter((p) => p.student_id === s.id),
      inventory: db.inventory.filter((i) => i.student_id === s.id).map((i) => i.item_key),
    };
  };

  return {
    mode: 'local',

    async listRoster(code) {
      const db = read();
      const c = db.classes.find((x) => x.class_code === normalizeCode(code));
      if (!c) return null;
      return db.students
        .filter((s) => s.class_id === c.id)
        .map((s) => ({ id: s.id, nickname: s.nickname, character_key: s.character_key }));
    },

    async studentLogin(studentId, pin) {
      const db = read();
      const s = db.students.find((x) => x.id === studentId);
      if (!s) return null;
      if ((await hashPin(s.id, pin)) !== s.pin_hash) return null;
      storage.setItem(SESSION_KEY, s.id);
      return snapshot(db, s.id);
    },

    async restoreStudent() {
      return snapshot(read(), sessionId());
    },

    async studentLogout() {
      storage.removeItem(SESSION_KEY);
    },

    async recordProgress(game, level, cleared, stars) {
      const db = read();
      const id = sessionId();
      if (!id) return;
      const now = new Date().toISOString();
      const row = db.progress.find((p) => p.student_id === id && p.game_key === game);
      if (row) {
        row.play_count += 1;
        row.last_played_at = now;
        row.level = level;
        row.cleared = row.cleared || cleared;
        row.stars = Math.max(row.stars, stars);
      } else {
        db.progress.push({
          student_id: id,
          game_key: game,
          level,
          cleared,
          stars,
          play_count: 1,
          last_played_at: now,
        });
      }
      write(db);
    },

    async grantItems(keys) {
      const db = read();
      const id = sessionId();
      if (!id) return;
      for (const k of keys) {
        if (!db.inventory.some((i) => i.student_id === id && i.item_key === k)) {
          db.inventory.push({ student_id: id, item_key: k, acquired_at: new Date().toISOString() });
        }
      }
      write(db);
    },

    async setEquipped(equipped) {
      const db = read();
      const s = db.students.find((x) => x.id === sessionId());
      if (!s) return;
      s.equipped = equipped;
      write(db);
    },

    async logMistakes(game, level, keys) {
      const db = read();
      const id = sessionId();
      if (!id) return;
      for (const k of keys) {
        db.mistakes.push({
          student_id: id,
          game_key: game,
          level,
          mistake_key: k,
          created_at: new Date().toISOString(),
        });
      }
      write(db);
    },

    async loadSnapshot() {
      return snapshot(read(), sessionId());
    },

    openRoom(room) {
      const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`svs-room-${room}`) : null;
      return {
        send: (msg) => bc?.postMessage(msg),
        onMessage: (cb) => {
          if (bc) bc.onmessage = (e) => cb(e.data);
        },
        close: () => bc?.close(),
      };
    },

    // --- 교사 (체험 모드는 로그인 없이 이 기기에서만) ---
    async teacherSession() {
      return storage.getItem(TEACHER_KEY) ? LOCAL_TEACHER : null;
    },
    async teacherSignIn() {
      storage.setItem(TEACHER_KEY, '1');
      return LOCAL_TEACHER;
    },
    async teacherSignUp() {
      storage.setItem(TEACHER_KEY, '1');
      return LOCAL_TEACHER;
    },
    async teacherSignOut() {
      storage.removeItem(TEACHER_KEY);
    },

    async listClasses() {
      return read().classes;
    },

    async createClass(name) {
      const db = read();
      let code = makeClassCode();
      while (db.classes.some((c) => c.class_code === code)) code = makeClassCode();
      const c: ClassRecord = { id: uid(), teacher_id: LOCAL_TEACHER.id, name: name.trim(), class_code: code };
      db.classes.push(c);
      write(db);
      return c;
    },

    async deleteClass(classId) {
      const db = read();
      const ids = new Set(db.students.filter((s) => s.class_id === classId).map((s) => s.id));
      db.classes = db.classes.filter((c) => c.id !== classId);
      db.students = db.students.filter((s) => s.class_id !== classId);
      db.progress = db.progress.filter((p) => !ids.has(p.student_id));
      db.inventory = db.inventory.filter((p) => !ids.has(p.student_id));
      db.mistakes = db.mistakes.filter((p) => !ids.has(p.student_id));
      write(db);
    },

    async classOverview(classId): Promise<ClassOverview> {
      const db = read();
      const students = db.students.filter((s) => s.class_id === classId);
      const ids = new Set(students.map((s) => s.id));
      return {
        students: students.map(strip),
        progress: db.progress.filter((p) => ids.has(p.student_id)),
        inventory: db.inventory.filter((i) => ids.has(i.student_id)),
        mistakes: db.mistakes.filter((m) => ids.has(m.student_id)),
      };
    },

    async addStudent(classId, nickname, characterKey, pin, level) {
      if (!validPin(pin)) throw new Error('그림 비밀번호는 그림 4개예요.');
      const db = read();
      const id = uid();
      db.students.push({
        id,
        class_id: classId,
        nickname: nickname.trim(),
        character_key: characterKey,
        level,
        equipped: {},
        pin_hash: await hashPin(id, pin),
      });
      write(db);
    },

    async setStudentLevel(studentId, level: Level) {
      const db = read();
      const s = db.students.find((x) => x.id === studentId);
      if (s) s.level = level;
      write(db);
    },

    async deleteStudent(studentId) {
      const db = read();
      db.students = db.students.filter((s) => s.id !== studentId);
      db.progress = db.progress.filter((p) => p.student_id !== studentId);
      db.inventory = db.inventory.filter((p) => p.student_id !== studentId);
      db.mistakes = db.mistakes.filter((p) => p.student_id !== studentId);
      write(db);
    },
  };
}
export type { Equipped, GameKey };
