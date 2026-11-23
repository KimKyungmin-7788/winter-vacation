import { create } from 'zustand';
import { backend } from '../lib';
import { GAME_REWARDS } from '../data/items';
import { GAME_KEYS, Equipped, GameKey, GameResult, Level, ProgressRow, StudentRecord } from '../data/types';

export type Scene = 'start' | 'plaza' | 'game';

interface AppState {
  scene: Scene;
  activeGame: GameKey | null;
  wardrobeOpen: boolean;
  /** 로그인한 학생. null이면 체험(저장 안 됨) */
  student: StudentRecord | null;
  guest: boolean;
  guestLevel: Level;
  progress: ProgressRow[];
  inventory: string[];
  equipped: Equipped;
  festivalSeen: boolean;
  badge: boolean;

  init(): Promise<void>;
  loginSnapshot(s: { student: StudentRecord; progress: ProgressRow[]; inventory: string[] }): void;
  startGuest(level: Level): void;
  logout(): Promise<void>;
  openGame(g: GameKey): void;
  closeGame(): void;
  setWardrobe(open: boolean): void;
  toggleEquip(slot: keyof Equipped): void;
  levelFor(): Level;
  clearedGames(): GameKey[];
  /** 게임 결과를 기록하고 새로 받은 장비를 돌려준다 */
  completeGame(game: GameKey, level: Level, result: GameResult): Promise<{ newItems: string[]; festival: boolean; saved: boolean }>;
  markFestivalSeen(): void;
}

function clearedOf(progress: ProgressRow[]): GameKey[] {
  return GAME_KEYS.filter((g) => progress.some((p) => p.game_key === g && p.cleared));
}

export const useApp = create<AppState>((set, get) => ({
  scene: 'start',
  activeGame: null,
  wardrobeOpen: false,
  student: null,
  guest: false,
  guestLevel: 'ga',
  progress: [],
  inventory: [],
  equipped: {},
  festivalSeen: false,
  badge: false,

  async init() {
    try {
      const snap = await backend.restoreStudent();
      if (snap) get().loginSnapshot(snap);
    } catch {
      /* 복원 실패하면 시작 화면 */
    }
  },

  loginSnapshot({ student, progress, inventory }) {
    const cleared = clearedOf(progress).length === 4;
    set({
      student,
      guest: false,
      progress,
      inventory,
      equipped: student.equipped ?? {},
      scene: 'plaza',
      festivalSeen: cleared,
      badge: cleared,
    });
  },

  startGuest(level) {
    set({
      student: null,
      guest: true,
      guestLevel: level,
      progress: [],
      inventory: [],
      equipped: {},
      scene: 'plaza',
      festivalSeen: false,
      badge: false,
    });
  },

  async logout() {
    try {
      await backend.studentLogout();
    } catch {
      /* 무시 */
    }
    set({
      scene: 'start',
      student: null,
      guest: false,
      progress: [],
      inventory: [],
      equipped: {},
      activeGame: null,
      wardrobeOpen: false,
      festivalSeen: false,
      badge: false,
    });
  },

  openGame(g) {
    set({ scene: 'game', activeGame: g });
  },
  closeGame() {
    set({ scene: 'plaza', activeGame: null });
  },
  setWardrobe(open) {
    set({ wardrobeOpen: open });
  },

  toggleEquip(slot) {
    const { equipped, inventory, student } = get();
    if (!inventory.includes(slot)) return;
    const next = { ...equipped, [slot]: !equipped[slot] };
    set({ equipped: next });
    if (student) backend.setEquipped(next).catch(() => undefined);
  },

  levelFor() {
    const { student, guestLevel } = get();
    return student?.level ?? guestLevel;
  },

  clearedGames() {
    return clearedOf(get().progress);
  },

  async completeGame(game, level, result) {
    const { student, progress, inventory, equipped } = get();
    const now = new Date().toISOString();
    const prev = progress.find((p) => p.game_key === game);
    const row: ProgressRow = {
      student_id: student?.id ?? 'guest',
      game_key: game,
      level,
      cleared: true,
      stars: Math.max(prev?.stars ?? 0, result.stars),
      play_count: (prev?.play_count ?? 0) + 1,
      last_played_at: now,
    };
    const nextProgress = [...progress.filter((p) => p.game_key !== game), row];
    const rewards = GAME_REWARDS[game];
    const newItems = rewards.filter((k) => !inventory.includes(k));
    const nextInventory = [...inventory, ...newItems];
    const nextEquipped = { ...equipped };
    for (const k of newItems) nextEquipped[k as keyof Equipped] = true;
    const festival = clearedOf(nextProgress).length === 4 && !get().festivalSeen;
    set({
      progress: nextProgress,
      inventory: nextInventory,
      equipped: nextEquipped,
      badge: clearedOf(nextProgress).length === 4,
    });
    let saved = true;
    if (student) {
      // 저장 실패가 학생 화면을 막지 않도록 화면은 계속 진행한다
      try {
        await backend.recordProgress(game, level, true, result.stars);
        if (newItems.length) await backend.grantItems(newItems);
        if (newItems.length) await backend.setEquipped(nextEquipped);
        await backend.logMistakes(game, level, result.mistakes);
      } catch (e) {
        console.warn('저장 실패', e);
        saved = false;
      }
    }
    return { newItems, festival, saved };
  },

  markFestivalSeen() {
    set({ festivalSeen: true });
  },
}));
