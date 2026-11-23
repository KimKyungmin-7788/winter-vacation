import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Vector3, type OrthographicCamera as OCam } from 'three';
import { createRegistry, LabelContext, LabelLayer } from './Labels';

/** 어디서나 같은 비스듬한 쿼터뷰 방향 */
const DIR = new Vector3(1, 1.15, 1).normalize();

interface QuarterProps {
  target: [number, number, number];
  /** 화면 가로·세로에 담고 싶은 세계 크기(단위). 태블릿 크기에 맞춰 확대율이 정해진다 */
  fitWidth: number;
  fitHeight: number;
  /** 목표를 부드럽게 따라가기 */
  follow?: React.MutableRefObject<Vector3 | null>;
  distance?: number;
}

export function QuarterCamera({ target, fitWidth, fitHeight, follow, distance = 40 }: QuarterProps) {
  const cam = useRef<OCam>(null);
  const look = useRef(new Vector3(...target));
  const size = useThree((s) => s.size);
  useEffect(() => {
    look.current.set(target[0], target[1], target[2]);
  }, [target[0], target[1], target[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const c = cam.current;
    if (!c) return;
    if (follow?.current) look.current.lerp(follow.current, Math.min(1, dt * 4));
    c.position.copy(look.current).addScaledVector(DIR, distance);
    c.lookAt(look.current);
  });
  const z = Math.min(size.width / fitWidth, size.height / fitHeight);
  return <OrthographicCamera ref={cam} makeDefault zoom={z} near={0.1} far={200} position={[distance, distance, distance]} />;
}

/** 바닥을 만지면 그 지점을 알려 주는 투명 판 */
export function TapGround({
  size = 60,
  y = 0,
  onTap,
}: {
  size?: number;
  y?: number;
  onTap: (p: Vector3) => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onTap(e.point.clone());
      }}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/** 자동 점검용: ?e2e 로 열면 세계 좌표를 화면 좌표로 바꿔 주는 함수를 연다 */
function E2EHook() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!/[?&]e2e/.test(window.location.search)) return;
    const w = window as unknown as { __e2e?: Record<string, unknown> };
    w.__e2e = {
      ...(w.__e2e ?? {}),
      project: (x: number, y: number, z: number) => {
        const v = new Vector3(x, y, z).project(camera);
        return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
      },
    };
  }, [camera, size]);
  return null;
}

export function GameCanvas({ children, bg = '#cfeaff' }: { children: ReactNode; bg?: string }) {
  const registry = useMemo(() => createRegistry(), []);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        flat
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ touchAction: 'none' }}
        onCreated={({ gl }) => gl.setClearColor(bg)}
      >
        <LabelContext.Provider value={registry}>
          <ambientLight intensity={1.6} />
          <directionalLight position={[8, 14, 6]} intensity={1.4} />
          <hemisphereLight args={['#ffffff', '#cfe3f5', 0.6]} />
          {children}
          <E2EHook />
        </LabelContext.Provider>
      </Canvas>
      <LabelLayer registry={registry} />
    </div>
  );
}
