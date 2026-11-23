import { describe, expect, it } from 'vitest';
import { callOut, dialPress, fallChoice, initPatrol, onIce, pickPlace, resolvedCount, selectKid, targets, tickPatrol } from './logic';

function clearAll(st: ReturnType<typeof initPatrol>) {
  for (const k of targets(st)) {
    if (k.state !== 'onIce') continue;
    selectKid(st, k.id, k.x, k.z + 2);
    callOut(st);
  }
  for (let i = 0; i < 40; i++) tickPatrol(st, 0.1);
}

describe('순찰대', () => {
  it('가: 얼음 위 아이를 모두 불러내면 끝 (땅 위 아이는 안전)', () => {
    const st = initPatrol('ga');
    expect(targets(st).length).toBe(4);
    const bankKid = st.kids.find((k) => k.zone === 'bank')!;
    selectKid(st, bankKid.id, bankKid.x, bankKid.z);
    expect(callOut(st)).toEqual([{ type: 'bank' }]);
    let won = false;
    for (const k of targets(st)) {
      selectKid(st, k.id, k.x, k.z);
      callOut(st);
    }
    for (let i = 0; i < 40; i++) if (tickPatrol(st, 0.1).some((e) => e.type === 'win')) won = true;
    expect(won).toBe(true);
    expect(resolvedCount(st)).toBe(4);
  });
  it('너무 멀면 부를 수 없다', () => {
    const st = initPatrol('ga');
    const k = targets(st)[0];
    expect(selectKid(st, k.id, k.x + 30, k.z)).toEqual([{ type: 'far' }]);
  });
  it('동료가 한 명을 대신 불러 준다', () => {
    const st = initPatrol('ga');
    const ev = [];
    for (let i = 0; i < 300; i++) ev.push(...tickPatrol(st, 0.1));
    expect(ev.filter((e) => e.type === 'buddy').length).toBe(1);
  });
  it('나: 물에 빠지면 들어가기는 실수, 소리치고 119', () => {
    const st = initPatrol('na');
    clearAll(st);
    expect(st.phase).toBe('fall');
    expect(fallChoice(st, 'enter')).toEqual([{ type: 'goIn' }]);
    expect(st.phase).toBe('fall');
    fallChoice(st, 'shout');
    expect(dialPress(st, '1')).toEqual([]);
    expect(dialPress(st, '9')).toEqual([{ type: 'wrongNumber' }]);
    dialPress(st, '1');
    dialPress(st, '1');
    const ev = dialPress(st, '9');
    expect(ev.map((e) => e.type)).toEqual(['dialOk', 'win']);
    expect(st.phase).toBe('done');
  });
  it('다: 썰매장 아이는 부르면 안 되고, 마지막에 위치를 골라야 한다', () => {
    const st = initPatrol('da');
    const sled = st.kids.find((k) => k.zone === 'sled')!;
    selectKid(st, sled.id, sled.x, sled.z);
    expect(callOut(st)).toEqual([{ type: 'sled' }]);
    expect(sled.state).toBe('onIce');
    clearAll(st);
    expect(st.phase).toBe('fall');
    fallChoice(st, 'shout');
    '119'.split('').forEach((d) => dialPress(st, d));
    expect(st.phase).toBe('place');
    expect(pickPlace(st, 'bridge')).toEqual([{ type: 'placeWrong' }]);
    expect(pickPlace(st, 'tree')).toEqual([{ type: 'win' }]);
  });
  it('얼음 위는 걸을 수 없는 곳', () => {
    expect(onIce(0, 0)).toBe(true);
    expect(onIce(0, 5)).toBe(false);
  });
});
