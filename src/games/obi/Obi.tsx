import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from '../../three/Labels';
import { Group, Vector3 } from 'three';
import { GameCanvas, QuarterCamera } from '../../three/Scene';
import { Avatar } from '../../three/Avatar';
import { Block, Pine, SnowMound } from '../../three/Blocks';
import { useApp } from '../../store/useApp';
import { BigButton } from '../../ui/Line';
import { speak } from '../../audio/speak';
import { GameProps, starsFromMistakes, useMistakes, useToast } from '../common';
import type { VoiceKey } from '../../data/voice';
import {
  buildCourse, Course, initObi, ObiEvent, ObiState, pressCross, pressHands, pressMode, pressRail,
  segOrigin, stepObi, worldAt,
} from './course';

const W = 3; // 길 너비

function Sparkle({ x, z, seed }: { x: number; z: number; seed: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3 + seed * 5);
    ref.current.scale.setScalar(0.4 + k * 0.9);
    ref.current.position.y = 0.3 + k * 0.15;
  });
  return (
    <group ref={ref} position={[x, 0.3, z]}>
      <Block p={[0, 0, 0]} s={[0.14, 0.14, 0.14]} c="#ffffff" emissive="#ffffff" />
    </group>
  );
}

function SegmentView({ course, i }: { course: Course; i: number }) {
  const seg = course.segs[i];
  const o = segOrigin(course, i);
  const along = seg.dir === 'x';
  const cx = o.x + (along ? seg.len / 2 : 0);
  const cz = o.z + (along ? 0 : seg.len / 2);
  const size = (h: number, w = W): [number, number, number] => (along ? [seg.len, h, w] : [w, h, seg.len]);
  const level = course.level;
  const blackIce = level === 'da';
  const sparkles = useMemo(
    () => (seg.type === 'ice' && !blackIce ? Array.from({ length: Math.round(seg.len * 2) }, (_, k) => k) : []),
    [seg.type, seg.len, blackIce],
  );
  const base = seg.type === 'road' ? '#f3f7fb' : '#f3f7fb';
  return (
    <group>
      <Block p={[cx, 0.05, cz]} s={size(0.3, W + 0.4)} c={base} />
      {seg.type === 'road' && seg.decor === 'dryShade' && <Block p={[cx, 0.215, cz]} s={size(0.03)} c="#b5bfca" />}
      {seg.type === 'road' && seg.decor === 'wetSun' && <Block p={[cx, 0.215, cz]} s={size(0.03, 1.4)} c="#d8eefb" />}
      {seg.type === 'ice' && (
        <>
          <Block p={[cx, 0.215, cz]} s={size(0.04)} c={blackIce ? '#6d8399' : '#aee4ff'} emissive={blackIce ? undefined : '#74c9f5'} />
          {blackIce && <Block p={[cx, 0.24, cz]} s={size(0.02, 0.5)} c="#9fc2dc" emissive="#7aa8c8" />}
        </>
      )}
      {(blackIce && (seg.type === 'ice' || seg.decor === 'dryShade')) && (
        // 그늘: 길옆 높은 담
        <Block p={[along ? cx : cx + 2.6, 1.6, along ? cz + 2.6 : cz]} s={along ? [seg.len, 3.2, 0.4] : [0.4, 3.2, seg.len]} c="#8b9bb0" />
      )}
      {sparkles.map((k) => {
        const t = (k + 0.5) / sparkles.length;
        const off = ((k * 37) % 10) / 10 - 0.5;
        return <Sparkle key={k} x={along ? o.x + t * seg.len : o.x + off * 2.2} z={along ? o.z + off * 2.2 : o.z + t * seg.len} seed={k} />;
      })}
      {seg.type === 'stairs' &&
        Array.from({ length: Math.round(seg.len) }, (_, k) => (
          <Block key={k} p={along ? [o.x + k + 0.5, 0.25 + k * 0.0, o.z] : [o.x, 0.25, o.z + k + 0.5]} s={along ? [0.12, 0.08, W] : [W, 0.08, 0.12]} c="#9aa7b6" />
        ))}
      {seg.type === 'stairs' &&
        [-1, 1].map((side) =>
          Array.from({ length: Math.round(seg.len / 1.25) + 1 }, (_, k) => (
            <Block key={`${side}${k}`} p={along ? [o.x + k * 1.25, 0.7, o.z + side * 1.75] : [o.x + side * 1.75, 0.7, o.z + k * 1.25]} s={[0.14, 1.0, 0.14]} c="#ffcc33" />
          )),
        )}
      {seg.type === 'stairs' && [-1, 1].map((side) => (
        <Block key={`r${side}`} p={along ? [cx, 1.15, o.z + side * 1.75] : [o.x + side * 1.75, 1.15, cz]} s={along ? [seg.len, 0.1, 0.1] : [0.1, 0.1, seg.len]} c="#ffcc33" />
      ))}
      {seg.type === 'cross' && (
        <>
          <Block p={[cx, 0.03, cz]} s={along ? [seg.len, 0.16, 18] : [18, 0.16, seg.len]} c="#59606b" />
          {Array.from({ length: 5 }, (_, k) => (
            <Block key={k} p={along ? [cx, 0.13, cz - 1.2 + k * 0.6] : [cx - 1.2 + k * 0.6, 0.13, cz]} s={along ? [seg.len, 0.04, 0.35] : [0.35, 0.04, seg.len]} c="#ffffff" />
          ))}
        </>
      )}
    </group>
  );
}

