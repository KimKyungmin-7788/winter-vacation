import { describe, expect, it } from 'vitest';
import { VOICE } from './voice';

describe('음성 문구표', () => {
  const entries = Object.entries(VOICE);
  it('문구가 비어 있지 않고 키가 겹치지 않는다', () => {
    expect(entries.length).toBeGreaterThan(100);
    for (const [k, t] of entries) expect(t.trim().length, k).toBeGreaterThan(0);
  });
  it('학생용 문장은 짧다 (한 줄 70자 이내)', () => {
    for (const [k, t] of entries) expect(t.length, `${k}: ${t}`).toBeLessThanOrEqual(70);
  });
  it('모든 미니게임·수준 안내와 실패 이유가 있다', () => {
    for (const g of ['obi', 'tycoon', 'snow', 'patrol']) for (const lv of ['ga', 'na', 'da']) expect(VOICE[`${g}.tip.${lv}` as keyof typeof VOICE], `${g}.tip.${lv}`).toBeTruthy();
    for (const g of ['obi', 'tycoon', 'snow', 'patrol']) {
      expect(VOICE[`rule.${g}` as keyof typeof VOICE]).toBeTruthy();
      expect(VOICE[`learned.${g}` as keyof typeof VOICE]).toBeTruthy();
    }
  });
});
