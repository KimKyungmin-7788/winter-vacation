import { describe, expect, it } from 'vitest';
import {
  activeHazards, buy, drillPress, initGame, pickUp, place, removeDevice, roomReady, startHolding, storeHeld, tick, togglePower, tryOut, vent, warmth,
} from './logic';

describe('타이쿤 위험 판정', () => {
  it('가: 처음에 위험이 2가지 (커튼 옆 히터, 문어발)', () => {
    const g = initGame('ga');
    const keys = activeHazards(g).map((h) => h.key).sort();
    expect(keys).toEqual(['heater_near_curtain', 'octopus_outlet']);
    expect(warmth(g)).toBe(0);
  });
  it('나·다: 위험 4가지', () => {
    expect(activeHazards(initGame('na')).map((h) => h.key).sort()).toEqual(['heater_near_blanket', 'heater_near_curtain', 'heater_near_laundry', 'octopus_outlet']);
    expect(new Set(activeHazards(initGame('da')).map((h) => h.key)).size).toBe(4);
  });

  it('가: 히터를 멀리 옮기고 콘센트를 나누면 안전해지고, 히터를 더 놓고 가구를 사면 끝', () => {
    const g = initGame('ga');
    pickUp(g, 1);
    let ev = place(g, 2, 3);
    expect(ev.map((e) => e.type)).toContain('fixed');
    pickUp(g, 4); // 주전자는 넣어 둔다
    ev = storeHeld(g);
    expect(activeHazards(g)).toEqual([]);
    expect(g.coins).toBe(4);
    expect(startHolding(g, 'heater')).toBe(true);
    ev = place(g, 0, 2);
    expect(warmth(g)).toBeGreaterThanOrEqual(4);
    expect(g.phase).toBe('room'); // 아직 가구를 안 샀다
    expect(buy(g, 'rug')).toBe(true);
    expect(roomReady(g)).toBe(true);
    
  });

  it('새로 위험하게 놓으면 hazard 이벤트', () => {
    const g = initGame('ga');
    startHolding(g, 'heater');
    const ev = place(g, 0, 1); // 커튼(1,0) 옆
    expect(ev).toContainEqual({ type: 'hazard', key: 'heater_near_curtain' });
  });

  it('같은 자리에 도로 놓으면 고침 보너스/실수가 생기지 않는다', () => {
    const g = initGame('ga');
    pickUp(g, 1);
    const ev = place(g, 2, 0);
    expect(ev).toEqual([]);
  });

  it('코인은 안전하고 따뜻할 때만 쌓인다', () => {
    const g = initGame('ga');
    tick(g, 30);
    expect(g.coins).toBe(0);
    removeDevice(g, 1);
    removeDevice(g, 4);
    startHolding(g, 'heater');
    place(g, 2, 2);
    startHolding(g, 'heater');
    place(g, 0, 3);
    expect(warmth(g)).toBeGreaterThanOrEqual(3);
    const before = g.coins;
    tick(g, 5);
    expect(g.coins).toBeGreaterThan(before);
  });

  it('나: 외출할 때 난방기가 켜져 있으면 실수, 끄면 통과', () => {
    const g = initGame('na');
    g.phase = 'out';
    expect(tryOut(g)).toEqual([{ type: 'leftOn' }]);
    g.devices.forEach((d) => togglePower(g, d.id));
    expect(tryOut(g)).toContainEqual({ type: 'phase', phase: 'done' });
  });

  it('다: 난로를 쓰면 공기가 나빠지고 환기하면 리셋', () => {
    const g = initGame('da');
    for (let i = 0; i < 4; i++) tick(g, 9.1);
    expect(g.air).toBe(4);
    vent(g);
    expect(g.air).toBe(0);
    const evs = [];
    for (let i = 0; i < 5; i++) evs.push(...tick(g, 9.1));
    expect(evs.some((e) => e.type === 'noVent')).toBe(true);
  });

  it('다: 대피 순서 알리기→낮은 자세→밖으로→119', () => {
    const g = initGame('da');
    g.phase = 'drill';
    expect(drillPress(g, 'call')).toEqual([{ type: 'drillWrong' }]);
    drillPress(g, 'tell');
    drillPress(g, 'low');
    drillPress(g, 'out');
    expect(drillPress(g, 'call')).toContainEqual({ type: 'phase', phase: 'done' });
  });
});
