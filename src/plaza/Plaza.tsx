import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from '../three/Labels';
import { Group, InstancedMesh, Object3D, Vector3 } from 'three';
import { GameCanvas, QuarterCamera, TapGround } from '../three/Scene';
import { Avatar } from '../three/Avatar';
import { Block, House, Pine, SnowMound, Snowman } from '../three/Blocks';
import { GAMES } from '../data/games';
import { GameKey } from '../data/types';
import { VOICE } from '../data/voice';
import { useApp } from '../store/useApp';
import { Line, useSpeakOnMount, BigButton } from '../ui/Line';
import { SoundToggle, Scrim } from '../ui/Overlay';
import { speak } from '../audio/speak';
import { clampToPlaza, doorPad, OBSTACLES, pushOut, PLAZA_BOUNDS } from './geometry';

interface GateProps {
  game: (typeof GAMES)[number];
  cleared: boolean;
  stars: number;
  festival: boolean;
  onTap: () => void;
}

function GateBuilding({ game, cleared, stars, festival, onTap }: GateProps) {
  const [x, z] = game.pos;
  const pad = doorPad(game.key);
  const press = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onTap();
  };
  return (
    <group>
      <group position={[x, 0, z]} onPointerDown={press}>
        {game.key === 'obi' && (
          <>
            <Block p={[-1.8, 1.4, 0]} s={[0.9, 2.8, 0.9]} c="#a9dcff" />
            <Block p={[1.8, 1.4, 0]} s={[0.9, 2.8, 0.9]} c="#a9dcff" />
            <Block p={[0, 3.0, 0]} s={[4.6, 0.7, 1.1]} c="#7cc4f5" />
            <Block p={[0, 3.55, 0]} s={[4.2, 0.3, 1]} c="#fff" />
            <Block p={[0, 0.06, 1.6]} s={[4.6, 0.12, 2.6]} c="#bfe9ff" emissive="#7cc4f5" />
          </>
        )}
        {game.key === 'tycoon' && (
          <House p={[0, 0, 0]} wall="#f4b183" roof="#c0503f" w={3.6} d={3.4} h={2.2}>
            <Block p={[0.9, 3.4, -0.6]} s={[0.6, 1.2, 0.6]} c="#8a5a44" />
            <Block p={[0, 1.0, 1.72]} s={[0.9, 1.7, 0.1]} c="#7a4a2c" />
            <Block p={[-1.1, 1.4, 1.72]} s={[0.8, 0.8, 0.1]} c="#ffe28a" emissive={festival || true ? '#ffd45c' : undefined} />
          </House>
        )}
        {game.key === 'snow' && (
          <>
            <Pine p={[-1.6, 0, -0.6]} s={1.2} />
            <Pine p={[1.8, 0, -0.4]} s={1.0} />
            <Block p={[0, 1.0, 0]} s={[2.6, 2, 2.2]} c="#e8734a" />
            <Block p={[0, 2.3, 0]} s={[1.8, 0.7, 1.6]} c="#d9603a" />
            <Block p={[0, 0.9, 1.12]} s={[1.0, 1.5, 0.1]} c="#3b2a20" />
            <Block p={[0, 2.8, 0]} s={[0.5, 0.4, 0.5]} c="#fff" />
          </>
        )}
        {game.key === 'patrol' && (
          <>
            <Block p={[0, 0.04, 0]} s={[5.4, 0.08, 2.4]} c="#7ec9f2" />
            <Block p={[0, 0.2, 0]} s={[5, 0.12, 2]} c="#d9f1ff" />
            <Block p={[-2.4, 0.6, 1.4]} s={[0.4, 1.2, 0.4]} c="#d94a3a" />
            <Block p={[-2.4, 1.3, 1.4]} s={[1.0, 0.7, 0.14]} c="#fff" />
            <Block p={[2.4, 0.6, 1.4]} s={[0.4, 1.2, 0.4]} c="#d94a3a" />
            <Block p={[2.4, 1.3, 1.4]} s={[1.0, 0.7, 0.14]} c="#fff" />
          </>
        )}
        <Label position={[pad[0] - x, 3, pad[1] - z]}>
          <button className="gate-label" style={{ background: game.color }} onClick={onTap}>
            <span className="gate-em">{game.emoji}</span>
            <span>{VOICE[`plaza.gate.${game.key}` as const]}</span>
            {cleared && <span className="gate-ok">✅{'⭐'.repeat(stars)}</span>}
          </button>
        </Label>
      </group>
      {/* 입구 발판 */}
      <Block p={[pad[0], 0.04, pad[1]]} s={[2.2, 0.08, 2.2]} c={game.color} emissive={game.color} />
    </group>
  );
}

