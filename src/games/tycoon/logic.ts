import type { Level } from '../../data/types';

export const COLS = 6;
export const ROWS = 4;

export type DevKind = 'heater' | 'stove' | 'mat' | 'lamp' | 'kettle';
export type FlamKind = 'curtain' | 'laundry' | 'blanket';
export type HazardKey = 'heater_near_curtain' | 'heater_near_laundry' | 'heater_near_blanket' | 'octopus_outlet';
export type DecorKind = 'rug' | 'plant' | 'picture';

export interface Dev {
  id: number;
  kind: DevKind;
  x: number;
  z: number;
  on: boolean;
}
export interface Flam {
  kind: FlamKind;
  x: number;
  z: number;
}

export const HEAT: Record<DevKind, number> = { heater: 2, stove: 3, mat: 1, lamp: 0, kettle: 0 };
export const IS_HEATER: Record<DevKind, boolean> = { heater: true, stove: true, mat: false, lamp: false, kettle: false };
export const SHOP: { kind: DecorKind; cost: number }[] = [
  { kind: 'rug', cost: 3 },
  { kind: 'plant', cost: 3 },
  { kind: 'picture', cost: 2 },
];
export const DECOR_SPOTS: [number, number][] = [[5, 3], [3, 3], [0, 0], [5, 0]];
export const COIN_EVERY = 2.2;
export const AIR_EVERY = 9;
export const AIR_MAX = 5;
export const DRILL_ORDER = ['tell', 'low', 'out', 'call'] as const;
export type DrillStep = (typeof DRILL_ORDER)[number];

export type Phase = 'room' | 'out' | 'drill' | 'done';

export interface Hazard {
  sig: string;
  key: HazardKey;
  devIds: number[];
}

export interface TycoonGame {
  level: Level;
  devices: Dev[];
  flams: Flam[];
  decor: { kind: DecorKind; x: number; z: number }[];
  coins: number;
  held: Dev | null;
  nextId: number;
  baseline: string[];
  initialHazards: number;
  fixedCount: number;
  coinT: number;
  air: number;
  airT: number;
  ventCount: number;
  phase: Phase;
  drillStep: number;
  leftOn: boolean;
  placedHeaters: number;
}

export type TycoonEvent =
  | { type: 'hazard'; key: HazardKey }
  | { type: 'fixed' }
  | { type: 'coin' }
  | { type: 'noVent' }
  | { type: 'leftOn' }
  | { type: 'phase'; phase: Phase }
  | { type: 'drillOk'; step: number }
  | { type: 'drillWrong' };

export function zoneOf(x: number): 'L' | 'R' {
  return x < COLS / 2 ? 'L' : 'R';
}

function dev(id: number, kind: DevKind, x: number, z: number): Dev {
  return { id, kind, x, z, on: true };
}

export function initGame(level: Level): TycoonGame {
  const flams: Flam[] = [{ kind: 'curtain', x: 1, z: 0 }];
  let devices: Dev[];
  if (level === 'ga') {
    devices = [dev(1, 'heater', 2, 0), dev(2, 'mat', 4, 1), dev(3, 'lamp', 5, 1), dev(4, 'kettle', 4, 2)];
  } else if (level === 'na') {
    flams.push({ kind: 'laundry', x: 4, z: 0 }, { kind: 'blanket', x: 0, z: 2 });
    devices = [dev(1, 'heater', 2, 0), dev(2, 'heater', 3, 1), dev(3, 'heater', 0, 3), dev(4, 'mat', 4, 2), dev(5, 'lamp', 5, 1), dev(6, 'kettle', 5, 2)];
  } else {
    flams.push({ kind: 'laundry', x: 4, z: 0 }, { kind: 'blanket', x: 0, z: 2 });
    devices = [dev(1, 'heater', 2, 0), dev(2, 'heater', 3, 1), dev(3, 'stove', 0, 3), dev(4, 'mat', 4, 2), dev(5, 'lamp', 5, 1), dev(6, 'kettle', 5, 2)];
  }
  const g: TycoonGame = {
    level,
    devices,
    flams,
    decor: [],
    coins: 0,
    held: null,
    nextId: 100,
    baseline: [],
    initialHazards: 0,
    fixedCount: 0,
    coinT: 0,
    air: 0,
    airT: 0,
    ventCount: 0,
    phase: 'room',
    drillStep: 0,
    leftOn: false,
    placedHeaters: 0,
  };
  const hz = activeHazards(g);
  g.baseline = hz.map((h) => h.sig);
  g.initialHazards = hz.length;
  return g;
}

