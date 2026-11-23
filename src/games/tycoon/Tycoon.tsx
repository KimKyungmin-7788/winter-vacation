import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from '../../three/Labels';
import { Group } from 'three';
import { GameCanvas, QuarterCamera } from '../../three/Scene';
import { Block } from '../../three/Blocks';
import { BigButton, Line } from '../../ui/Line';
import { speak } from '../../audio/speak';
import { chime, startAlarm, stopAlarm } from '../../audio/sfx';
import { GameProps, starsFromMistakes, useMistakes, useToast } from '../common';
import { VOICE, VoiceKey } from '../../data/voice';
import {
  activeHazards, AIR_MAX, buy, cellFree, COLS, Dev, DevKind, DRILL_ORDER, drillPress, DrillStep, initGame, pickUp, place, ROWS, SHOP,
  startHolding, storeHeld, tick, togglePower, removeDevice, tryOut, TycoonEvent, TycoonGame, vent, warmth,
} from './logic';

const CELL = 2;
const wx = (x: number) => (x - (COLS - 1) / 2) * CELL;
const wz = (z: number) => (z - (ROWS - 1) / 2) * CELL;

function Smoke({ x, z }: { x: number; z: number }) {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((g, i) => {
      if (!g) return;
      const t = (clock.elapsedTime * 0.7 + i * 0.33) % 1;
      g.position.y = 1.2 + t * 2.2;
      g.scale.setScalar(0.5 + t * 1.2);
    });
  });
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <Block p={[0, 0, 0]} s={[0.5, 0.5, 0.5]} c="#6b6f78" opacity={0.75} />
        </group>
      ))}
    </group>
  );
}

function DevMesh({ d, bad, glow, onTap }: { d: Dev; bad: boolean; glow: boolean; onTap: () => void }) {
  const x = wx(d.x);
  const z = wz(d.z);
  const hot = d.on ? '#ff7a2f' : '#8a8f99';
  return (
    <group position={[x, 0, z]} onPointerDown={(e) => { e.stopPropagation(); onTap(); }}>
      {d.kind === 'heater' && (
        <>
          <Block p={[0, 0.7, 0]} s={[1.2, 1.4, 0.6]} c={d.on ? '#e0e6ee' : '#b9c0cb'} />
          <Block p={[0, 0.8, 0.31]} s={[0.9, 0.8, 0.04]} c={hot} emissive={d.on ? '#ff5a1f' : undefined} />
        </>
      )}
      {d.kind === 'stove' && (
        <>
          <Block p={[0, 0.6, 0]} s={[1.0, 1.2, 1.0]} c="#3a3f4a" />
          <Block p={[0, 1.3, 0]} s={[0.7, 0.2, 0.7]} c={hot} emissive={d.on ? '#ff5a1f' : undefined} />
        </>
      )}
      {d.kind === 'mat' && <Block p={[0, 0.06, 0]} s={[1.5, 0.1, 1.5]} c={d.on ? '#e8604f' : '#a9aab3'} emissive={d.on ? '#c23a2a' : undefined} />}
      {d.kind === 'lamp' && (
        <>
          <Block p={[0, 0.7, 0]} s={[0.12, 1.4, 0.12]} c="#555" />
          <Block p={[0, 1.5, 0]} s={[0.6, 0.4, 0.6]} c={d.on ? '#ffe28a' : '#c9c9c9'} emissive={d.on ? '#ffd45c' : undefined} />
        </>
      )}
      {d.kind === 'kettle' && (
        <>
          <Block p={[0, 0.45, 0]} s={[0.7, 0.9, 0.7]} c="#f5f5f5" />
          <Block p={[0.45, 0.6, 0]} s={[0.3, 0.12, 0.12]} c="#f5f5f5" />
        </>
      )}
      {bad && <Block p={[0, 0.03, 0]} s={[1.9, 0.06, 1.9]} c="#ff3b30" emissive="#ff3b30" opacity={0.6} />}
      {glow && !bad && <Block p={[0, 0.03, 0]} s={[1.9, 0.06, 1.9]} c="#ffe066" emissive="#ffe066" opacity={0.7} />}
    </group>
  );
}

