import { describe, expect, it } from 'vitest';
import { buildCourse, initObi, pressCross, pressHands, pressMode, pressRail, stepObi, worldAt, SLIP_SECONDS } from './course';

function run(st: ReturnType<typeof initObi>, c: ReturnType<typeof buildCourse>, secs: number, dt = 0.05) {
  const ev: string[] = [];
  for (let t = 0; t < secs; t += dt) for (const e of stepObi(st, dt, c)) ev.push(e.type === 'mistake' ? `mistake:${e.reason}` : e.type);
  return ev;
}

describe('오비 코스', () => {
  it('가: 천천히 걸으면 끝까지 간다', () => {
    const c = buildCourse('ga');
    const st = initObi(c);
    pressMode(st, 'walk');
    const ev = run(st, c, 60);
    expect(ev).toContain('finish');
    expect(ev.filter((e) => e.startsWith('mistake'))).toEqual([]);
    expect(ev.filter((e) => e === 'warn').length).toBe(2);
  });

  it('가: 빙판에서 뛰면 미끄러져 체크포인트로 돌아간다', () => {
    const c = buildCourse('ga');
    const st = initObi(c);
    pressMode(st, 'run');
    const ev = run(st, c, 4);
    expect(ev).toContain('mistake:run_on_ice');
    run(st, c, SLIP_SECONDS + 0.2);
    expect(st.s).toBe(st.lastCheckpoint);
    expect(st.slip).toBeNull();
  });

  it('가: 마른 길에서 뛰는 건 괜찮다', () => {
    const c = buildCourse('ga');
    const st = initObi(c);
    pressMode(st, 'run');
    const ev = run(st, c, 1.2);
    expect(ev.filter((e) => e.startsWith('mistake'))).toEqual([]);
    expect(st.v).toBeGreaterThan(3.2);
  });

  it('빙판 위에서 갑자기 뛰어도 미끄러진다 (마찰이 낮아서 서서히 빨라짐)', () => {
    const c = buildCourse('ga');
    const st = initObi(c);
    pressMode(st, 'walk');
    run(st, c, 3.6); // 빙판 안쪽
    expect(c.segs[st.seg].type).toBe('ice');
    pressMode(st, 'run');
    const ev = run(st, c, 3);
    expect(ev).toContain('mistake:run_on_ice');
  });

  it('나: 손을 주머니에 넣은 채 빙판에 들어가면 미끄러진다', () => {
    const c = buildCourse('na');
    const st = initObi(c);
    pressMode(st, 'walk');
    const ev = run(st, c, 6);
    expect(ev).toContain('mistake:hands_in_pocket');
  });

  it('나: 손 빼고, 난간 잡고, 차가 멈춘 뒤 건너면 통과', () => {
    const c = buildCourse('na');
    const st = initObi(c);
    pressHands(st);
    pressMode(st, 'walk');
    const stairs = c.segs.findIndex((s) => s.type === 'stairs');
    const ev: string[] = [];
    let railed = false;
    for (let i = 0; i < 4000 && !st.finished; i++) {
      if (!railed && st.s > c.segs[stairs].start - 1.5 && st.seg < stairs) {
        pressRail(st);
        railed = true;
      }
      for (const e of stepObi(st, 0.05, c)) ev.push(e.type === 'mistake' ? `mistake:${e.reason}` : e.type);
      if (st.waiting && st.carStopped) ev.push(...pressCross(st).map((e) => e.type));
    }
    expect(ev.filter((e) => e.startsWith('mistake'))).toEqual([]);
    expect(st.finished).toBe(true);
  });

  it('나: 차가 아직 달리는데 건너면 실수', () => {
    const c = buildCourse('na');
    const st = initObi(c);
    pressHands(st);
    pressMode(st, 'walk');
    const stairs = c.segs.findIndex((s) => s.type === 'stairs');
    let railed = false;
    for (let i = 0; i < 4000 && !st.waiting; i++) {
      if (!railed && st.s > c.segs[stairs].start - 1.5 && st.seg < stairs) {
        pressRail(st);
        railed = true;
      }
      stepObi(st, 0.05, c);
    }
    expect(st.waiting).toBe(true);
    expect(st.carStopped).toBe(false);
    const ev = pressCross(st);
    expect(ev[0]).toEqual({ type: 'mistake', reason: 'cross_car' });
  });

  it('계단에서 난간을 안 잡으면 실수', () => {
    const c = buildCourse('na');
    const st = initObi(c);
    pressHands(st);
    pressMode(st, 'walk');
    const stairs = c.segs.findIndex((s) => s.type === 'stairs');
    let ev: string[] = [];
    for (let i = 0; i < 4000 && !ev.some((e) => e.startsWith('mistake')) && st.seg <= stairs; i++) {
      for (const e of stepObi(st, 0.05, c)) ev.push(e.type === 'mistake' ? `mistake:${e.reason}` : e.type);
      if (c.segs[st.seg].type === 'ice' && st.slip) break;
    }
    expect(ev.some((e) => e === 'mistake:stairs_no_rail' || e === 'mistake:run_on_ice')).toBe(true);
  });

  it('worldAt: 시작은 원점, 끝은 길이만큼 떨어진 곳', () => {
    const c = buildCourse('da');
    expect(worldAt(c, 0)).toMatchObject({ x: 0, z: 0 });
    const e = worldAt(c, c.length);
    expect(Math.abs(e.x) + Math.abs(e.z)).toBeCloseTo(c.length);
  });
});