const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.z - b.z) <= 1;

export function activeHazards(g: TycoonGame): Hazard[] {
  const out: Hazard[] = [];
  const on = g.devices.filter((d) => d.on);
  for (const d of on) {
    if (!IS_HEATER[d.kind]) continue;
    for (const f of g.flams) {
      if (near(d, f)) out.push({ sig: `${d.id}:${f.kind}`, key: `heater_near_${f.kind}` as HazardKey, devIds: [d.id] });
    }
  }
  for (const zone of ['L', 'R'] as const) {
    const inZone = on.filter((d) => zoneOf(d.x) === zone);
    if (inZone.length >= 3) out.push({ sig: `octopus:${zone}`, key: 'octopus_outlet', devIds: inZone.map((d) => d.id) });
  }
  return out;
}

export function warmth(g: TycoonGame): number {
  const bad = new Set(activeHazards(g).flatMap((h) => h.devIds));
  const total = g.devices.filter((d) => d.on && !bad.has(d.id)).reduce((s, d) => s + HEAT[d.kind], 0);
  return Math.min(5, total);
}

export function cellFree(g: TycoonGame, x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= COLS || z >= ROWS) return false;
  return (
    !g.devices.some((d) => d.x === x && d.z === z) &&
    !g.flams.some((f) => f.x === x && f.z === z) &&
    !g.decor.some((d) => d.x === x && d.z === z)
  );
}

/** 놓기·치우기·전원 뒤에 위험 목록을 견주어 '고쳤다/새로 생겼다'를 알린다 */
function diff(g: TycoonGame, events: TycoonEvent[], fromStudentAction = true): void {
  const now = activeHazards(g);
  const nowSigs = now.map((h) => h.sig);
  const gone = g.baseline.filter((s) => !nowSigs.includes(s));
  if (gone.length) {
    g.fixedCount += gone.length;
    g.coins = Math.min(9, g.coins + 2);
    events.push({ type: 'fixed' });
  }
  if (fromStudentAction) {
    for (const h of now) if (!g.baseline.includes(h.sig)) events.push({ type: 'hazard', key: h.key });
  }
  g.baseline = nowSigs;
}

export function pickUp(g: TycoonGame, id: number): void {
  if (g.held) return;
  const d = g.devices.find((x) => x.id === id);
  if (!d) return;
  g.devices = g.devices.filter((x) => x.id !== id);
  g.held = d;
}

export function startHolding(g: TycoonGame, kind: DevKind): boolean {
  if (g.held) return false;
  if (kind === 'heater' && g.devices.filter((d) => d.kind === 'heater').length + 0 >= 4) return false;
  g.held = { id: g.nextId++, kind, x: -1, z: -1, on: true };
  return true;
}

export function cancelHolding(g: TycoonGame, events: TycoonEvent[] = []): void {
  // 집어든 기구를 놓을 자리가 없을 때 처음 자리로: 단순히 빈 자리 중 첫 곳
  if (!g.held) return;
  const h = g.held;
  g.held = null;
  if (h.x >= 0 && cellFree(g, h.x, h.z)) g.devices.push(h);
  else outer: for (let z = ROWS - 1; z >= 0; z--) for (let x = 0; x < COLS; x++) if (cellFree(g, x, z)) { g.devices.push({ ...h, x, z }); break outer; }
  diff(g, events);
}

export function place(g: TycoonGame, x: number, z: number): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  if (!g.held || !cellFree(g, x, z)) return events;
  const d = { ...g.held, x, z };
  g.devices.push(d);
  g.held = null;
  diff(g, events);
  checkProgress(g, events);
  return events;
}

