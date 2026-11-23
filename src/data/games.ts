import type { GameKey } from './types';

export interface GameDef {
  key: GameKey;
  entrance: string;
  title: string;
  emoji: string;
  color: string;
  /** 광장에서 입구 위치 [x, z] */
  pos: [number, number];
}

export const GAMES: GameDef[] = [
  { key: 'obi', entrance: '빙판 골목', title: '펭귄걸음 오비', emoji: '🧊', color: '#7cc4f5', pos: [-8, -7] },
  { key: 'tycoon', entrance: '우리 집', title: '따끈따끈 우리집 타이쿤', emoji: '🏠', color: '#f29a6b', pos: [8, -7] },
  { key: 'snow', entrance: '눈밭', title: '체온 지킴이 눈밭 탐험', emoji: '⛄', color: '#b9a4f0', pos: [-8, 7] },
  { key: 'patrol', entrance: '개울가', title: '얼음 위는 안 돼! 순찰대', emoji: '🦺', color: '#6fd3a8', pos: [8, 7] },
];

export const GAME_BY_KEY: Record<GameKey, GameDef> = Object.fromEntries(GAMES.map((g) => [g.key, g])) as Record<
  GameKey,
  GameDef
>;
