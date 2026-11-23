import type { Level } from '../../data/types';

export type Clothing = 'hat' | 'gloves' | 'scarf';
export const SHELTER = { x: -8, z: -5, r: 2.8 };
export const SITE = { x: 0, z: -2 };
export const BOUNDS = { x: 12, z: 8 };
export const THROWER = { x: 7, z: -4 };

export const BASE_DROP: Record<Level, number> = { ga: 0.55, na: 0.7, da: 0.85 };
export const MISSING_DROP = 0.9;
export const WET_DROP = 1.3;
export const SHELTER_RISE = 10;
export const SIGNAL_SECONDS = 12;

export interface Pickup {
  key: Clothing;
  x: number;
  z: number;
  taken: boolean;
}
export interface Pile {
  x: number;
  z: number;
  done: boolean;
}

export interface SnowState {
  level: Level;
  t: number;
  temp: number;
  worn: Record<Clothing, boolean>;
  pickups: Pickup[];
  piles: Pile[];
  snowman: number;
  wet: boolean;
  inShelter: boolean;
  shelterVisits: number;
  px: number;
  pz: number;
  ballT: number;
  ballFlight: number | null;
  ballsHit: number;
  changes: number;
  shiver: { t: number } | null;
  shiverDone: boolean;
  frost: boolean;
  frostDone: boolean;
  won: boolean;
  adultT: number | null;
}

export type SnowEvent =
  | { type: 'wear'; item: Clothing }
  | { type: 'pile'; n: number }
  | { type: 'cold' }
  | { type: 'ball' }
  | { type: 'wet' }
  | { type: 'shelter' }
  | { type: 'shiver' }
  | { type: 'shiverMissed' }
  | { type: 'adult' }
  | { type: 'frost' }
  | { type: 'frostWrong' }
  | { type: 'frostOk' }
  | { type: 'changed' }
  | { type: 'win' };

export function initSnow(level: Level): SnowState {
  return {
    level,
    t: 0,
    temp: 100,
    worn: { hat: false, gloves: false, scarf: false },
    pickups: [
      { key: 'hat', x: -3, z: 4, taken: false },
      { key: 'gloves', x: 3, z: 5, taken: false },
      { key: 'scarf', x: 6, z: 0, taken: false },
    ],
    piles: [
      { x: -6, z: 5, done: false },
      { x: 9, z: 4, done: false },
      { x: 4, z: -6, done: false },
    ],
    snowman: 0,
    wet: false,
    inShelter: false,
    shelterVisits: 0,
    px: 0,
    pz: 0,
    ballT: 0,
    ballFlight: null,
    ballsHit: 0,
    changes: 0,
    shiver: null,
    shiverDone: false,
    frost: false,
    frostDone: false,
    won: false,
    adultT: null,
  };
}

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

export function dropRate(st: SnowState): number {
  if (st.inShelter) return -SHELTER_RISE;
  const missing = (['hat', 'gloves', 'scarf'] as Clothing[]).filter((k) => !st.worn[k]).length;
  return BASE_DROP[st.level] + missing * MISSING_DROP + (st.wet ? WET_DROP : 0);
}

export function canWin(st: SnowState): boolean {
  const all = st.worn.hat && st.worn.gloves && st.worn.scarf;
  if (!all || st.snowman < 3 || st.shelterVisits < 1) return false;
  if (st.level === 'ga') return true;
  if (st.ballsHit < 1 || st.wet || !st.shiverDone) return false;
  if (st.level === 'da' && !st.frostDone) return false;
  return true;
}

export function stepSnow(st: SnowState, dt: number): SnowEvent[] {
  const ev: SnowEvent[] = [];
  if (st.won) return ev;
  st.t += dt;

  // 쉼터
  const was = st.inShelter;
  st.inShelter = dist(st.px, st.pz, SHELTER.x, SHELTER.z) < SHELTER.r;
  if (st.inShelter && !was) {
    st.shelterVisits += 1;
    ev.push({ type: 'shelter' });
  }

  // 옷 줍기
  for (const p of st.pickups) {
    if (!p.taken && dist(st.px, st.pz, p.x, p.z) < 1.2) {
      p.taken = true;
      st.worn[p.key] = true;
      ev.push({ type: 'wear', item: p.key });
    }
  }
  // 눈 더미
  for (const p of st.piles) {
    if (!p.done && dist(st.px, st.pz, p.x, p.z) < 1.4) {
      p.done = true;
      st.snowman += 1;
      ev.push({ type: 'pile', n: st.snowman });
    }
  }

  // 체온
  st.temp = Math.max(0, Math.min(100, st.temp - dropRate(st) * dt));
  if (st.temp <= 0) {
    // 게임오버 없이 쉼터로
    st.px = SHELTER.x + 1;
    st.pz = SHELTER.z + 1;
    st.temp = 55;
    ev.push({ type: 'cold' });
  }

  if (st.level !== 'ga') {
    // 눈싸움: 장갑을 낀 뒤에 눈덩이가 날아온다
    if (st.ballFlight !== null) {
      st.ballFlight -= dt;
      if (st.ballFlight <= 0) {
        st.ballFlight = null;
        st.ballsHit += 1;
        if (st.worn.gloves && !st.wet) {
          st.wet = true;
          ev.push({ type: 'wet' });
        }
      }
    } else if (st.worn.gloves && !st.wet && st.ballsHit < 2 && !st.inShelter) {
      st.ballT += dt;
      if (st.ballT > 7) {
        st.ballT = 0;
        st.ballFlight = 0.9;
        ev.push({ type: 'ball' });
      }
    }
    // 몸 이상 신호
    if (!st.shiver && !st.shiverDone && st.temp < 62 && !st.inShelter) {
      st.shiver = { t: 0 };
      ev.push({ type: 'shiver' });
    }
    if (st.shiver) {
      st.shiver.t += dt;
      if (st.shiver.t > SIGNAL_SECONDS) {
        st.shiver = null;
        st.shiverDone = true;
        st.adultT = 0;
        st.temp = Math.min(100, st.temp + 25);
        ev.push({ type: 'shiverMissed' });
        ev.push({ type: 'adult' });
      }
    }
    // 동상 신호 (다)
    if (st.level === 'da' && st.shiverDone && !st.frost && !st.frostDone && st.temp < 48 && !st.inShelter) {
      st.frost = true;
      ev.push({ type: 'frost' });
    }
  }
  if (st.adultT !== null) {
    st.adultT += dt;
    if (st.adultT > 3) st.adultT = null;
  }

  if (canWin(st)) {
    st.won = true;
    ev.push({ type: 'win' });
  }
  return ev;
}

export function callAdult(st: SnowState): SnowEvent[] {
  if (!st.shiver) return [];
  st.shiver = null;
  st.shiverDone = true;
  st.adultT = 0;
  st.temp = Math.min(100, st.temp + 25);
  return [{ type: 'adult' }];
}

export function changeGloves(st: SnowState): SnowEvent[] {
  if (!st.inShelter || !st.wet) return [];
  st.wet = false;
  st.changes += 1;
  return [{ type: 'changed' }];
}

export function frostChoice(st: SnowState, choice: 'rub' | 'warm'): SnowEvent[] {
  if (!st.frost) return [];
  if (choice === 'rub') return [{ type: 'frostWrong' }];
  st.frost = false;
  st.frostDone = true;
  st.temp = Math.min(100, st.temp + 25);
  return [{ type: 'frostOk' }];
}

export function setPlayer(st: SnowState, x: number, z: number): void {
  st.px = x;
  st.pz = z;
}