/** 집어든 기구를 상자에 넣어 둔다(치우기) */
export function storeHeld(g: TycoonGame): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  if (!g.held) return events;
  g.held = null;
  diff(g, events);
  checkProgress(g, events);
  return events;
}

export function removeDevice(g: TycoonGame, id: number): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  g.devices = g.devices.filter((d) => d.id !== id);
  diff(g, events);
  checkProgress(g, events);
  return events;
}

export function togglePower(g: TycoonGame, id: number): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  const d = g.devices.find((x) => x.id === id);
  if (!d) return events;
  d.on = !d.on;
  if (g.phase === 'out' && g.devices.every((x) => !x.on)) g.leftOn = false;
  diff(g, events);
  checkProgress(g, events);
  return events;
}

export function buy(g: TycoonGame, kind: DecorKind): boolean {
  const item = SHOP.find((s) => s.kind === kind);
  if (!item || g.coins < item.cost || g.decor.some((d) => d.kind === kind)) return false;
  const spot = DECOR_SPOTS.find(([x, z]) => cellFree(g, x, z));
  if (!spot) return false;
  g.coins -= item.cost;
  g.decor.push({ kind, x: spot[0], z: spot[1] });
  return true;
}

export function vent(g: TycoonGame): void {
  g.air = 0;
  g.airT = 0;
  g.ventCount += 1;
}

export function roomReady(g: TycoonGame): boolean {
  if (g.held) return false;
  const base =
    activeHazards(g).length === 0 &&
    g.fixedCount >= Math.min(g.initialHazards, 2) &&
    warmth(g) >= 4 &&
    g.decor.length >= 1;
  if (g.level === 'da') return base && g.ventCount >= 1;
  return base;
}

export function checkProgress(g: TycoonGame, events: TycoonEvent[]): void {
  if (g.phase !== 'room') return;
  if (!roomReady(g)) return;
  g.phase = g.level === 'ga' ? 'done' : g.level === 'na' ? 'out' : 'drill';
  events.push({ type: 'phase', phase: g.phase });
}

export function tick(g: TycoonGame, dt: number): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  if (g.phase !== 'room' && g.phase !== 'out') return events;
  checkProgress(g, events); // 가게에서 산 뒤·환기한 뒤에도 끝났는지 본다
  if (g.phase !== 'room' && g.phase !== 'out') return events;
  if (g.phase === 'room' && activeHazards(g).length === 0 && warmth(g) >= 3 && g.coins < 9) {
    g.coinT += dt;
    if (g.coinT >= COIN_EVERY) {
      g.coinT = 0;
      g.coins += 1;
      events.push({ type: 'coin' });
    }
  }
  if (g.level === 'da' && g.phase === 'room' && g.devices.some((d) => d.kind === 'stove' && d.on)) {
    g.airT += dt;
    if (g.airT >= AIR_EVERY) {
      g.airT = 0;
      g.air += 1;
      if (g.air >= AIR_MAX) {
        g.air = 0;
        events.push({ type: 'noVent' });
      }
    }
  }
  return events;
}

/** 외출 */
export function tryOut(g: TycoonGame): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  if (g.phase !== 'out') return events;
  if (g.devices.some((d) => d.on && (IS_HEATER[d.kind] || d.kind === 'mat'))) {
    g.leftOn = true;
    events.push({ type: 'leftOn' });
    return events;
  }
  g.phase = 'done';
  events.push({ type: 'phase', phase: 'done' });
  return events;
}

export function drillPress(g: TycoonGame, step: DrillStep): TycoonEvent[] {
  const events: TycoonEvent[] = [];
  if (g.phase !== 'drill') return events;
  if (DRILL_ORDER[g.drillStep] === step) {
    g.drillStep += 1;
    events.push({ type: 'drillOk', step: g.drillStep });
    if (g.drillStep >= DRILL_ORDER.length) {
      g.phase = 'done';
      events.push({ type: 'phase', phase: 'done' });
    }
  } else {
    g.drillStep = 0;
    events.push({ type: 'drillWrong' });
  }
  return events;
}
