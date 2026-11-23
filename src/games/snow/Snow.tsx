import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from '../../three/Labels';
import { Group } from 'three';
import { GameCanvas, QuarterCamera, TapGround } from '../../three/Scene';
import { Avatar } from '../../three/Avatar';
import { Block, Pine, SnowMound } from '../../three/Blocks';
import { useWalker } from '../../three/useWalker';
import { useApp } from '../../store/useApp';
import { BigButton } from '../../ui/Line';
import { chime } from '../../audio/sfx';
import { exposeE2E, GameProps, starsFromMistakes, useMistakes, useToast } from '../common';
import type { VoiceKey } from '../../data/voice';
import type { Equipped } from '../../data/types';
import {
  BOUNDS, callAdult, changeGloves, Clothing, frostChoice, initSnow, SHELTER, SITE, SnowEvent, SnowState, stepSnow, THROWER, setPlayer,
} from './logic';

const PICK_EMOJI: Record<Clothing, string> = { hat: '🧢', gloves: '🧤', scarf: '🧣' };

function Shelter({ glow }: { glow: boolean }) {
  return (
    <group position={[SHELTER.x, 0, SHELTER.z]}>
      <Block p={[0, 0.04, 0]} s={[5.6, 0.08, 5.6]} c="#ffe3b5" emissive={glow ? '#ffb347' : undefined} />
      <Block p={[0, 1.2, -1.4]} s={[4, 2.4, 0.3]} c="#d9884a" />
      <Block p={[-1.85, 1.2, 0]} s={[0.3, 2.4, 3]} c="#d9884a" />
      <Block p={[1.85, 1.2, 0]} s={[0.3, 2.4, 3]} c="#d9884a" />
      <Block p={[0, 2.7, -0.2]} s={[4.6, 0.4, 3.6]} c="#b8483e" />
      <Block p={[0, 3.05, -0.2]} s={[4.4, 0.25, 3.4]} c="#fff" />
      <Block p={[0, 0.4, -0.6]} s={[0.8, 0.8, 0.8]} c="#ff7a2f" emissive="#ff5a1f" />
      <Label position={[0, 4.4, 0]}><div style={{ fontSize: 44 }}>🏠</div></Label>
    </group>
  );
}

function Bob({ children, x, z }: { children: React.ReactNode; x: number; z: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.9 + Math.sin(clock.elapsedTime * 3 + x) * 0.15;
  });
  return <group position={[x, 0, z]}><group ref={ref}>{children}</group></group>;
}

function Ball({ from, to, t }: { from: [number, number]; to: [number, number]; t: number }) {
  const k = 1 - t / 0.9;
  const x = from[0] + (to[0] - from[0]) * k;
  const z = from[1] + (to[1] - from[1]) * k;
  return <Block p={[x, 1.2 + Math.sin(k * Math.PI) * 1.5, z]} s={[0.4, 0.4, 0.4]} c="#fff" />;
}

