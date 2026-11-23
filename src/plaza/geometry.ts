import { GAMES } from '../data/games';
import { GameKey } from '../data/types';

export const PLAZA_BOUNDS = { x: 15, z: 12 };

/** 걸어서 지나갈 수 없는 둥근 장애물 [x, z, 반지름] */
export const OBSTACLES: [number, number, number][] = [
  [0, 0, 2.6],
  ...GAMES.map((g) => [g.pos[0], g.pos[1], 2.4] as [number, number, number]),
];

export function clampToPlaza(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(-PLAZA_BOUNDS.x, Math.min(PLAZA_BOUNDS.x, x)),
    z: Math.max(-PLAZA_BOUNDS.z, Math.min(PLAZA_BOUNDS.z, z)),
  };
}

/** 장애물 안으로 들어갔으면 밖으로 밀어낸다 */
export function pushOut(p: { x: number; z: number }): void {
  for (const [ox, oz, r] of OBSTACLES) {
    const dx = p.x - ox;
    const dz = p.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < r) {
      const k = d < 0.001 ? 1 : r / d;
      p.x = ox + (d < 0.001 ? r : dx * k);
      p.z = oz + (d < 0.001 ? 0 : dz * k);
    }
  }
}

/** 입구 발판: 건물 앞(광장 가운데 쪽) */
export function doorPad(g: GameKey): [number, number] {
  const game = GAMES.find((x) => x.key === g)!;
  const [x, z] = game.pos;
  const d = Math.hypot(x, z);
  const k = (d - 3.4) / d;
  return [x * k, z * k];
}
