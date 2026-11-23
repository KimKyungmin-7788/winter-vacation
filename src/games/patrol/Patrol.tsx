import { useEffect, useReducer, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from '../../three/Labels';
import { Group, Vector3 } from 'three';
import { GameCanvas, QuarterCamera, TapGround } from '../../three/Scene';
import { Avatar } from '../../three/Avatar';
import { Block, Pine, SnowMound } from '../../three/Blocks';
import { useWalker } from '../../three/useWalker';
import { useApp } from '../../store/useApp';
import { BigButton, Line } from '../../ui/Line';
import { chime, beep } from '../../audio/sfx';
import { speak } from '../../audio/speak';
import { VOICE, VoiceKey } from '../../data/voice';
import { backend } from '../../lib';
import type { RoomChannel } from '../../lib/backend';
import { applyRemoteOut, CoopMsg, doneKids, isCoopMsg } from './coop';
import { exposeE2E, GameProps, starsFromMistakes, useMistakes, useToast } from '../common';
import {
  BOUNDS, callOut, dialPress, fallChoice, ICE, initPatrol, Kid, onIce, PatrolEvent, PatrolState, pickPlace, Place, PLACES,
  resolvedCount, selectKid, SLED_X1, targets, tickPatrol,
} from './logic';

function Ripple({ x, z }: { x: number; z: number }) {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((g, i) => {
      if (!g) return;
      const t = (clock.elapsedTime * 0.8 + i * 0.5) % 1.5;
      g.scale.setScalar(0.6 + t * 1.6);
      g.visible = t < 1.4;
    });
  });
  return (
    <group position={[x, 0.3, z]}>
      {[0, 1].map((i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <Block p={[0, 0, 0]} s={[1.6, 0.05, 1.6]} c="#2b8be0" emissive="#2b8be0" opacity={0.55} />
        </group>
      ))}
      <Label position={[0, 1.9, 0]}><div style={{ fontSize: 46, pointerEvents: 'none' }}>💦🆘</div></Label>
    </group>
  );
}