function SnowWorld({
  st, onEvent, equipped, character, dispatch,
}: { st: React.MutableRefObject<SnowState>; onEvent: (e: SnowEvent) => void; equipped: Equipped; character: string; dispatch: () => void }) {
  const avatar = useRef<Group>(null);
  const adult = useRef<Group>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const walker = useWalker({
    avatar,
    start: [0, 0],
    bounds: BOUNDS,
    onMove: (x, z) => setPlayer(st.current, x, z),
  });

  useFrame((_, dt) => {
    const s = st.current;
    const events = stepSnow(s, Math.min(dt, 0.05));
    // 쉼터로 옮겨졌을 때 걷는 위치도 맞춘다
    if (Math.abs(walker.pos.current.x - s.px) > 0.01 || Math.abs(walker.pos.current.z - s.pz) > 0.01) walker.teleport(s.px, s.pz);
    if (events.length) {
      events.forEach(onEvent);
      force();
    }
    if (adult.current) {
      adult.current.visible = s.adultT !== null;
      adult.current.position.set(s.px + 1.2, 0, s.pz + 0.8);
    }
  });
  useEffect(() => {
    const id = setInterval(dispatch, 200);
    return () => clearInterval(id);
  }, [dispatch]);

  const s = st.current;
  const worn: Equipped = { ...equipped, hat: s.worn.hat, gloves: s.worn.gloves, scarf: s.worn.scarf, helmet: false };
  const trees = useMemo(() => [[-12, -7], [-10, 7], [12, 7], [11, -7], [-1, 8.5], [3, 8.5], [-12, 1], [12.5, 0]] as [number, number][], []);
  return (
    <>
      <QuarterCamera target={[0, 0, 0]} fitWidth={30} fitHeight={18} follow={walker.follow} />
      <TapGround onTap={(p) => walker.go(p)} />
      <Block p={[0, -0.5, 0]} s={[BOUNDS.x * 2 + 10, 1, BOUNDS.z * 2 + 10]} c="#f6fbff" />
      {trees.map(([x, z], i) => <Pine key={i} p={[x, 0, z]} s={1 + (i % 3) * 0.15} />)}
      {([[-5, -7], [6, 7], [-11, 4]] as [number, number][]).map(([x, z], i) => <SnowMound key={i} p={[x, 0, z]} />)}
      <Shelter glow={s.level === 'ga' && s.temp < 45} />
      {/* 눈사람 만드는 곳 */}
      <group position={[SITE.x, 0, SITE.z]}>
        <Block p={[0, 0.04, 0]} s={[3, 0.08, 3]} c="#cfe6fa" />
        {s.snowman >= 1 && <Block p={[0, 0.8, 0]} s={[1.6, 1.6, 1.6]} c="#fff" />}
        {s.snowman >= 2 && <Block p={[0, 2.0, 0]} s={[1.1, 1.1, 1.1]} c="#fff" />}
        {s.snowman >= 3 && (
          <>
            <Block p={[0, 3.0, 0]} s={[0.8, 0.8, 0.8]} c="#fff" />
            <Block p={[0, 3.0, 0.42]} s={[0.15, 0.15, 0.3]} c="#ff8a3d" />
          </>
        )}
      </group>
      {s.piles.map((p, i) => !p.done && (
        <group key={i} position={[p.x, 0, p.z]}>
          <Block p={[0, 0.4, 0]} s={[1.8, 0.8, 1.6]} c="#fff" />
          <Block p={[0.3, 0.9, 0]} s={[1, 0.5, 1]} c="#eef6ff" />
          <Label position={[0, 2, 0]}><div style={{ fontSize: 34 }}>⛄</div></Label>
        </group>
      ))}
      {s.pickups.map((p) => !p.taken && (
        <Bob key={p.key} x={p.x} z={p.z}>
          <Block p={[0, 0, 0]} s={[0.7, 0.7, 0.7]} c={p.key === 'hat' ? '#6a8dff' : p.key === 'gloves' ? '#ff6b6b' : '#ff8a3d'} emissive="#ffe066" />
          <Label position={[0, 1, 0]}><div style={{ fontSize: 40 }}>{PICK_EMOJI[p.key]}</div></Label>
        </Bob>
      ))}
      {/* 눈싸움 친구 */}
      {s.level !== 'ga' && (
        <group position={[THROWER.x, 0, THROWER.z]}>
          <Avatar character="rabbit" walking={false} />
          <Label position={[0, 2.8, 0]}><div style={{ fontSize: 34 }}>❄️</div></Label>
        </group>
      )}
      {s.ballFlight !== null && <Ball from={[THROWER.x, THROWER.z]} to={[s.px, s.pz]} t={s.ballFlight} />}
      <Avatar ref={avatar} character={character} equipped={worn} walking={walker.walking} shivering={!!s.shiver || s.frost || s.temp < 25} wetGloves={s.wet} />
      {/* 어른 선생님 */}
      <group ref={adult} visible={s.adultT !== null}>
        <Avatar character="bear" scale={1.25} />
        {s.adultT !== null && <Label position={[0, 3, 0]}><div style={{ fontSize: 34 }}>🧑‍🏫</div></Label>}
      </group>
      {s.wet && (
        <Label position={[s.px, 2.8, s.pz]}><div style={{ fontSize: 36, pointerEvents: 'none' }}>💧🧤</div></Label>
      )}
    </>
  );
}