function Lamps({ lit }: { lit: boolean }) {
  const spots: [number, number][] = [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, -9], [0, 9], [-12, 0], [12, 0]];
  return (
    <>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Block p={[0, 1.0, 0]} s={[0.18, 2, 0.18]} c="#4a4f5c" />
          <Block p={[0, 2.1, 0]} s={[0.5, 0.5, 0.5]} c={lit ? ['#ffd45c', '#ff8a8a', '#8ad7ff', '#a6f0b0'][i % 4] : '#dfe4ea'} emissive={lit ? ['#ffd45c', '#ff8a8a', '#8ad7ff', '#a6f0b0'][i % 4] : undefined} />
        </group>
      ))}
    </>
  );
}

function SnowFall({ colorful }: { colorful: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const N = 90;
  const data = useMemo(
    () => Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 36, y: Math.random() * 18, z: (Math.random() - 0.5) * 30, v: 1 + Math.random() * 1.4 })),
    [],
  );
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    data.forEach((d, i) => {
      d.y -= d.v * dt;
      if (d.y < 0) d.y = 18;
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(d.y, d.x, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <boxGeometry args={[0.16, 0.16, 0.16]} />
      <meshBasicMaterial color={colorful ? '#ffe9a8' : '#ffffff'} />
    </instancedMesh>
  );
}

function PlazaWorld({ onEnter }: { onEnter: (g: GameKey) => void }) {
  const equipped = useApp((s) => s.equipped);
  const progress = useApp((s) => s.progress);
  const student = useApp((s) => s.student);
  const badge = useApp((s) => s.badge);
  const avatarRef = useRef<Group>(null);
  const target = useRef<Vector3 | null>(null);
  const want = useRef<GameKey | null>(null);
  const pos = useRef(new Vector3(0, 0, 6));
  const follow = useRef<Vector3 | null>(new Vector3(0, 0, 2));
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);
  const entered = useRef(false);

  const cleared = (g: GameKey) => progress.find((p) => p.game_key === g && p.cleared);
  const parts = {
    body: !!cleared('obi'),
    head: !!cleared('tycoon'),
    hat: !!cleared('snow'),
    scarf: !!cleared('patrol'),
  };

  useFrame((_, dt) => {
    const a = avatarRef.current;
    if (!a) return;
    let moving = false;
    const t = target.current;
    if (t) {
      const dx = t.x - pos.current.x;
      const dz = t.z - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.18) {
        target.current = null;
        if (want.current && !entered.current) {
          entered.current = true;
          onEnter(want.current);
        }
      } else {
        const step = Math.min(d, 7 * dt);
        pos.current.x += (dx / d) * step;
        pos.current.z += (dz / d) * step;
        pushOut(pos.current);
        a.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
    }
    a.position.copy(pos.current);
    if (moving !== walkingRef.current) {
      walkingRef.current = moving;
      setWalking(moving);
    }
    follow.current = new Vector3(pos.current.x * 0.6, 0, pos.current.z * 0.6);
  });

  const go = (p: Vector3, game: GameKey | null = null) => {
    const c = clampToPlaza(p.x, p.z);
    target.current = new Vector3(c.x, 0, c.z);
    want.current = game;
    entered.current = false;
  };

  return (
    <>
      <QuarterCamera target={[0, 0, 0]} fitWidth={38} fitHeight={27} follow={follow} />
      <TapGround onTap={(p) => go(p)} />
      {/* 땅 */}
      <Block p={[0, -0.5, 0]} s={[PLAZA_BOUNDS.x * 2 + 8, 1, PLAZA_BOUNDS.z * 2 + 8]} c="#f6fbff" />
      <Block p={[0, 0.02, 0]} s={[9, 0.05, 9]} c="#e1eefa" />
      <Block p={[0, 0.03, 0]} s={[6, 0.05, 6]} c="#d3e6f7" />
      <Block p={[0, 0.02, 0]} s={[1.2, 0.05, 26]} c="#e8f1fa" />
      <Block p={[0, 0.02, 0]} s={[30, 0.05, 1.2]} c="#e8f1fa" />
      {[[-14, -10], [14, -10], [-14, 10], [14, 10], [-15.5, 0], [15.5, 0], [0, -12], [0, 12.5]].map(([x, z], i) => (
        <Pine key={i} p={[x, 0, z]} s={0.9 + (i % 3) * 0.15} />
      ))}
      {[[-5, 9], [5, -9], [-12, -5], [12, 5]].map(([x, z], i) => (
        <SnowMound key={i} p={[x, 0, z]} />
      ))}
      <Snowman parts={parts} scale={1.15} />
      {GAMES.map((g) => (
        <GateBuilding
          key={g.key}
          game={g}
          cleared={!!cleared(g.key)}
          stars={cleared(g.key)?.stars ?? 0}
          festival={badge}
          onTap={() => {
            const p = doorPad(g.key);
            go(new Vector3(p[0], 0, p[1]), g.key);
          }}
        />
      ))}
      <Lamps lit={badge} />
      <SnowFall colorful={badge} />
      <Avatar ref={avatarRef} character={student?.character_key ?? 'penguin'} equipped={equipped} walking={walking} scale={1.3} />
    </>
  );
}

