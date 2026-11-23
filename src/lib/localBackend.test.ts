import { describe, expect, it } from 'vitest';
import { createLocalBackend } from './localBackend';

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('이 태블릿 저장 모드(localBackend)', () => {
  it('학급 → 학생 → 로그인 → 진행·장비 저장 → 다시 불러오기', async () => {
    const store = new MemStorage();
    const be = createLocalBackend(store);
    const cls = await be.createClass('1반');
    expect(cls.class_code).toMatch(/^[A-Z2-9]{6}$/);
    await be.addStudent(cls.id, '토리', 'bear', '0123', 'na');

    const roster = await be.listRoster(cls.class_code.toLowerCase());
    expect(roster).toHaveLength(1);
    expect(roster![0]).not.toHaveProperty('pin_hash');
    expect(await be.listRoster('ZZZZZZ')).toBeNull();

    expect(await be.studentLogin(roster![0].id, '9999')).toBeNull();
    const snap = await be.studentLogin(roster![0].id, '0123');
    expect(snap?.student.level).toBe('na');
    expect(snap?.student).not.toHaveProperty('pin_hash');

    await be.recordProgress('obi', 'na', true, 2);
    await be.recordProgress('obi', 'na', true, 3);
    await be.grantItems(['shoes']);
    await be.setEquipped({ shoes: true });
    await be.logMistakes('obi', 'na', ['run_on_ice']);

    // 다른 '태블릿'(새 인스턴스, 같은 저장소)에서 로그인해도 그대로
    const be2 = createLocalBackend(store);
    const again = await be2.restoreStudent();
    expect(again?.inventory).toEqual(['shoes']);
    expect(again?.progress[0]).toMatchObject({ game_key: 'obi', cleared: true, stars: 3, play_count: 2 });
    expect(again?.student.equipped).toEqual({ shoes: true });

    const ov = await be2.classOverview(cls.id);
    expect(ov.mistakes[0].mistake_key).toBe('run_on_ice');
    expect(JSON.stringify(store.m.get('svs.local.db.v1'))).not.toContain('0123');
  });

  it('교사가 수준을 바꾸면 다음 로그인부터 바뀐 수준', async () => {
    const be = createLocalBackend(new MemStorage());
    const cls = await be.createClass('2반');
    await be.addStudent(cls.id, '모모', 'cat', '4567', 'ga');
    const id = (await be.listRoster(cls.class_code))![0].id;
    await be.setStudentLevel(id, 'da');
    expect((await be.studentLogin(id, '4567'))?.student.level).toBe('da');
  });

  it('그림 비밀번호는 그림 4개(0~7)만 허용', async () => {
    const be = createLocalBackend(new MemStorage());
    const cls = await be.createClass('3반');
    await expect(be.addStudent(cls.id, '나쁜', 'cat', '12', 'ga')).rejects.toThrow();
    await expect(be.addStudent(cls.id, '나쁜', 'cat', '9999', 'ga')).rejects.toThrow();
  });
});
