import { MutableRefObject, useCallback, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';

const E2E = typeof window !== 'undefined' && /[?&]e2e/.test(window.location.search);

interface Opts {
  avatar: MutableRefObject<Group | null>;
  start: [number, number];
  speed?: number;
  bounds: { x: number; z: number };
  /** 다음 칸으로 가도 되는지. false면 멈춘다 */
  canStand?: (x: number, z: number) => boolean;
  onBlocked?: (x: number, z: number) => void;
  /** 매 프레임 위치 알림 */
  onMove?: (x: number, z: number) => void;
  frozen?: boolean;
}

/** 터치한 곳으로 걸어가는 이동 */
export function useWalker({ avatar, start, speed = 6, bounds, canStand, onBlocked, onMove, frozen }: Opts) {
  const pos = useRef(new Vector3(start[0], 0, start[1]));
  const target = useRef<Vector3 | null>(null);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);
  const follow = useRef<Vector3 | null>(new Vector3(start[0], 0, start[1]));

  const go = useCallback(
    (p: { x: number; z: number }) => {
      target.current = new Vector3(Math.max(-bounds.x, Math.min(bounds.x, p.x)), 0, Math.max(-bounds.z, Math.min(bounds.z, p.z)));
    },
    [bounds.x, bounds.z],
  );
  const teleport = useCallback((x: number, z: number) => {
    pos.current.set(x, 0, z);
    target.current = null;
  }, []);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const a = avatar.current;
    if (!a) return;
    let moving = false;
    const t = target.current;
    if (t && !frozen) {
      const dx = t.x - pos.current.x;
      const dz = t.z - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) target.current = null;
      else {
        const step = Math.min(d, speed * dt);
        const nx = pos.current.x + (dx / d) * step;
        const nz = pos.current.z + (dz / d) * step;
        if (canStand && !canStand(nx, nz)) {
          target.current = null;
          onBlocked?.(nx, nz);
        } else {
          pos.current.x = nx;
          pos.current.z = nz;
          a.rotation.y = Math.atan2(dx, dz);
          moving = true;
        }
      }
    }
    a.position.set(pos.current.x, 0, pos.current.z);
    onMove?.(pos.current.x, pos.current.z);
    follow.current = new Vector3(pos.current.x, 0, pos.current.z);
    if (E2E) (window as unknown as { __e2e?: Record<string, unknown> }).__e2e = { ...((window as unknown as { __e2e?: Record<string, unknown> }).__e2e ?? {}), pos: { x: pos.current.x, z: pos.current.z, moving: target.current !== null } };
    if (moving !== walkingRef.current) {
      walkingRef.current = moving;
      setWalking(moving);
    }
  });
  return { go, teleport, pos, walking, follow };
}
