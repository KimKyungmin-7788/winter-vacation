import type { Level } from '../../data/types';

export type SegType = 'road' | 'ice' | 'stairs' | 'cross';
export interface Seg {
  type: SegType;
  len: number;
  dir: 'x' | 'z';
  /** 눈속임: 그늘만 있는 마른 길 / 햇볕 아래 물웅덩이 (둘 다 안전) */
  decor?: 'dryShade' | 'wetSun';
  start: number;
}
export interface Course {
  level: Level;
  segs: Seg[];
  length: number;
  checkpoints: number[];
}

export const WALK_SPEED = 2.4;
export const RUN_SPEED = 6;
export const SLIP_SPEED = 3.2;
export const ICE_FRICTION = 0.06;
export const CAR_STOP_SECONDS = 4;
export const SLIP_SECONDS = 1.1;

type Raw = [SegType, number, 'x' | 'z', Seg['decor']?];

const COURSES: Record<Level, Raw[]> = {
  ga: [
    ['road', 8, 'x'],
    ['ice', 6, 'x'],
    ['road', 7, 'x'],
    ['road', 5, 'z'],
    ['ice', 6, 'z'],
    ['road', 8, 'z'],
  ],
  na: [
    ['road', 6, 'x'],
    ['ice', 5, 'x'],
    ['road', 5, 'x'],
    ['stairs', 5, 'x'],
    ['road', 5, 'x'],
    ['road', 4, 'z'],
    ['cross', 5, 'z'],
    ['road', 4, 'z'],
    ['ice', 5, 'z'],
    ['road', 6, 'z'],
  ],
  da: [
    ['road', 5, 'x'],
    ['road', 4, 'x', 'dryShade'],
    ['ice', 5, 'x'],
    ['road', 4, 'x', 'wetSun'],
    ['stairs', 5, 'x'],
    ['road', 4, 'x'],
    ['road', 3, 'z'],
    ['cross', 5, 'z'],
    ['road', 3, 'z'],
    ['ice', 5, 'z'],
    ['road', 4, 'z', 'dryShade'],
    ['ice', 4, 'z'],
    ['road', 6, 'z'],
  ],
};

export function buildCourse(level: Level): Course {
  let s = 0;
  const segs: Seg[] = COURSES[level].map(([type, len, dir, decor]) => {
    const seg: Seg = { type, len, dir, decor, start: s };
    s += len;
    return seg;
  });
  // 체크포인트: 출발점, 그리고 위험 구간(빙판·계단·건널목) 바로 앞
  const checkpoints = [0];
  segs.forEach((seg, i) => {
    if (i > 0 && seg.type !== 'road' && segs[i - 1].type === 'road') checkpoints.push(Math.max(0, seg.start - 2.5));
  });
  return { level, segs, length: s, checkpoints };
}

export function segIndexAt(course: Course, s: number): number {
  for (let i = course.segs.length - 1; i >= 0; i--) if (s >= course.segs[i].start) return i;
  return 0;
}

/** 길 위 위치 s → 세계 좌표 */
export function worldAt(course: Course, s: number): { x: number; z: number; heading: number } {
  let x = 0;
  let z = 0;
  const clamped = Math.max(0, Math.min(course.length, s));
  for (const seg of course.segs) {
    const run = Math.min(seg.len, Math.max(0, clamped - seg.start));
    if (seg.dir === 'x') x += run;
    else z += run;
    if (clamped <= seg.start + seg.len) {
      return { x, z, heading: seg.dir === 'x' ? Math.PI / 2 : 0 };
    }
  }
  const last = course.segs[course.segs.length - 1];
  return { x, z, heading: last.dir === 'x' ? Math.PI / 2 : 0 };
}

/** 각 구간의 시작 세계 좌표 */
export function segOrigin(course: Course, idx: number): { x: number; z: number } {
  const w = worldAt(course, course.segs[idx].start);
  return { x: w.x, z: w.z };
}

export type ObiMode = 'idle' | 'walk' | 'run';
export type ObiReason = 'run_on_ice' | 'hands_in_pocket' | 'stairs_no_rail' | 'cross_car';

export interface ObiState {
  s: number;
  v: number;
  mode: ObiMode;
  handsOut: boolean;
  rail: boolean;
  slip: { t: number; v: number; reason: ObiReason } | null;
  waiting: boolean;
  crossing: boolean;
  carT: number;
  carStopped: boolean;
  lastCheckpoint: number;
  warned: number[];
  finished: boolean;
  seg: number;
}

export type ObiEvent =
  | { type: 'warn'; seg: number }
  | { type: 'mistake'; reason: ObiReason }
  | { type: 'respawn' }
  | { type: 'wait' }
  | { type: 'finish' };