function Scenery({ course }: { course: Course }) {
  const items = useMemo(() => {
    const out: ReactElement[] = [];
    let n = 0;
    for (let s = 1; s < course.length; s += 2.7) {
      const w = worldAt(course, s);
      const side = n % 2 === 0 ? 1 : -1;
      const dist = 3.4 + ((n * 7) % 3);
      const along = Math.abs(Math.sin(w.heading)) > 0.5; // dir x
      const px = along ? w.x : w.x + side * dist;
      const pz = along ? w.z + side * dist : w.z;
      const seg = course.segs[Math.min(course.segs.length - 1, Math.floor((s / course.length) * course.segs.length))];
      if (seg?.type !== 'cross') out.push(n % 3 === 0 ? <SnowMound key={n} p={[px, 0, pz]} s={0.9} /> : <Pine key={n} p={[px, 0, pz]} s={0.85 + (n % 3) * 0.2} />);
      n++;
    }
    return out;
  }, [course]);
  return <>{items}</>;
}

function Flag({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <Block p={[0, 1, 0]} s={[0.1, 2, 0.1]} c="#555" />
      <Block p={[0.4, 1.7, 0]} s={[0.8, 0.5, 0.06]} c={color} />
    </group>
  );
}

function Car({ st, course, crossIdx }: { st: React.MutableRefObject<ObiState>; course: Course; crossIdx: number }) {
  const ref = useRef<Group>(null);
  const o = segOrigin(course, crossIdx);
  const seg = course.segs[crossIdx];
  const cz = o.z + seg.len / 2;
  const cx = o.x;
  const x = useRef(-14);
  useFrame((_, dt) => {
    const s = st.current;
    let target = x.current;
    if (s.slip?.reason === 'cross_car') {
      x.current += 16 * dt; // 눈길이라 멈추지 못하고 지나간다
      target = x.current;
    } else if (s.seg > crossIdx) {
      x.current += 8 * dt;
      target = x.current;
    } else if (s.waiting || s.crossing) {
      const t = Math.min(1, s.carT / 4);
      target = -14 + 11.4 * (1 - (1 - t) * (1 - t));
      if (s.crossing) target = -2.6;
      x.current = target;
    } else {
      x.current = -14;
      target = -14;
    }
    if (ref.current) ref.current.position.set(cx + x.current, 0.1, cz);
  });
  return (
    <group ref={ref}>
      <Block p={[0, 0.5, 0]} s={[2.6, 0.7, 1.3]} c="#d94a3a" />
      <Block p={[-0.2, 1.1, 0]} s={[1.4, 0.55, 1.2]} c="#f2c9c3" />
      <Block p={[1.3, 0.5, 0.4]} s={[0.08, 0.2, 0.2]} c="#fff6a0" emissive="#fff6a0" />
      <Block p={[1.3, 0.5, -0.4]} s={[0.08, 0.2, 0.2]} c="#fff6a0" emissive="#fff6a0" />
      <Label position={[0, 2.2, 0]}>
        <div style={{ fontSize: 40 }}>{'🚗'}</div>
      </Label>
    </group>
  );
}

