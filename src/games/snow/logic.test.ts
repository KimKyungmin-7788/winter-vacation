import { describe, expect, it } from 'vitest';
import { callAdult, changeGloves, frostChoice, initSnow, SHELTER, setPlayer, stepSnow, SIGNAL_SECONDS } from './logic';

const run = (st: ReturnType<typeof initSnow>, secs: number, dt = 0.1) => {
  const ev: string[] = [];
  for (let t = 0; t < secs; t += dt) ev.push(...stepSnow(st, dt).map((e) => e.type));
  return ev;
};

describe('체온 지킴이', () => {
  it('옷이 없으면 체온이 더 빨리 내려간다', () => {
    const a = initSnow('ga');
    const b = initSnow('ga');
    b.worn = { hat: true, gloves: true, scarf: true };
    run(a, 10);
    run(b, 10);
    expect(a.temp).toBeLessThan(b.temp);
  });
  it('체온이 0이 되면 게임오버 없이 쉼터로 옮겨진다', () => {
    const st = initSnow('ga');
    st.temp = 1;
    setPlayer(st, 5, 5);
    const ev = run(st, 3);
    expect(ev).toContain('cold');
    expect(st.temp).toBeGreaterThan(0);
  });
  it('쉼터에서는 체온이 오른다', () => {
    const st = initSnow('ga');
    st.temp = 30;
    setPlayer(st, SHELTER.x, SHELTER.z);
    run(st, 2);
    expect(st.temp).toBeGreaterThan(30);
    expect(st.shelterVisits).toBe(1);
  });
  it('가: 옷 3개, 눈 더미 3개, 쉼터 한 번이면 끝', () => {
    const st = initSnow('ga');
    for (const p of [...st.pickups, ...st.piles]) {
      setPlayer(st, p.x, p.z);
      stepSnow(st, 0.1);
    }
    setPlayer(st, SHELTER.x, SHELTER.z);
    const ev = run(st, 0.5);
    expect(ev).toContain('win');
  });
  it('나: 장갑을 끼면 눈덩이에 젖고, 쉼터에서 갈아입을 수 있다', () => {
    const st = initSnow('na');
    st.worn.gloves = true;
    setPlayer(st, 5, 5);
    st.temp = 100;
    const ev = run(st, 9);
    expect(ev).toContain('ball');
    expect(ev).toContain('wet');
    expect(st.wet).toBe(true);
    expect(changeGloves(st)).toEqual([]); // 밖에서는 못 갈아입음
    setPlayer(st, SHELTER.x, SHELTER.z);
    stepSnow(st, 0.1);
    expect(changeGloves(st)).toEqual([{ type: 'changed' }]);
    expect(st.wet).toBe(false);
  });
  it('나: 몸 이상 신호에 어른을 부르면 체온이 오른다. 안 부르면 실수로 기록', () => {
    const a = initSnow('na');
    a.temp = 50;
    setPlayer(a, 5, 5);
    expect(run(a, 0.5)).toContain('shiver');
    const t0 = a.temp;
    expect(callAdult(a)).toEqual([{ type: 'adult' }]);
    expect(a.temp).toBeGreaterThan(t0);
    const b = initSnow('na');
    b.temp = 50;
    setPlayer(b, 5, 5);
    const ev = run(b, SIGNAL_SECONDS + 1);
    expect(ev).toContain('shiverMissed');
  });
  it('다: 동상 손은 문지르면 틀리고, 따뜻하게 녹이면 맞다', () => {
    const st = initSnow('da');
    st.shiverDone = true;
    st.temp = 40;
    setPlayer(st, 5, 5);
    expect(run(st, 0.5)).toContain('frost');
    expect(frostChoice(st, 'rub')).toEqual([{ type: 'frostWrong' }]);
    expect(st.frost).toBe(true);
    expect(frostChoice(st, 'warm')).toEqual([{ type: 'frostOk' }]);
    expect(st.frostDone).toBe(true);
  });
});
