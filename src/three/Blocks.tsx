import type { ReactNode } from 'react';

type V3 = [number, number, number];

export function Block({ p, s, c, r, emissive, opacity }: { p: V3; s: V3; c: string; r?: V3; emissive?: string; opacity?: number }) {
  return (
    <mesh position={p} rotation={r}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        flatShading
        emissive={emissive ?? '#000'}
        emissiveIntensity={emissive ? 0.7 : 0}
        transparent={opacity !== undefined && opacity < 1}
        opacity={opacity ?? 1}
      />
    </mesh>
  );
}

/** 블록풍 소나무 */
export function Pine({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Block p={[0, 0.4, 0]} s={[0.4, 0.8, 0.4]} c="#7a5230" />
      <Block p={[0, 1.1, 0]} s={[1.6, 0.6, 1.6]} c="#2f7d52" />
      <Block p={[0, 1.6, 0]} s={[1.2, 0.5, 1.2]} c="#3a9462" />
      <Block p={[0, 2.05, 0]} s={[0.7, 0.45, 0.7]} c="#46a872" />
      <Block p={[0, 2.35, 0]} s={[0.5, 0.15, 0.5]} c="#fff" />
    </group>
  );
}

export function SnowMound({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Block p={[0, 0.25, 0]} s={[1.6, 0.5, 1.4]} c="#ffffff" />
      <Block p={[0.2, 0.55, 0]} s={[0.9, 0.3, 0.8]} c="#f4faff" />
    </group>
  );
}

/** 블록 집 (지붕에 눈) */
export function House({ p, wall = '#e9a77a', roof = '#b8483e', w = 3, d = 3, h = 2, children }: { p: V3; wall?: string; roof?: string; w?: number; d?: number; h?: number; children?: ReactNode }) {
  return (
    <group position={p}>
      <Block p={[0, h / 2, 0]} s={[w, h, d]} c={wall} />
      <Block p={[0, h + 0.25, 0]} s={[w + 0.4, 0.5, d + 0.4]} c={roof} />
      <Block p={[0, h + 0.62, 0]} s={[w + 0.2, 0.25, d + 0.2]} c="#ffffff" />
      {children}
    </group>
  );
}

export function Snowman({ parts, scale = 1 }: { parts: { body: boolean; head: boolean; hat: boolean; scarf: boolean }; scale?: number }) {
  return (
    <group scale={scale}>
      <Block p={[0, 0.05, 0]} s={[2.4, 0.1, 2.4]} c="#dfe9f5" />
      {parts.body ? (
        <Block p={[0, 1.1, 0]} s={[2, 2, 2]} c="#ffffff" />
      ) : (
        <Block p={[0, 0.7, 0]} s={[2, 1.2, 2]} c="#e6f0fb" opacity={0.35} />
      )}
      {parts.body && (
        <>
          <Block p={[0, 1.4, 1.02]} s={[0.25, 0.25, 0.05]} c="#333" />
          <Block p={[0, 0.9, 1.02]} s={[0.25, 0.25, 0.05]} c="#333" />
        </>
      )}
      {parts.head ? (
        <>
          <Block p={[0, 2.7, 0]} s={[1.4, 1.4, 1.4]} c="#ffffff" />
          <Block p={[-0.3, 2.85, 0.72]} s={[0.18, 0.18, 0.05]} c="#222" />
          <Block p={[0.3, 2.85, 0.72]} s={[0.18, 0.18, 0.05]} c="#222" />
          <Block p={[0, 2.6, 0.9]} s={[0.2, 0.2, 0.5]} c="#ff8a3d" />
        </>
      ) : (
        <Block p={[0, 2.7, 0]} s={[1.4, 1.4, 1.4]} c="#e6f0fb" opacity={0.3} />
      )}
      {parts.hat && (
        <>
          <Block p={[0, 3.5, 0]} s={[1.3, 0.12, 1.3]} c="#2d3a5c" />
          <Block p={[0, 3.9, 0]} s={[0.9, 0.7, 0.9]} c="#2d3a5c" />
        </>
      )}
      {parts.scarf && (
        <>
          <Block p={[0, 1.95, 0]} s={[1.6, 0.28, 1.6]} c="#ff6b6b" />
          <Block p={[0.5, 1.5, 0.82]} s={[0.3, 0.7, 0.1]} c="#ff6b6b" />
        </>
      )}
    </group>
  );
}
