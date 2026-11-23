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

export interface RosterEntry {
  id: string;
  nickname: string;
  character_key: string;
}

export interface TeacherUser {
  id: string;
  email: string;
}

export interface ClassOverview {
  students: StudentRecord[];
  progress: ProgressRow[];
  inventory: { student_id: string; item_key: string }[];
  mistakes: MistakeRow[];
}

/** 같은 학급 친구들끼리 주고받는 실시간 통로 (순찰대 함께 하기) */
export interface RoomChannel {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  close(): void;
}

/** 화면은 이 인터페이스만 안다. 구현은 Supabase 또는 이 기기 안 저장(체험 모드). */
export interface Backend {
  mode: 'supabase' | 'local';

  // --- 학생 ---
  /** 학급 코드로 친구 목록(별명·캐릭터만). 코드가 틀리면 null */
  listRoster(classCode: string): Promise<RosterEntry[] | null>;
  /** 그림 비밀번호(예: "0132")가 맞으면 학생 기록 */
  studentLogin(studentId: string, pin: string): Promise<StudentSnapshot | null>;
  /** 새로고침했을 때 로그인 유지 */
  restoreStudent(): Promise<StudentSnapshot | null>;
  studentLogout(): Promise<void>;
  recordProgress(game: GameKey, level: Level, cleared: boolean, stars: number): Promise<void>;
  grantItems(itemKeys: string[]): Promise<void>;
  setEquipped(equipped: Equipped): Promise<void>;
  logMistakes(game: GameKey, level: Level, keys: string[]): Promise<void>;
  loadSnapshot(): Promise<StudentSnapshot | null>;
  /** 실시간 방. 서버 모드는 Supabase Realtime, 체험 모드는 같은 브라우저의 다른 탭끼리 */
  openRoom(room: string): RoomChannel;

  // --- 교사 ---
  teacherSession(): Promise<TeacherUser | null>;
  teacherSignIn(email: string, password: string): Promise<TeacherUser>;
  teacherSignUp(email: string, password: string): Promise<TeacherUser>;
  teacherSignOut(): Promise<void>;
  listClasses(): Promise<ClassRecord[]>;
  createClass(name: string): Promise<ClassRecord>;
  deleteClass(classId: string): Promise<void>;
  classOverview(classId: string): Promise<ClassOverview>;
  addStudent(classId: string, nickname: string, characterKey: string, pin: string, level: Level): Promise<void>;
  setStudentLevel(studentId: string, level: Level): Promise<void>;
  deleteStudent(studentId: string): Promise<void>;
}

export function makeClassCode(): string {
  // 헷갈리는 글자(0,O,1,I)를 뺀 6자리
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const arr = new Uint32Array(6);
  (globalThis.crypto ?? ({ getRandomValues: (a: Uint32Array) => a.map(() => Math.random() * 2 ** 32) } as Crypto)).getRandomValues(arr);
  for (const n of arr) s += chars[n % chars.length];
  return s;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validPin(pin: string): boolean {
  return /^[0-7]{4}$/.test(pin);
}
