export type Level = 'ga' | 'na' | 'da';
export const LEVELS: Level[] = ['ga', 'na', 'da'];
export const LEVEL_LABEL: Record<Level, string> = { ga: '가', na: '나', da: '다' };

export type GameKey = 'obi' | 'tycoon' | 'snow' | 'patrol';
export const GAME_KEYS: GameKey[] = ['obi', 'tycoon', 'snow', 'patrol'];

export type EquipSlot = 'shoes' | 'helmet' | 'hat' | 'gloves' | 'scarf' | 'vest';

export interface ItemDef {
  key: string;
  slot: EquipSlot;
  name: string;
  emoji: string;
  game: GameKey;
}

export interface Equipped {
  shoes?: boolean;
  helmet?: boolean;
  hat?: boolean;
  gloves?: boolean;
  scarf?: boolean;
  vest?: boolean;
}

export interface StudentRecord {
  id: string;
  class_id: string;
  nickname: string;
  character_key: string;
  level: Level;
  equipped: Equipped;
}

export interface ProgressRow {
  student_id: string;
  game_key: GameKey;
  level: Level;
  cleared: boolean;
  stars: number;
  play_count: number;
  last_played_at: string;
}

export interface MistakeRow {
  student_id: string;
  game_key: GameKey;
  level: Level;
  mistake_key: string;
  created_at: string;
}

export interface ClassRecord {
  id: string;
  teacher_id: string;
  name: string;
  class_code: string;
}

/** 학생이 게임을 마치고 돌려주는 결과 */
export interface GameResult {
  stars: number; // 1~3
  mistakes: string[];
}

export interface StudentSnapshot {
  student: StudentRecord;
  progress: ProgressRow[];
  inventory: string[];
}
