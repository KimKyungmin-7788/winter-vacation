import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CHARACTER_BY_KEY } from '../data/items';
import type { Equipped } from '../data/types';

interface Props {
  character: string;
  equipped?: Equipped;
  walking?: boolean;
  /** 어두운 표정/떨림 등 상태 */
  shivering?: boolean;
  handsInPocket?: boolean;
  /** 장갑 색을 젖은 색으로 */
  wetGloves?: boolean;
  scale?: number;
  /** 팔 번쩍(구조 요청 등) */
  armsUp?: boolean;
}

const Box = ({
  p,
  s,
  c,
  r,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  r?: [number, number, number];
}) => (
  <mesh position={p} rotation={r}>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} flatShading />
  </mesh>
);

/** 상자를 조합해 만든 캐릭터. 발바닥이 y=0 */
export const Avatar = forwardRef<Group, Props>(function Avatar(
  { character, equipped = {}, walking = false, shivering = false, handsInPocket = false, wetGloves = false, scale = 1, armsUp = false },
  ref,
) {
  const def = CHARACTER_BY_KEY[character] ?? CHARACTER_BY_KEY.bear;
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const root = useRef<Group>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    const sw = walking ? Math.sin(t.current * 11) * 0.7 : 0;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    const armBase = armsUp ? Math.PI : 0;
    if (armL.current) armL.current.rotation.x = armsUp ? armBase + Math.sin(t.current * 8) * 0.3 : handsInPocket ? 0.2 : -sw * 0.8;
    if (armR.current) armR.current.rotation.x = armsUp ? armBase - Math.sin(t.current * 8) * 0.3 : handsInPocket ? 0.2 : sw * 0.8;
    if (root.current) {
      root.current.position.y = walking ? Math.abs(Math.sin(t.current * 11)) * 0.06 : 0;
      root.current.position.x = shivering ? Math.sin(t.current * 50) * 0.04 : 0;
    }
  });

  const body = def.body;
  const gloveColor = wetGloves ? '#5b6f8a' : '#ff6b6b';
  return (
    <group ref={ref} scale={scale}>
      <group ref={root}>
        {/* 다리 */}
        <group ref={legL} position={[-0.17, 0.5, 0]}>
          <Box p={[0, -0.25, 0]} s={[0.26, 0.5, 0.3]} c="#3d4a63" />
          {equipped.shoes && (
            <>
              <Box p={[0, -0.46, 0.05]} s={[0.3, 0.14, 0.42]} c="#2b8be0" />
              <Box p={[0, -0.54, 0.05]} s={[0.32, 0.04, 0.44]} c="#fff" />
            </>
          )}
        </group>
        <group ref={legR} position={[0.17, 0.5, 0]}>
          <Box p={[0, -0.25, 0]} s={[0.26, 0.5, 0.3]} c="#3d4a63" />
          {equipped.shoes && (
            <>
              <Box p={[0, -0.46, 0.05]} s={[0.3, 0.14, 0.42]} c="#2b8be0" />
              <Box p={[0, -0.54, 0.05]} s={[0.32, 0.04, 0.44]} c="#fff" />
            </>
          )}
        </group>
        {/* 몸 */}
        <Box p={[0, 0.88, 0]} s={[0.66, 0.7, 0.4]} c={body} />
        {equipped.vest && (
          <>
            <Box p={[0, 0.9, 0.005]} s={[0.7, 0.62, 0.44]} c="#c8f23a" />
            <Box p={[0, 0.82, 0.005]} s={[0.72, 0.08, 0.46]} c="#f4f4f4" />
            <Box p={[0, 1.0, 0.005]} s={[0.72, 0.08, 0.46]} c="#f4f4f4" />
          </>
        )}
        {/* 팔 */}
        <group ref={armL} position={[-0.44, 1.18, 0]}>
          <Box p={[0, -0.28, 0]} s={[0.2, 0.56, 0.22]} c={body} />
          {equipped.gloves && <Box p={[0, -0.58, 0]} s={[0.24, 0.16, 0.26]} c={gloveColor} />}
        </group>
        <group ref={armR} position={[0.44, 1.18, 0]}>
          <Box p={[0, -0.28, 0]} s={[0.2, 0.56, 0.22]} c={body} />
          {equipped.gloves && <Box p={[0, -0.58, 0]} s={[0.24, 0.16, 0.26]} c={gloveColor} />}
        </group>
        {/* 머리 */}
        <Box p={[0, 1.5, 0]} s={[0.62, 0.58, 0.58]} c={def.head} />
        <Box p={[-0.14, 1.53, 0.3]} s={[0.1, 0.12, 0.02]} c="#222" />
        <Box p={[0.14, 1.53, 0.3]} s={[0.1, 0.12, 0.02]} c="#222" />
        <Box p={[0, 1.4, 0.3]} s={[0.14, 0.08, 0.02]} c="#e58a8a" />
        {def.ear === 'round' && (
          <>
            <Box p={[-0.26, 1.84, 0]} s={[0.18, 0.18, 0.14]} c={def.body} />
            <Box p={[0.26, 1.84, 0]} s={[0.18, 0.18, 0.14]} c={def.body} />
          </>
        )}
        {def.ear === 'long' && (
          <>
            <Box p={[-0.15, 2.02, 0]} s={[0.14, 0.5, 0.1]} c={def.head} />
            <Box p={[0.15, 2.02, 0]} s={[0.14, 0.5, 0.1]} c={def.head} />
          </>
        )}
        {def.ear === 'pointy' && (
          <>
            <Box p={[-0.2, 1.9, 0]} s={[0.16, 0.2, 0.1]} c={def.body} />
            <Box p={[0.2, 1.9, 0]} s={[0.16, 0.2, 0.1]} c={def.body} />
          </>
        )}
        {def.ear === 'floppy' && (
          <>
            <Box p={[-0.35, 1.55, 0]} s={[0.1, 0.3, 0.2]} c="#a77b4b" />
            <Box p={[0.35, 1.55, 0]} s={[0.1, 0.3, 0.2]} c="#a77b4b" />
          </>
        )}
        {/* 장비 */}
        {equipped.helmet && (
          <>
            <Box p={[0, 1.86, 0]} s={[0.7, 0.2, 0.66]} c="#e23d3d" />
            <Box p={[0, 1.99, 0]} s={[0.3, 0.08, 0.5]} c="#e23d3d" />
            <Box p={[0, 1.88, 0.34]} s={[0.22, 0.12, 0.02]} c="#ffd23a" />
          </>
        )}
        {equipped.hat && !equipped.helmet && (
          <>
            <Box p={[0, 1.86, 0]} s={[0.68, 0.22, 0.64]} c="#6a8dff" />
            <Box p={[0, 1.76, 0]} s={[0.7, 0.08, 0.66]} c="#fff" />
            <Box p={[0, 2.04, 0]} s={[0.2, 0.2, 0.2]} c="#fff" />
          </>
        )}
        {equipped.scarf && (
          <>
            <Box p={[0, 1.2, 0]} s={[0.68, 0.14, 0.46]} c="#ff8a3d" />
            <Box p={[0.2, 1.0, 0.24]} s={[0.14, 0.34, 0.06]} c="#ff8a3d" />
          </>
        )}
      </group>
    </group>
  );
});