export function Plaza({ onEnter }: { onEnter: (g: GameKey) => void }) {
  const badge = useApp((s) => s.badge);
  const festivalSeen = useApp((s) => s.festivalSeen);
  const markFestivalSeen = useApp((s) => s.markFestivalSeen);
  const setWardrobe = useApp((s) => s.setWardrobe);
  const logout = useApp((s) => s.logout);
  const guest = useApp((s) => s.guest);
  const progress = useApp((s) => s.progress);
  const showFestival = badge && !festivalSeen;

  useSpeakOnMount(showFestival ? 'plaza.badgeGet' : 'plaza.hello', [showFestival]);

  const clearedCount = progress.filter((p) => p.cleared).length;
  return (
    <>
      <div className="canvas-wrap">
        <GameCanvas bg="#cfeaff">
          <PlazaWorld onEnter={onEnter} />
        </GameCanvas>
      </div>
      <div className="overlay">
        <div className="hud-top">
          <BigButton icon="👕" k="plaza.wardrobe" tone="warn" size="md" onClick={() => setWardrobe(true)} />
          <div className="row">
            {badge && <span className="pill">🏅 <Line k="plaza.badge" /></span>}
            <span className="pill" aria-label="눈사람 조각">⛄ {'●'.repeat(clearedCount)}{'○'.repeat(4 - clearedCount)}</span>
            <SoundToggle />
            <BigButton icon="🚪" k="plaza.logout" tone="secondary" size="md" onClick={() => void logout()} />
          </div>
        </div>
        <div className="hud-bottom">
          <span className="pill"><Line k="plaza.hello" speaker /></span>
          {guest && <span className="pill">🧪 <Line k="start.guestNote" /></span>}
        </div>
      </div>
      {showFestival && (
        <Scrim>
          <div className="card" onClick={() => markFestivalSeen()}>
            {['🎆', '🎇', '✨', '🎆', '🎇'].map((e, i) => (
              <span key={i} className="firework" style={{ left: `${10 + i * 20}%`, bottom: '12%', animationDelay: `${i * 0.5}s` }}>{e}</span>
            ))}
            <div className="big-emoji">🏅</div>
            <h1><Line k="plaza.badge" /></h1>
            <p><Line k="plaza.festival" /></p>
            <BigButton icon="🎉" k="common.ok" tone="good" onClick={() => markFestivalSeen()} />
          </div>
        </Scrim>
      )}
    </>
  );
}

export { speak };