export default function Snow({ level, onFinish }: GameProps) {
  const st = useRef<SnowState>(initSnow(level));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const { toast, show } = useToast();
  const mistakes = useMistakes();
  const equipped = useApp((s) => s.equipped);
  const student = useApp((s) => s.student);
  const done = useRef(false);
  exposeE2E(() => st.current);
  const [frostPanel, setFrostPanel] = useState(false);
  const coldHinted = useRef(false);

  const onEvent = (e: SnowEvent) => {
    switch (e.type) {
      case 'wear': chime(); show(`snow.wear.${e.item}` as VoiceKey, 'good', 2200); break;
      case 'pile': chime(); show('snow.pile', 'good', 2000); break;
      case 'cold': mistakes.add('got_too_cold'); show('snow.reason.got_too_cold', 'bad', 5500); break;
      case 'shelter': show('snow.shelter', 'good', 1800); break;
      case 'wet': show('snow.wet', undefined, 5000); break;
      case 'changed': chime(); show('snow.changed', 'good', 2500); break;
      case 'shiver': show('snow.shiver', 'bad', 0); break;
      case 'shiverMissed': mistakes.add('no_call_adult'); show('snow.reason.no_call_adult', 'bad', 5500); break;
      case 'adult': if (e.type === 'adult') { chime(); show('snow.adult', 'good', 3000); } break;
      case 'frost': setFrostPanel(true); show('snow.frost', 'bad', 0); break;
      case 'frostWrong': mistakes.add('rubbed_frostbite'); show('snow.reason.rubbed_frostbite', 'bad', 6500); break;
      case 'frostOk': setFrostPanel(false); chime(); show('snow.frost.ok', 'good', 3500); break;
      case 'win':
        if (!done.current) {
          done.current = true;
          show('snow.done', 'good', 2500);
          setTimeout(() => onFinish({ stars: starsFromMistakes(mistakes.count()), mistakes: mistakes.all() }), 2300);
        }
        break;
      default: break;
    }
  };

  useEffect(() => {
    show(level === 'ga' ? 'snow.tip.ga' : level === 'na' ? 'snow.tip.na' : 'snow.tip.da', undefined, 6500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = st.current;
  // 가 수준: 추우면 한 번 안내해 준다
  useEffect(() => {
    if (level === 'ga' && s.temp < 40 && !coldHinted.current && !s.inShelter) {
      coldHinted.current = true;
      show('snow.cold.hint', undefined, 4500);
    }
    if (s.temp > 70) coldHinted.current = false;
  });

  const temp = s.temp;
  const face = temp > 66 ? '😊' : temp > 33 ? '😐' : '🥶';
  const color = temp > 66 ? '#3dbd7d' : temp > 33 ? '#ffb020' : '#4a8de0';

  return (
    <>
      <div className="canvas-wrap">
        <GameCanvas bg="#dcefff">
          <SnowWorld st={st} onEvent={onEvent} equipped={equipped} character={student?.character_key ?? 'penguin'} dispatch={bump} />
        </GameCanvas>
      </div>
      <div className="overlay">
        <div className="hud-top" style={{ paddingRight: 280 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="pill thermo" aria-label="체온">
              <div className="thermo-bar" style={{ height: 130 }}>
                <i style={{ height: `${temp}%`, background: color }} />
              </div>
              <span style={{ fontSize: 46 }}>{face}</span>
            </div>
            <div className="pill" style={{ fontSize: 34 }}>
              <span style={{ opacity: s.worn.hat ? 1 : 0.25 }}>🧢</span>
              <span style={{ opacity: s.worn.gloves ? 1 : 0.25 }}>{s.wet ? '💧' : '🧤'}</span>
              <span style={{ opacity: s.worn.scarf ? 1 : 0.25 }}>🧣</span>
            </div>
            <div className="pill" style={{ fontSize: 34 }}>
              {'⛄'.repeat(s.snowman)}{'○'.repeat(3 - s.snowman)}
            </div>
          </div>
        </div>
        {toast}
        {frostPanel && (
          <div className="card" style={{ position: 'absolute', left: '50%', bottom: 150, transform: 'translateX(-50%)', pointerEvents: 'auto' }}>
            <div className="row">
              <BigButton icon="🤲" k="snow.frost.rub" tone="secondary" size="xl" onClick={() => { frostChoice(st.current, 'rub').forEach(onEvent); bump(); }} />
              <BigButton icon="🏠" k="snow.frost.warm" tone="good" size="xl" onClick={() => { frostChoice(st.current, 'warm').forEach(onEvent); bump(); }} />
            </div>
          </div>
        )}
        <div className="hud-bottom">
          {s.shiver && <BigButton icon="🙋" k="snow.callAdult" tone="warn" size="xl" className="pulse" onClick={() => { callAdult(st.current).forEach(onEvent); bump(); }} />}
          {s.inShelter && s.wet && <BigButton icon="🧤" k="snow.change" tone="good" size="xl" className="pulse" onClick={() => { changeGloves(st.current).forEach(onEvent); bump(); }} />}
        </div>
      </div>
    </>
  );
}