function KidView({ k, selected, hint, onTap, fallen }: { k: Kid; selected: boolean; hint: boolean; onTap: () => void; fallen: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.set(k.x, 0.25, k.z);
    if (k.state === 'onIce' && !fallen) ref.current.rotation.y = Math.sin(clock.elapsedTime + k.id) * 0.6;
  });
  if (fallen) return null;
  return (
    <group ref={ref}>
      <Avatar character={k.character} walking={k.state === 'leaving'} scale={0.9} />
      <mesh position={[0, 1, 0]} onPointerDown={(e) => { e.stopPropagation(); onTap(); }}>
        <boxGeometry args={[1.8, 2.4, 1.8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {selected && <Block p={[0, 0.02, 0]} s={[1.8, 0.06, 1.8]} c="#ffe066" emissive="#ffe066" />}
      {hint && k.state === 'onIce' && <Label position={[0, 2.5, 0]}><div className="pulse" style={{ fontSize: 40, pointerEvents: 'none' }}>❗</div></Label>}
    </group>
  );
}

function Landmarks() {
  return (
    <>
      {/* 다리 */}
      <group position={[-1, 0, 0]}>
        <Block p={[0, 1.2, 0]} s={[2.6, 0.4, 8]} c="#b88a5a" />
        <Block p={[-1.2, 1.9, 0]} s={[0.2, 1, 8]} c="#8a6238" />
        <Block p={[1.2, 1.9, 0]} s={[0.2, 1, 8]} c="#8a6238" />
        <Block p={[0, 0.6, 3.6]} s={[2.6, 1.2, 0.8]} c="#a07848" />
        <Block p={[0, 0.6, -3.6]} s={[2.6, 1.2, 0.8]} c="#a07848" />
      </group>
      {/* 큰 나무 */}
      <group position={[10, 0, -4.8]}>
        <Block p={[0, 1.5, 0]} s={[0.9, 3, 0.9]} c="#7a5230" />
        <Block p={[0, 3.6, 0]} s={[3.6, 1.6, 3.6]} c="#2f7d52" />
        <Block p={[0, 4.8, 0]} s={[2.4, 1.2, 2.4]} c="#3a9462" />
        <Block p={[0, 5.5, 0]} s={[2, 0.3, 2]} c="#fff" />
      </group>
      {/* 빨간 집 */}
      <group position={[15, 0, 5.6]}>
        <Block p={[0, 1.2, 0]} s={[3.4, 2.4, 3.2]} c="#e7dcc8" />
        <Block p={[0, 2.8, 0]} s={[3.8, 0.9, 3.6]} c="#d94a3a" />
        <Block p={[0, 3.3, 0]} s={[3.6, 0.3, 3.4]} c="#fff" />
        <Block p={[0, 0.8, 1.62]} s={[0.8, 1.6, 0.06]} c="#7a4a2c" />
      </group>
    </>
  );
}

interface Remote { x: number; z: number; ch: string; nick: string; seen: number }

function RemoteAvatar({ id, remotes }: { id: string; remotes: React.MutableRefObject<Map<string, Remote>> }) {
  const ref = useRef<Group>(null);
  const cur = useRef<Vector3 | null>(null);
  const [moving, setMoving] = useState(false);
  const mv = useRef(false);
  useFrame((_, dt) => {
    const r = remotes.current.get(id);
    if (!r || !ref.current) return;
    if (!cur.current) cur.current = new Vector3(r.x, 0, r.z);
    const dx = r.x - cur.current.x;
    const dz = r.z - cur.current.z;
    const d = Math.hypot(dx, dz);
    const m = d > 0.15;
    if (m) ref.current.rotation.y = Math.atan2(dx, dz);
    cur.current.lerp(new Vector3(r.x, 0, r.z), Math.min(1, dt * 6));
    ref.current.position.copy(cur.current);
    if (m !== mv.current) { mv.current = m; setMoving(m); }
  });
  const r = remotes.current.get(id);
  if (!r) return null;
  return (
    <group ref={ref}>
      <Avatar character={r.ch} equipped={{ vest: true }} walking={moving} />
      <Label position={[0, 2.9, 0]}><div className="pill" style={{ fontSize: 20, padding: '2px 12px' }}>{r.nick}</div></Label>
    </group>
  );
}

function PatrolWorld({
  st, onEvent, onBlocked, equipped, character, tickUi,
  remotes, remoteIds, onPos, coop,
}: { st: React.MutableRefObject<PatrolState>; onEvent: (e: PatrolEvent) => void; onBlocked: () => void; equipped: object; character: string; tickUi: () => void; remotes: React.MutableRefObject<Map<string, Remote>>; remoteIds: string[]; onPos: (x: number, z: number) => void; coop: boolean }) {
  const avatar = useRef<Group>(null);
  const buddy = useRef<Group>(null);
  const buddyPos = useRef(new Vector3(-2, 0, 5));
  const focus = useRef<Vector3 | null>(new Vector3(0, 0, 5));
  const walker = useWalker({
    avatar,
    start: [0, 5.5],
    bounds: BOUNDS,
    canStand: (x, z) => !onIce(x, z),
    onBlocked,
  });
  const [buddySay, setBuddySay] = useState(false);
  const posT = useRef(0);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const s = st.current;
    const events = tickPatrol(s, dt);
    if (events.length) {
      events.forEach(onEvent);
      tickUi();
    }
    // 카메라: 빠진 친구가 있으면 그쪽을 비춘다
    if (s.focus && s.fallKid) focus.current = new Vector3(s.fallKid.x, 0, s.fallKid.z);
    else focus.current = walker.follow.current;
    // 동료는 플레이어 곁을 따라다닌다
    const goal = new Vector3(walker.pos.current.x - 2, 0, walker.pos.current.z + 1.6);
    buddyPos.current.lerp(goal, Math.min(1, dt * 2));
    if (buddy.current) {
      buddy.current.position.copy(buddyPos.current);
      buddy.current.rotation.y = Math.atan2(walker.pos.current.x - buddyPos.current.x, walker.pos.current.z - buddyPos.current.z);
    }
    posT.current += dt;
    if (posT.current > 0.2) {
      posT.current = 0;
      onPos(walker.pos.current.x, walker.pos.current.z);
    }
    const bs = events.some((e) => e.type === 'buddy');
    if (bs) {
      setBuddySay(true);
      setTimeout(() => setBuddySay(false), 3500);
    }
  });

  const s = st.current;
  return (
    <>
      <QuarterCamera target={[0, 0, 0]} fitWidth={22} fitHeight={14} follow={focus} />
      <TapGround onTap={(p) => walker.go(p)} />
      {/* 눈 둑 */}
      <Block p={[0, -0.5, 6.5]} s={[BOUNDS.x * 2 + 12, 1, 13]} c="#f6fbff" />
      <Block p={[0, -0.5, -6.5]} s={[BOUNDS.x * 2 + 12, 1, 13]} c="#f6fbff" />
      {/* 얼어붙은 개울 */}
      <Block p={[0, -0.35, 0]} s={[ICE.x1 * 2 + 4, 0.8, (ICE.z1 - ICE.z0)]} c="#5fb4ec" />
      <Block p={[0, 0.06, 0]} s={[ICE.x1 * 2 + 4, 0.1, (ICE.z1 - ICE.z0) - 0.2]} c="#a9dcf8" emissive="#6fc0ee" />
      {[-14, -9, -4, 2, 7, 12, 16].map((x, i) => <Block key={x} p={[x, 0.13, ((i * 7) % 5) / 2 - 1]} s={[2.6, 0.03, 0.14]} c="#ffffff" />)}
      {/* 안내 표지 */}
      {[[-14, -3.7], [-2, 3.7], [8, 3.7]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Block p={[0, 0.9, 0]} s={[0.15, 1.8, 0.15]} c="#6b6f78" />
          <Block p={[0, 1.9, 0]} s={[1.0, 0.8, 0.12]} c={s.level === 'da' && x < SLED_X1 ? '#3dbd7d' : '#e2574c'} />
          <Label position={[0, 3, 0]}>
            <div className="pill" style={{ fontSize: 22, padding: '2px 14px', background: s.level === 'da' && x < SLED_X1 ? '#e8fbf0' : '#fff0ee' }}>
              {s.level === 'da' && x < SLED_X1 ? `✅🛷 ${VOICE['patrol.sign.sled']}` : `🚫🧊${s.level === 'da' ? ' ' + VOICE['patrol.sign.noice'] : ''}`}
            </div>
          </Label>
        </group>
      ))}
      {s.level === 'da' && <Block p={[(ICE.x0 + SLED_X1) / 2, 0.14, 0]} s={[SLED_X1 - ICE.x0, 0.04, 5.8]} c="#c8f0d8" opacity={0.7} />}
      <Landmarks />
      {[[-15, 7.5], [-8, 8], [5, 8], [-16, -7.5], [4, -8], [14, -8]].map(([x, z], i) => <Pine key={i} p={[x, 0, z]} s={0.9 + (i % 3) * 0.2} />)}
      {[[-5, -6], [12, 7.5]].map(([x, z], i) => <SnowMound key={i} p={[x, 0, z]} />)}
      {/* 아이들 */}
      {s.kids.map((k) => (
        <KidView
          key={k.id}
          k={k}
          selected={s.selected === k.id}
          hint={s.level === 'ga' && k.isTarget}
          fallen={!!k.fall && (s.phase !== 'search')}
          onTap={() => {
            selectKid(s, k.id, walker.pos.current.x, walker.pos.current.z).forEach(onEvent);
            tickUi();
          }}
        />
      ))}
      {s.fallKid && s.phase !== 'done' && s.phase !== 'search' && <Ripple x={s.fallKid.x} z={s.fallKid.z} />}
      {/* 학생 */}
      <Avatar ref={avatar} character={character} equipped={equipped} walking={walker.walking} />
      {remoteIds.map((id) => <RemoteAvatar key={id} id={id} remotes={remotes} />)}
      {/* 순찰 친구 (NPC) — 함께 하기에서는 진짜 친구가 대신한다 */}
      <group ref={buddy} visible={!coop}>
        {!coop && <Avatar character="dog" equipped={{ vest: true, helmet: false }} walking />}
        {buddySay && <Label position={[0, 3, 0]}><div style={{ fontSize: 42 }}>📣</div></Label>}
      </group>
    </>
  );
}

