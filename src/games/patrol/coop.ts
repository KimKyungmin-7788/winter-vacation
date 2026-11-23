import type { PatrolState } from './logic';

/** 순찰대 함께 하기: 반 친구들이 같은 맵에서 순찰 점수 하나를 채운다 */
export type CoopMsg =
  | { t: 'pos'; id: string; x: number; z: number; ch: string; nick: string }
  | { t: 'out'; kid: number }
  | { t: 'hello'; id: string }
  | { t: 'sync'; done: number[] };

export function isCoopMsg(m: unknown): m is CoopMsg {
  return !!m && typeof m === 'object' && typeof (m as { t?: unknown }).t === 'string';
}

/** 친구가 불러낸 아이를 내 화면에도 반영. 새로 반영했으면 true */
export function applyRemoteOut(st: PatrolState, kidId: number): boolean {
  const k = st.kids.find((x) => x.id === kidId);
  if (!k || !k.isTarget || k.state !== 'onIce') return false;
  k.state = 'leaving';
  k.leaveT = 0;
  k.by = 'buddy';
  if (st.selected === k.id) st.selected = null;
  return true;
}

export function doneKids(st: PatrolState): number[] {
  return st.kids.filter((k) => k.isTarget && k.state !== 'onIce').map((k) => k.id);
}