function Room({
  g, held, onCell, onDev, hazDevs, hint,
}: { g: TycoonGame; held: boolean; onCell: (x: number, z: number) => void; onDev: (id: number) => void; hazDevs: Set<number>; hint: boolean }) {
  const W = COLS * CELL;
  const D = ROWS * CELL;
  const outletHot = (zone: 'L' | 'R') => activeHazards(g).some((h) => h.sig === `octopus:${zone}`);
  return (
    <>
      <Block p={[0, -0.15, 0]} s={[W, 0.3, D]} c="#e6c79a" />
      {/* 바닥 칸 */}
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        const x = i % COLS;
        const z = Math.floor(i / COLS);
        const free = cellFree(g, x, z);
        return (
          <mesh key={i} position={[wx(x), 0.02, wz(z)]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); onCell(x, z); }}>
            <planeGeometry args={[CELL - 0.06, CELL - 0.06]} />
            <meshStandardMaterial color={held && free ? '#b9f2c9' : (x + z) % 2 ? '#f0d6ae' : '#ead0a6'} />
          </mesh>
        );
      })}
      {/* 벽 */}
      <Block p={[0, 1.8, -D / 2 - 0.2]} s={[W + 0.8, 3.6, 0.4]} c="#f3e9dc" />
      <Block p={[-W / 2 - 0.2, 1.8, 0]} s={[0.4, 3.6, D + 0.4]} c="#efe2d0" />
      {/* 창문 + 커튼 */}
      <Block p={[wx(1), 2.2, -D / 2 + 0.05]} s={[1.9, 1.5, 0.1]} c="#a8dcff" />
      <Block p={[wx(1) - 0.9, 1.4, -D / 2 + 0.3]} s={[0.5, 2.8, 0.25]} c="#5b78d6" />
      <Block p={[wx(1) + 0.9, 1.4, -D / 2 + 0.3]} s={[0.5, 2.8, 0.25]} c="#5b78d6" />
      {/* 콘센트 */}
      {(['L', 'R'] as const).map((zone) => (
        <group key={zone} position={[zone === 'L' ? wx(0.5) : wx(4.5), 0.9, -D / 2 + 0.06]}>
          <Block p={[0, 0, 0]} s={[0.6, 0.6, 0.1]} c={outletHot(zone) ? '#ff3b30' : '#ffffff'} emissive={outletHot(zone) ? '#ff3b30' : undefined} />
          <Block p={[-0.12, 0, 0.06]} s={[0.07, 0.2, 0.04]} c="#333" />
          <Block p={[0.12, 0, 0.06]} s={[0.07, 0.2, 0.04]} c="#333" />
        </group>
      ))}
      {/* 인화성 물건 */}
      {g.flams.map((f) => (
        <group key={f.kind} position={[wx(f.x), 0, wz(f.z)]}>
          {f.kind === 'laundry' && (
            <>
              <Block p={[-0.6, 0.7, 0]} s={[0.1, 1.4, 0.1]} c="#999" />
              <Block p={[0.6, 0.7, 0]} s={[0.1, 1.4, 0.1]} c="#999" />
              <Block p={[0, 1.4, 0]} s={[1.3, 0.08, 0.1]} c="#999" />
              <Block p={[-0.3, 1.0, 0]} s={[0.4, 0.7, 0.06]} c="#ff9fb2" />
              <Block p={[0.3, 1.0, 0]} s={[0.4, 0.7, 0.06]} c="#9fd3ff" />
            </>
          )}
          {f.kind === 'blanket' && (
            <>
              <Block p={[0, 0.3, 0]} s={[1.5, 0.6, 1.3]} c="#8e6bd8" />
              <Block p={[0.1, 0.65, 0]} s={[1.0, 0.2, 0.9]} c="#a78af0" />
            </>
          )}
          {f.kind === 'curtain' && <Block p={[0, 0.05, 0]} s={[0.1, 0.1, 0.1]} c="#5b78d6" />}
        </group>
      ))}
      {/* 산 물건 */}
      {g.decor.map((d) => (
        <group key={d.kind} position={[wx(d.x), 0, wz(d.z)]}>
          {d.kind === 'rug' && <Block p={[0, 0.06, 0]} s={[1.7, 0.1, 1.7]} c="#4fa3a5" />}
          {d.kind === 'plant' && (
            <>
              <Block p={[0, 0.3, 0]} s={[0.6, 0.6, 0.6]} c="#b5651d" />
              <Block p={[0, 0.9, 0]} s={[0.9, 0.7, 0.9]} c="#3dbd7d" />
            </>
          )}
          {d.kind === 'picture' && (
            <>
              <Block p={[0, 0.5, 0]} s={[0.9, 0.9, 0.12]} c="#fff" />
              <Block p={[0, 0.55, 0.07]} s={[0.7, 0.6, 0.04]} c="#7cc4f5" />
            </>
          )}
        </group>
      ))}
      {/* 기구 */}
      {g.devices.map((d) => (
        <DevMesh key={d.id} d={d} bad={hazDevs.has(d.id)} glow={hint && hazDevs.has(d.id)} onTap={() => onDev(d.id)} />
      ))}
      {[...hazDevs].map((id) => {
        const d = g.devices.find((x) => x.id === id);
        return d ? <Smoke key={id} x={wx(d.x)} z={wz(d.z)} /> : null;
      })}
      {g.phase === 'drill' && [[-2, -1], [1, 0], [3, -2]].map(([x, z], i) => <Smoke key={`fire${i}`} x={x} z={z} />)}
      {[...hazDevs].map((id) => {
        const d = g.devices.find((x) => x.id === id);
        return d ? (
          <Label key={`b${id}`} position={[wx(d.x), 3.4, wz(d.z)]}>
            <div style={{ fontSize: 38, pointerEvents: 'none' }}>🔔</div>
          </Label>
        ) : null;
      })}
    </>
  );
}