function ObiWorld({
  course, st, onEvent, level,
}: { course: Course; st: React.MutableRefObject<ObiState>; onEvent: (e: ObiEvent) => void; level: string }) {
  const equipped = useApp((s) => s.equipped);
  const student = useApp((s) => s.student);
  const avatar = useRef<Group>(null);
  const follow = useRef<Vector3 | null>(new Vector3(0, 0, 0));
  const [walking, setWalking] = useState(false);
  const wRef = useRef(false);
  const [spin, setSpin] = useState(false);
  const spinRef = useRef(false);
  const crossIdx = course.segs.findIndex((s) => s.type === 'cross');

  useFrame((_, dt) => {
    const s = st.current;
    const events = stepObi(s, Math.min(dt, 0.05), course);
    events.forEach(onEvent);
    const w = worldAt(course, s.s);
    const a = avatar.current;
    if (a) {
      a.position.set(w.x, 0.2, w.z);
      if (s.slip) {
        a.rotation.y += 14 * dt;
        a.rotation.x = -0.5;
      } else {
        a.rotation.y = w.heading;
        a.rotation.x = 0;
      }
    }
    const ahead = Math.abs(Math.sin(w.heading)) > 0.5 ? [3, 0] : [0, 3];
    follow.current = new Vector3(w.x + ahead[0], 0, w.z + ahead[1]);
    const moving = s.v > 0.3 && !s.slip;
    if (moving !== wRef.current) {
      wRef.current = moving;
      setWalking(moving);
    }
    const sp = !!s.slip && s.slip.reason !== 'cross_car';
    if (sp !== spinRef.current) {
      spinRef.current = sp;
      setSpin(sp);
    }
  });

  const end = worldAt(course, course.length);
  return (
    <>
      <QuarterCamera target={[0, 0, 0]} fitWidth={20} fitHeight={13} follow={follow} />
      <Block p={[end.x / 2, -0.6, end.z / 2]} s={[Math.abs(end.x) + 40, 1, Math.abs(end.z) + 40]} c="#e9f3fb" />
      {course.segs.map((_, i) => (
        <SegmentView key={i} course={course} i={i} />
      ))}
      <Scenery course={course} />
      {course.checkpoints.map((cp, i) => {
        const w = worldAt(course, cp);
        return <Flag key={i} x={w.x + (course.segs[0].dir === 'x' && Math.abs(Math.sin(w.heading)) > 0.5 ? 0 : 2) } z={w.z + (Math.abs(Math.sin(w.heading)) > 0.5 ? 2 : 0)} color={i === 0 ? '#3dbd7d' : '#ffb020'} />;
      })}
      {/* 도착 문 */}
      <group position={[end.x, 0, end.z]}>
        <Block p={[-1.7, 1.4, 0]} s={[0.4, 2.8, 0.4]} c="#3dbd7d" />
        <Block p={[1.7, 1.4, 0]} s={[0.4, 2.8, 0.4]} c="#3dbd7d" />
        <Block p={[0, 2.9, 0]} s={[4, 0.5, 0.4]} c="#3dbd7d" />
        <Label position={[0, 3.8, 0]}><div style={{ fontSize: 44 }}>🏁</div></Label>
      </group>
      {crossIdx >= 0 && <Car st={st} course={course} crossIdx={crossIdx} />}
      <Avatar ref={avatar} character={student?.character_key ?? 'penguin'} equipped={{ ...equipped, shoes: equipped.shoes }} walking={walking} handsInPocket={level !== 'ga' && !st.current.handsOut} />
      {spin && (
        <Label position={[worldAt(course, st.current.s).x, 2.6, worldAt(course, st.current.s).z]}>
          <div style={{ fontSize: 48 }}>💫</div>
        </Label>
      )}
    </>
  );
}

