import type { Level } from '../../data/types';

export const BOUNDS = { x: 16, z: 9 };
/** 얼어붙은 개울 */
export const ICE = { x0: -17, x1: 17, z0: -3, z1: 3 };
/** 허가된 썰매장(다 수준) */
export const SLED_X1 = -6;
export const REACH = 10;
export const BUDDY_EVERY = 26;
export const LEAVE_SECONDS = 1.6;
export type Place = 'bridge' | 'tree' | 'house';
export const FALL_PLACE: Place = 'tree';
export const PLACES: Place[] = ['bridge', 'tree', 'house'];

export type Zone = 'forbidden' | 'sled' | 'bank';
export interface Kid {
  id: number;
  x: number;
  z: number;
  zone: Zone;
  state: 'onIce' | 'leaving' | 'safe';
  leaveT: number;
  by?: 'me' | 'buddy';
  fall?: boolean;
  /** 찾아서 불러야 하는 아이 (금지 구역 얼음 위) */
  isTarget: boolean;
  character: string;
}

export type Phase = 'search' | 'fall' | 'dial' | 'place' | 'done';

export interface PatrolState {
  level: Level;
  kids: Kid[];
  selected: number | null;
  buddyT: number;
  buddyDone: number;
  phase: Phase;
  dial: string;
  fallKid: Kid | null;
  focus: boolean;
}

export type PatrolEvent =
  | { type: 'selected'; id: number }
  | { type: 'out'; id: number }
  | { type: 'bank' }
  | { type: 'sled' }
  | { type: 'far' }
  | { type: 'buddy'; id: number }
  | { type: 'fall' }
  | { type: 'goIn' }
  | { type: 'shout' }
  | { type: 'wrongNumber' }
  | { type: 'dialOk' }
  | { type: 'placeWrong' }
  | { type: 'iceStep' }
  | { type: 'win' };

const CH = ['bear', 'rabbit', 'cat', 'dog', 'fox', 'penguin'];

function kid(id: number, x: number, z: number, zone: Zone): Kid {
  return { id, x, z, zone, state: zone === 'bank' ? 'safe' : 'onIce', leaveT: 0, isTarget: zone === 'forbidden', character: CH[id % CH.length] };
}

export function initPatrol(level: Level): PatrolState {
  let kids: Kid[];
  if (level === 'ga') {
    kids = [kid(1, -11, -1.5, 'forbidden'), kid(2, -4, 1.5, 'forbidden'), kid(3, 5, -1, 'forbidden'), kid(4, 12, 1.8, 'forbidden'), kid(11, -6, 5.5, 'bank'), kid(12, 8, -5.5, 'bank')];
  } else if (level === 'na') {
    kids = [kid(1, -10, 0, 'forbidden'), kid(2, 2, 1.5, 'forbidden'), kid(3, 11, -1.5, 'forbidden'), kid(11, -3, 5.5, 'bank')];
    kids.push({ ...kid(9, 8, -0.8, 'forbidden'), fall: true, isTarget: false });
  } else {
    kids = [kid(1, -13, 0.5, 'sled'), kid(2, -9.5, -1.5, 'sled'), kid(3, -2, 1.5, 'forbidden'), kid(4, 4.5, -1.2, 'forbidden'), kid(5, 13, 1, 'forbidden'), kid(11, 0, 5.5, 'bank')];
    kids.push({ ...kid(9, 9.5, -1, 'forbidden'), fall: true, isTarget: false });
  }
  // 물에 빠질 아이는 처음에는 얼음 위에 있되 찾기 목록에는 넣지 않는다
  return { level, kids, selected: null, buddyT: 0, buddyDone: 0, phase: 'search', dial: '', fallKid: null, focus: false };
}

/** 찾아서 불러야 하는 아이 */
export function targets(st: PatrolState): Kid[] {
  return st.kids.filter((k) => k.isTarget);
}
export function resolvedCount(st: PatrolState): number {
  return targets(st).filter((k) => k.state !== 'onIce').length;
}