const KIND_ICON: Record<DevKind, string> = { heater: '🔥', stove: '🛢️', mat: '🟥', lamp: '💡', kettle: '🫖' };

export default function Tycoon({ level, onFinish }: GameProps) {
  const gRef = useRef<TycoonGame>(initGame(level));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const g = gRef.current;
  const { toast, show, hide } = useToast();
  const mistakes = useMistakes();
  const [bubble, setBubble] = useState<number | null>(null);
  const [shop, setShop] = useState(false);
  const [drillOrder] = useState<DrillStep[]>(() => [...DRILL_ORDER].sort(() => Math.random() - 0.5) as DrillStep[]);
  const finished = useRef(false);

  const hazards = activeHazards(g);
  const hazDevs = useMemo(() => new Set(hazards.flatMap((h) => h.devIds)), [hazards.map((h) => h.sig).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const heat = warmth(g);

  useEffect(() => {
    if (hazDevs.size > 0 || g.phase === 'drill') startAlarm();
    else stopAlarm();
    return () => stopAlarm();
  }, [hazDevs.size, g.phase]);

  const handle = (events: TycoonEvent[]) => {
    for (const e of events) {
      if (e.type === 'hazard') {
        mistakes.add(e.key);
        show(`tycoon.reason.${e.key}` as VoiceKey, 'bad', 6500);
      } else if (e.type === 'fixed') {
        chime();
        show('tycoon.fixed', 'good', 2500);
      } else if (e.type === 'noVent') {
        mistakes.add('no_ventilation');
        show('tycoon.reason.no_ventilation', 'bad', 6500);
      } else if (e.type === 'leftOn') {
        mistakes.add('left_power_on');
        show('tycoon.reason.left_power_on', 'bad', 5500);
      } else if (e.type === 'drillWrong') {
        mistakes.add('evac_wrong_order');
        show('tycoon.reason.evac_wrong_order', 'bad', 6500);
      } else if (e.type === 'drillOk') {
        chime();
      } else if (e.type === 'phase') {
        if (e.phase === 'out') show('tycoon.out.prompt', 'good', 0);
        if (e.phase === 'drill') show('tycoon.evac.start', 'bad', 0);
        if (e.phase === 'done') {
          if (!finished.current) {
            finished.current = true;
            const k: VoiceKey = level === 'ga' ? 'tycoon.warm' : level === 'na' ? 'tycoon.out.done' : 'tycoon.evac.done';
            show(k, 'good', 2400);
            stopAlarm();
            setTimeout(() => onFinish({ stars: starsFromMistakes(mistakes.count()), mistakes: mistakes.all() }), 2200);
          }
        }
      }
    }
    bump();
  };

  useEffect(() => {
    show(level === 'ga' ? 'tycoon.tip.ga' : level === 'na' ? 'tycoon.tip.na' : 'tycoon.tip.da', undefined, 6000);
    const t = setInterval(() => {
      const ev = tick(gRef.current, 0.25);
      if (ev.length) handle(ev);
      else bump();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCell = (x: number, z: number) => {
    setBubble(null);
    if (g.held) handle(place(g, x, z));
  };
  const onDev = (id: number) => {
    if (g.held || g.phase === 'done') return;
    if (level === 'ga') {
      pickUp(g, id);
      bump();
      void speak('tycoon.holding');
    } else {
      setBubble(bubble === id ? null : id);
    }
  };

  const bubbleDev = bubble !== null ? g.devices.find((d) => d.id === bubble) : null;
  const coinsIcons = '🪙'.repeat(g.coins) || '·';

  return (
    <>
      <div className="canvas-wrap">
        <GameCanvas bg="#dff0ff">
          <QuarterCamera target={[0, 0.5, 0]} fitWidth={20} fitHeight={13.5} />
          <Room g={g} held={!!g.held} onCell={onCell} onDev={onDev} hazDevs={hazDevs} hint={level === 'ga'} />
        </GameCanvas>
      </div>
      <div className="overlay">
        <div className="hud-top" style={{ paddingRight: 280 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="pill thermo" aria-label="따뜻함">
              <div className="thermo-bar" style={{ height: 120 }}>
                <i style={{ height: `${(heat / 5) * 100}%`, background: heat >= 4 ? '#ff6b3d' : heat >= 2 ? '#ffb020' : '#7cc4f5' }} />
              </div>
              <span style={{ fontSize: 40 }}>{heat >= 4 ? '😊' : heat >= 2 ? '🙂' : '🥶'}</span>
            </div>
            <div className="pill coin-row">{coinsIcons}</div>
            {level === 'da' && (
              <div className="pill" aria-label="공기">
                {'💨'.repeat(Math.max(0, AIR_MAX - 1 - g.air))}
                {g.air >= 1 ? '😷'.repeat(Math.min(g.air, 4)) : ''}
              </div>
            )}
          </div>
        </div>
        {toast}
        {bubbleDev && (
          <div className="card" style={{ position: 'absolute', left: '50%', bottom: 150, transform: 'translateX(-50%)', padding: 14, pointerEvents: 'auto' }}>
            <div className="row">
              <BigButton icon="✋" k="tycoon.move" tone="primary" size="md" onClick={() => { pickUp(g, bubbleDev.id); setBubble(null); bump(); void speak('tycoon.holding'); }} />
              <BigButton icon="⏻" k="tycoon.power" tone={bubbleDev.on ? 'warn' : 'secondary'} size="md" onClick={() => { handle(togglePower(g, bubbleDev.id)); setBubble(null); }} />
              <BigButton icon="📦" k="tycoon.remove" tone="secondary" size="md" onClick={() => { handle(removeDevice(g, bubbleDev.id)); setBubble(null); }} />
            </div>
          </div>
        )}
        {shop && g.phase === 'room' && (
          <div className="card" style={{ position: 'absolute', left: '50%', bottom: 150, transform: 'translateX(-50%)', padding: 14, pointerEvents: 'auto' }}>
            <div className="row">
              {SHOP.map((s) => {
                const owned = g.decor.some((d) => d.kind === s.kind);
                return (
                  <BigButton
                    key={s.kind}
                    icon={s.kind === 'rug' ? '🟦' : s.kind === 'plant' ? '🪴' : '🖼️'}
                    label={`${'🪙'.repeat(s.cost)} ${VOICE[`tycoon.shop.${s.kind}` as VoiceKey]}`}
                    tone={owned ? 'secondary' : 'good'}
                    size="md"
                    disabled={owned}
                    onClick={() => {
                      if (buy(g, s.kind)) { chime(); setShop(false); handle([]); void speak(`tycoon.shop.${s.kind}` as VoiceKey); }
                      else show('tycoon.coinsNeeded', undefined, 2500);
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
        <div className="hud-bottom">
          {g.phase === 'room' && !g.held && (
            <>
              <BigButton icon="🔥" k="tycoon.place.heater" tone="warn" size="lg" onClick={() => { if (startHolding(g, 'heater')) { bump(); void speak('tycoon.holding'); } }} />
              <BigButton icon="🪙" k="tycoon.shop" tone="good" size="lg" active={shop} onClick={() => { setShop(!shop); setBubble(null); hide(); }} />
              {level === 'da' && <BigButton icon="🪟" k="tycoon.vent" tone="primary" size="lg" onClick={() => { vent(g); chime(); show('tycoon.vented', 'good', 2200); handle([]); }} />}
            </>
          )}
          {g.held && (
            <>
              <span className="pill" style={{ fontSize: 30 }}>{KIND_ICON[g.held.kind]} <Line k="tycoon.holding" speaker /></span>
              <BigButton icon="📦" k="tycoon.store" tone="secondary" size="lg" onClick={() => { handle(storeHeld(g)); }} />
            </>
          )}
          {g.phase === 'out' && (
            <BigButton icon="🚪" k="tycoon.out" tone="good" size="xl" onClick={() => handle(tryOut(g))} />
          )}
          {g.phase === 'drill' && (
            <div className="row">
              {drillOrder.map((s) => (
                <BigButton
                  key={s}
                  icon={s === 'tell' ? '📣' : s === 'low' ? '🙇' : s === 'out' ? '🏃' : '📞'}
                  k={`tycoon.evac.${s}` as VoiceKey}
                  tone={DRILL_ORDER.indexOf(s) < g.drillStep ? 'good' : 'warn'}
                  size="lg"
                  disabled={DRILL_ORDER.indexOf(s) < g.drillStep}
                  onClick={() => handle(drillPress(g, s))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