export default function Obi({ level, onFinish }: GameProps) {
  const course = useMemo(() => buildCourse(level), [level]);
  const st = useRef<ObiState>(initObi(course));
  const [ui, setUi] = useState({ mode: st.current.mode, hands: st.current.handsOut, rail: st.current.rail, waiting: false, carStopped: false });
  const { toast, show } = useToast();
  const mistakes = useMistakes();
  const done = useRef(false);

  const sync = () =>
    setUi({ mode: st.current.mode, hands: st.current.handsOut, rail: st.current.rail, waiting: st.current.waiting, carStopped: st.current.carStopped });

  useEffect(() => {
    const k: VoiceKey = level === 'ga' ? 'obi.tip.ga' : level === 'na' ? 'obi.tip.na' : 'obi.tip.da';
    show(k, undefined, 6000);
    const t = setInterval(sync, 150);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEvent = (e: ObiEvent) => {
    if (e.type === 'warn') show('obi.warn.ice', undefined, 3500);
    else if (e.type === 'wait') show('obi.cross.wait', undefined, 0);
    else if (e.type === 'mistake') {
      mistakes.add(e.reason === 'cross_car' ? 'car_not_stopped' : e.reason === 'run_on_ice' ? 'run_on_ice' : e.reason);
      show(`obi.reason.${e.reason}` as VoiceKey, 'bad', 5200);
    } else if (e.type === 'respawn') {
      show('obi.restart', undefined, 2000);
      sync();
    } else if (e.type === 'finish' && !done.current) {
      done.current = true;
      show('obi.goal', 'good', 1800);
      setTimeout(() => onFinish({ stars: starsFromMistakes(mistakes.count()), mistakes: mistakes.all() }), 1600);
    }
  };

  const press = (fn: () => void) => () => {
    fn();
    sync();
  };

  return (
    <>
      <div className="canvas-wrap">
        <GameCanvas>
          <ObiWorld course={course} st={st} onEvent={onEvent} level={level} />
        </GameCanvas>
      </div>
      <div className="overlay">
        {toast}
        <div className="hud-bottom spread">
          <div className="row">
            {level !== 'ga' && (
              <>
                <BigButton icon="🧤" k="obi.hands" tone="warn" size="lg" active={ui.hands} disabled={ui.hands} onClick={press(() => pressHands(st.current))} sayOnPress />
                <BigButton icon="🪜" k="obi.rail" tone="warn" size="lg" active={ui.rail} onClick={press(() => pressRail(st.current))} sayOnPress />
              </>
            )}
          </div>
          {ui.waiting ? (
            <BigButton
              icon="🚸"
              k="obi.cross"
              tone="good"
              size="xl"
              className={ui.carStopped ? 'pulse' : ''}
              onClick={() => {
                const wasStopped = st.current.carStopped;
                pressCross(st.current).forEach(onEvent);
                if (wasStopped) void speak('obi.cross.go');
                sync();
              }}
            />
          ) : (
            <div className="row">
              <BigButton icon="🐢" k="obi.walk" tone="primary" size="xl" active={ui.mode === 'walk'} onClick={press(() => pressMode(st.current, 'walk'))} />
              <BigButton icon="🏃" k="obi.run" tone="secondary" size="xl" active={ui.mode === 'run'} onClick={press(() => pressMode(st.current, 'run'))} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