export default function Patrol({ level: ownLevel, onFinish, coop = false }: GameProps) {
  const student0 = useApp((s) => s.student);
  const isCoop = coop && !!student0;
  // 함께 하기는 모두가 같은 지도(가 수준)로 한다
  const level = isCoop ? 'ga' : ownLevel;
  const st = useRef<PatrolState>((() => {
    const s0 = initPatrol(level);
    if (isCoop) s0.buddyDone = 1; // NPC 동료 대신 진짜 친구
    return s0;
  })());
  const remotes = useRef<Map<string, Remote>>(new Map());
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const room = useRef<RoomChannel | null>(null);
  const myId = useRef(Math.random().toString(36).slice(2, 10));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const { toast, show } = useToast();
  const mistakes = useMistakes();
  const equipped = useApp((s) => s.equipped);
  const student = useApp((s) => s.student);
  const done = useRef(false);
  exposeE2E(() => st.current);
  const lastBlock = useRef(0);

  const onEvent = (e: PatrolEvent) => {
    switch (e.type) {
      case 'selected': break;
      case 'far': show('patrol.closer', undefined, 2200); break;
      case 'out':
        chime();
        show('patrol.out.ok', 'good', 2200);
        room.current?.send({ t: 'out', kid: e.id } satisfies CoopMsg);
        break;
      case 'bank': show('patrol.safeBank', undefined, 2800); break;
      case 'sled': mistakes.add('called_sled_zone'); show('patrol.reason.called_sled', 'bad', 5500); break;
      case 'buddy': show('patrol.buddy', 'good', 3200); break;
      case 'fall': beep(520, 300, 0.12); show('patrol.fall', 'bad', 0); break;
      case 'goIn': mistakes.add('go_in_water'); show('patrol.reason.go_in_water', 'bad', 7000); break;
      case 'shout': show('patrol.shout.say', 'good', 3500, () => setTimeout(() => void speak('patrol.dial.ask'), 200)); break;
      case 'wrongNumber': mistakes.add('wrong_number'); show('patrol.reason.wrong_number', 'bad', 3500); break;
      case 'dialOk': chime(); show(st.current.phase === 'place' ? 'patrol.place.ask' : 'patrol.dial.ok', st.current.phase === 'place' ? undefined : 'good', st.current.phase === 'place' ? 0 : 2000); break;
      case 'placeWrong': mistakes.add('wrong_place'); show('patrol.reason.wrong_place', 'bad', 3500); break;
      case 'win':
        if (!done.current) {
          done.current = true;
          const wait = st.current.level === 'na' ? 2200 : 0;
          setTimeout(() => show('patrol.done', 'good', 2600), wait);
          setTimeout(() => onFinish({ stars: starsFromMistakes(mistakes.count()), mistakes: mistakes.all() }), wait + 2600);
        }
        break;
      default: break;
    }
    bump();
  };

  // 실시간 방
  useEffect(() => {
    if (!isCoop || !student0) return;
    const ch = backend.openRoom(`patrol-${student0.class_id}`);
    room.current = ch;
    ch.onMessage((m) => {
      if (!isCoopMsg(m)) return;
      const msg = m as CoopMsg;
      if (msg.t === 'pos') {
        const isNew = !remotes.current.has(msg.id);
        remotes.current.set(msg.id, { x: msg.x, z: msg.z, ch: msg.ch, nick: msg.nick, seen: Date.now() });
        if (isNew) setRemoteIds([...remotes.current.keys()]);
      } else if (msg.t === 'out') {
        if (applyRemoteOut(st.current, msg.kid)) {
          show('patrol.coop.friend', 'good', 2600);
          bump();
        }
      } else if (msg.t === 'hello') {
        ch.send({ t: 'sync', done: doneKids(st.current) } satisfies CoopMsg);
      } else if (msg.t === 'sync') {
        msg.done.forEach((id) => applyRemoteOut(st.current, id));
        bump();
      }
    });
    ch.send({ t: 'hello', id: myId.current } satisfies CoopMsg);
    // 오래 소식이 없는 친구는 지운다
    const gc = setInterval(() => {
      let changed = false;
      for (const [id, r] of remotes.current) if (Date.now() - r.seen > 5000) { remotes.current.delete(id); changed = true; }
      if (changed) setRemoteIds([...remotes.current.keys()]);
    }, 2000);
    return () => {
      clearInterval(gc);
      ch.close();
      room.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    show(isCoop ? 'patrol.coop.tip' : level === 'ga' ? 'patrol.tip.ga' : level === 'na' ? 'patrol.tip.na' : 'patrol.tip.da', undefined, 6500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = st.current;
  const total = targets(s).length;
  const found = resolvedCount(s);

  return (
    <>
      <div className="canvas-wrap">
        <GameCanvas bg="#dcefff">
          <PatrolWorld
            st={st}
            onEvent={onEvent}
            equipped={{ ...equipped, vest: true }}
            character={student?.character_key ?? 'penguin'}
            tickUi={bump}
            remotes={remotes}
            remoteIds={remoteIds}
            coop={isCoop}
            onPos={(x, z) => room.current?.send({ t: 'pos', id: myId.current, x, z, ch: student0?.character_key ?? 'penguin', nick: student0?.nickname ?? '' } satisfies CoopMsg)}
            onBlocked={() => {
              const now = Date.now();
              if (now - lastBlock.current > 3500) {
                lastBlock.current = now;
                mistakes.add('step_on_ice');
                show('patrol.noIce', 'bad', 2500);
              }
            }}
          />
        </GameCanvas>
      </div>
      <div className="overlay">
        <div className="hud-top" style={{ paddingRight: 280 }}>
          <div className="pill" style={{ fontSize: 34 }} aria-label="순찰 점수">
            {Array.from({ length: total }, (_, i) => <span key={i} style={{ opacity: i < found ? 1 : 0.25 }}>⭐</span>)}
          </div>
        </div>
        {toast}
        {s.phase === 'search' && s.selected !== null && (
          <div className="hud-bottom">
            <BigButton icon="📣" k="patrol.out" tone="warn" size="xl" className="pulse" onClick={() => { callOut(s).forEach(onEvent); }} />
          </div>
        )}
        {s.phase === 'fall' && (
          <div className="hud-bottom">
            <BigButton icon="🏊" k="patrol.enter" tone="secondary" size="xl" onClick={() => fallChoice(s, 'enter').forEach(onEvent)} />
            <BigButton icon="📣" k="patrol.shout" tone="good" size="xl" onClick={() => fallChoice(s, 'shout').forEach(onEvent)} />
          </div>
        )}
        {s.phase === 'dial' && (
          <div className="card" style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', padding: 14, pointerEvents: 'auto' }}>
            <div style={{ fontSize: 44, fontWeight: 700, minHeight: 56 }}>📞 {s.dial.split('').join(' ') || '…'}</div>
            <div className="pin-pad" style={{ gridTemplateColumns: 'repeat(5, 1fr)', margin: 4 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
                <button key={d} style={{ fontSize: 44, minHeight: 78 }} onClick={() => { beep(700 + Number(d) * 40, 90); dialPress(s, d).forEach(onEvent); bump(); }}>{d}</button>
              ))}
            </div>
            <Line k="patrol.dial.ask" speaker />
          </div>
        )}
        {s.phase === 'place' && (
          <div className="hud-bottom">
            {PLACES.map((p: Place) => (
              <BigButton
                key={p}
                icon={p === 'bridge' ? '🌉' : p === 'tree' ? '🌲' : '🏠'}
                k={`patrol.place.${p}` as VoiceKey}
                tone="primary"
                size="xl"
                onClick={() => pickPlace(s, p).forEach(onEvent)}
                sayOnPress
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

