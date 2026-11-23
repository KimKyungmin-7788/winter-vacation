import type { GameKey, ItemDef } from './types';

export const ITEMS: ItemDef[] = [
  { key: 'shoes', slot: 'shoes', name: '미끄럼 방지 신발', emoji: '👟', game: 'obi' },
  { key: 'helmet', slot: 'helmet', name: '꼬마 소방관 헬멧', emoji: '⛑️', game: 'tycoon' },
  { key: 'hat', slot: 'hat', name: '털모자', emoji: '🧢', game: 'snow' },
  { key: 'gloves', slot: 'gloves', name: '장갑', emoji: '🧤', game: 'snow' },
  { key: 'scarf', slot: 'scarf', name: '목도리', emoji: '🧣', game: 'snow' },
  { key: 'vest', slot: 'vest', name: '순찰대 반사 조끼', emoji: '🦺', game: 'patrol' },
];

export const ITEM_BY_KEY: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

/** 게임을 깨면 받는 장비 */
export const GAME_REWARDS: Record<GameKey, string[]> = {
  obi: ['shoes'],
  tycoon: ['helmet'],
  snow: ['hat', 'gloves', 'scarf'],
  patrol: ['vest'],
};

/** 눈사람 조각 (게임별) */
export const SNOWMAN_PART: Record<GameKey, string> = {
  obi: '몸통',
  tycoon: '머리',
  snow: '모자',
  patrol: '목도리',
};

export interface CharacterDef {
  key: string;
  name: string;
  emoji: string;
  body: string;
  head: string;
  ear: 'round' | 'long' | 'pointy' | 'floppy' | 'none';
}

export const CHARACTERS: CharacterDef[] = [
  { key: 'bear', name: '곰', emoji: '🐻', body: '#c98b4e', head: '#d9a066', ear: 'round' },
  { key: 'rabbit', name: '토끼', emoji: '🐰', body: '#f1ece6', head: '#fbf7f2', ear: 'long' },
  { key: 'cat', name: '고양이', emoji: '🐱', body: '#f0a64a', head: '#f7b866', ear: 'pointy' },
  { key: 'dog', name: '강아지', emoji: '🐶', body: '#e6c79a', head: '#f0d5ad', ear: 'floppy' },
  { key: 'penguin', name: '펭귄', emoji: '🐧', body: '#35465c', head: '#41546c', ear: 'none' },
  { key: 'fox', name: '여우', emoji: '🦊', body: '#e8743b', head: '#f08a4f', ear: 'pointy' },
];

export const CHARACTER_BY_KEY: Record<string, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.key, c]),
);

/** 그림 비밀번호용 그림 8개 */
export const PIN_PICTURES = ['⭐', '🍎', '🚗', '🌳', '🐟', '🎈', '🏠', '🍪'];
export const PIN_LENGTH = 4;