export function initObi(course: Course): ObiState {
  return {
    s: 0,
    v: 0,
    mode: 'idle',
    handsOut: course.level === 'ga',
    rail: false,
    slip: null,
    waiting: false,
    crossing: false,
    carT: 0,
    carStopped: false,
    lastCheckpoint: 0,
    warned: [],
    finished: false,
    seg: 0,
  };
}

function startSlip(st: ObiState, reason: ObiReason, events: ObiEvent[], v = 4.5): void {
  st.slip = { t: 0, v: reason === 'cross_car' ? 0 : Math.max(st.v, v), reason };
  st.mode = 'idle';
  events.push({ type: 'mistake', reason });
}

export function stepObi(st: ObiState, dt: number, course: Course): ObiEvent[] {
  const events: ObiEvent[] = [];
  if (st.finished) return events;

  if (st.slip) {
    st.slip.t += dt;
    st.s = Math.min(course.length - 0.01, st.s + st.slip.v * dt);
    st.slip.v *= Math.exp(-2.2 * dt);
    if (st.slip.t >= SLIP_SECONDS) {
      st.s = st.lastCheckpoint;
      st.v = 0;
      st.rail = false;
      st.waiting = false;
      st.crossing = false;
      st.carT = 0;
      st.carStopped = false;
      st.slip = null;
      st.seg = segIndexAt(course, st.s);
      events.push({ type: 'respawn' });
    }
    return events;
  }

  if (st.waiting) {
    st.carT += dt;
    if (st.carT >= CAR_STOP_SECONDS) st.carStopped = true;
    return events;
  }

  const seg = course.segs[st.seg];
  const friction = seg.type === 'ice' ? ICE_FRICTION : 1;
  let target = st.mode === 'run' ? RUN_SPEED : st.mode === 'walk' ? WALK_SPEED : 0;
  if (st.crossing) target = WALK_SPEED;
  if (seg.type === 'stairs') target = Math.min(target, WALK_SPEED);
  st.v += (target - st.v) * Math.min(1, 10 * friction * dt);
  if (Math.abs(st.v) < 0.01) st.v = 0;
  st.s += st.v * dt;

  // 건널목 앞에서는 자동으로 멈춰서 차를 살핀다
  const crossIdx = course.segs.findIndex((x) => x.type === 'cross');
  if (crossIdx >= 0 && !st.crossing && st.seg < crossIdx) {
    const stopAt = course.segs[crossIdx].start - 1.2;
    if (st.s >= stopAt) {
      st.s = stopAt;
      st.v = 0;
      st.mode = 'idle';
      st.waiting = true;
      st.carT = 0;
      st.carStopped = false;
      events.push({ type: 'wait' });
      return events;
    }
  }

  const idx = segIndexAt(course, st.s);
  if (course.level === 'ga') {
    // 가 수준: 빙판에 들어가기 전에 음성으로 알려 준다
    course.segs.forEach((sg, i) => {
      if (sg.type === 'ice' && !st.warned.includes(i) && st.s >= sg.start - 4 && st.s < sg.start) {
        st.warned.push(i);
        events.push({ type: 'warn', seg: i });
      }
    });
  }

  if (idx !== st.seg) {
    const prev = course.segs[st.seg];
    const next = course.segs[idx];
    if (prev.type === 'stairs') st.rail = false;
    if (prev.type === 'cross') {
      st.crossing = false;
      st.carStopped = false;
    }
    st.seg = idx;
    if (next.type === 'ice') {
      if (st.v > SLIP_SPEED) startSlip(st, 'run_on_ice', events);
      else if (!st.handsOut) startSlip(st, 'hands_in_pocket', events, 3.2);
    } else if (next.type === 'stairs') {
      if (!st.rail || !st.handsOut) startSlip(st, st.handsOut ? 'stairs_no_rail' : 'hands_in_pocket', events, 2.6);
    }
  } else if (seg.type === 'ice' && st.v > SLIP_SPEED) {
    startSlip(st, 'run_on_ice', events);
  }

  for (const cp of course.checkpoints) if (st.s >= cp && cp > st.lastCheckpoint) st.lastCheckpoint = cp;
  if (!st.slip && st.s >= course.length) {
    st.s = course.length;
    st.finished = true;
    st.mode = 'idle';
    events.push({ type: 'finish' });
  }
  return events;
}

export function pressCross(st: ObiState): ObiEvent[] {
  const events: ObiEvent[] = [];
  if (!st.waiting || st.slip) return events;
  if (st.carStopped) {
    st.waiting = false;
    st.crossing = true;
    st.mode = 'walk';
  } else {
    startSlip(st, 'cross_car', events);
  }
  return events;
}

export function pressMode(st: ObiState, mode: 'walk' | 'run'): void {
  if (st.slip || st.waiting || st.finished || st.crossing) return;
  st.mode = mode;
}

export function pressHands(st: ObiState): void {
  st.handsOut = true;
}

export function pressRail(st: ObiState): void {
  if (st.slip) return;
  st.rail = !st.rail;
}
