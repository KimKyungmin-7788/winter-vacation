import { describe, expect, it } from 'vitest';
import { applyRemoteOut, doneKids } from './coop';
import { callOut, initPatrol, resolvedCount, selectKid, targets, tickPatrol } from './logic';

describe('순찰대 함께 하기', () => {
  it('친구가 구한 아이가 내 화면에서도 나오고, 둘이 나눠 하면 같이 끝난다', () => {
    const a = initPatrol('ga');
    const b = initPatrol('ga');
    const ts = targets(a);
    // 나(a)는 앞의 2명, 친구(b)는 뒤의 2명을 부른다
    for (const k of ts.slice(0, 2)) {
      selectKid(a, k.id, k.x, k.z);
      callOut(a);
      expect(applyRemoteOut(b, k.id)).toBe(true);
    }
    for (const k of ts.slice(2)) {
      selectKid(b, k.id, k.x, k.z);
      callOut(b);
      expect(applyRemoteOut(a, k.id)).toBe(true);
    }
    const evA: string[] = [];
    const evB: string[] = [];
    for (let i = 0; i < 40; i++) {
      evA.push(...tickPatrol(a, 0.1).map((e) => e.type));
      evB.push(...tickPatrol(b, 0.1).map((e) => e.type));
    }
    expect(evA).toContain('win');
    expect(evB).toContain('win');
    expect(resolvedCount(a)).toBe(4);
  });
  it('이미 나온 아이는 다시 반영되지 않고, 중간에 들어온 친구는 동기화로 따라잡는다', () => {
    const a = initPatrol('ga');
    const late = initPatrol('ga');
    const k = targets(a)[0];
    selectKid(a, k.id, k.x, k.z);
    callOut(a);
    expect(applyRemoteOut(a, k.id)).toBe(false);
    for (const id of doneKids(a)) applyRemoteOut(late, id);
    expect(resolvedCount(late)).toBe(1);
  });
});