export function selectKid(st: PatrolState, id: number, px: number, pz: number): PatrolEvent[] {
  const k = st.kids.find((x) => x.id === id);
  if (!k || st.phase !== 'search' || k.fall) return [];
  if (Math.hypot(k.x - px, k.z - pz) > REACH) return [{ type: 'far' }];
  st.selected = id;
  return [{ type: 'selected', id }];
}

function nearestBankZ(k: Kid): number {
  return k.z < 0 ? ICE.z0 - 1.2 : ICE.z1 + 1.2;
}

export function callOut(st: PatrolState): PatrolEvent[] {
  if (st.phase !== 'search' || st.selected === null) return [];
  const k = st.kids.find((x) => x.id === st.selected);
  st.selected = null;
  if (!k) return [];
  if (k.zone === 'bank') return [{ type: 'bank' }];
  if (k.zone === 'sled') return [{ type: 'sled' }];
  if (k.state !== 'onIce') return [];
  k.state = 'leaving';
  k.leaveT = 0;
  k.by = 'me';
  return [{ type: 'out', id: k.id }];
}

export function tickPatrol(st: PatrolState, dt: number): PatrolEvent[] {
  const ev: PatrolEvent[] = [];
  for (const k of st.kids) {
    if (k.state === 'leaving') {
      k.leaveT += dt;
      const t = Math.min(1, k.leaveT / LEAVE_SECONDS);
      k.z = k.z + (nearestBankZ(k) - k.z) * Math.min(1, dt * 2.4) ;
      if (t >= 1) {
        k.state = 'safe';
        k.zone = 'bank';
      }
    }
  }
  if (st.phase === 'search') {
    const left = targets(st).filter((k) => k.state === 'onIce');
    // 동료는 한 명만 대신 불러 준다
    if (left.length >= 2 && st.buddyDone < 1) {
      st.buddyT += dt;
      if (st.buddyT >= BUDDY_EVERY) {
        st.buddyT = 0;
        st.buddyDone += 1;
        const k = left[left.length - 1];
        k.state = 'leaving';
        k.leaveT = 0;
        k.by = 'buddy';
        if (st.selected === k.id) st.selected = null;
        ev.push({ type: 'buddy', id: k.id });
      }
    }
    if (targets(st).every((k) => k.state !== 'onIce')) {
      if (st.level === 'ga') {
        if (targets(st).every((k) => k.state === 'safe')) {
          st.phase = 'done';
          ev.push({ type: 'win' });
        }
      } else if (targets(st).every((k) => k.state === 'safe')) {
        st.phase = 'fall';
        st.fallKid = st.kids.find((k) => k.fall) ?? null;
        st.focus = true;
        ev.push({ type: 'fall' });
      }
    }
  }
  return ev;
}

export function fallChoice(st: PatrolState, choice: 'enter' | 'shout'): PatrolEvent[] {
  if (st.phase !== 'fall') return [];
  if (choice === 'enter') return [{ type: 'goIn' }];
  st.phase = 'dial';
  st.dial = '';
  return [{ type: 'shout' }];
}

export function dialPress(st: PatrolState, digit: string): PatrolEvent[] {
  if (st.phase !== 'dial') return [];
  const next = st.dial + digit;
  if (!'119'.startsWith(next)) {
    st.dial = '';
    return [{ type: 'wrongNumber' }];
  }
  st.dial = next;
  if (next === '119') {
    st.dial = '';
    if (st.level === 'da') {
      st.phase = 'place';
      return [{ type: 'dialOk' }];
    }
    st.phase = 'done';
    st.focus = false;
    return [{ type: 'dialOk' }, { type: 'win' }];
  }
  return [];
}

export function pickPlace(st: PatrolState, place: Place): PatrolEvent[] {
  if (st.phase !== 'place') return [];
  if (place !== FALL_PLACE) return [{ type: 'placeWrong' }];
  st.phase = 'done';
  st.focus = false;
  return [{ type: 'win' }];
}

/** 얼음 위로는 걸어갈 수 없다 */
export function onIce(x: number, z: number): boolean {
  return x > ICE.x0 && x < ICE.x1 && z > ICE.z0 && z < ICE.z1;
}
