import { createContext, ReactNode, useContext, useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';

/**
 * 3D 위치 위에 떠 있는 글/그림(HTML).
 * 캔버스 밖 DOM 층에 그려서 터치가 잘 되고, 매 프레임 위치만 맞춘다.
 */
interface Registry {
  nodes: Map<string, ReactNode>;
  els: Map<string, HTMLDivElement>;
  version: number;
  listeners: Set<() => void>;
  bump(): void;
}

export function createRegistry(): Registry {
  const r: Registry = {
    nodes: new Map(),
    els: new Map(),
    version: 0,
    listeners: new Set(),
    bump() {
      r.version++;
      r.listeners.forEach((l) => l());
    },
  };
  return r;
}

export const LabelContext = createContext<Registry | null>(null);

export function LabelLayer({ registry }: { registry: Registry }) {
  useSyncExternalStore(
    (l) => {
      registry.listeners.add(l);
      return () => registry.listeners.delete(l);
    },
    () => registry.version,
  );
  return (
    <div className="label-layer">
      {[...registry.nodes.entries()].map(([id, node]) => (
        <div
          key={id}
          className="label3d"
          ref={(el) => {
            if (el) registry.els.set(id, el);
            else registry.els.delete(id);
          }}
        >
          {node}
        </div>
      ))}
    </div>
  );
}

const v = new Vector3();

export function Label({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  const reg = useContext(LabelContext);
  const id = useId();
  const g = useRef<Group>(null);
  const nodeRef = useRef(children);
  nodeRef.current = children;

  // 내용이 바뀔 때마다 층에 알린다
  useEffect(() => {
    if (!reg) return;
    reg.nodes.set(id, children);
    reg.bump();
  });
  useEffect(() => {
    return () => {
      reg?.nodes.delete(id);
      reg?.bump();
    };
  }, [reg, id]);

  useFrame(({ camera, size }) => {
    const el = reg?.els.get(id);
    const grp = g.current;
    if (!el || !grp) return;
    grp.getWorldPosition(v);
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    el.style.zIndex = String(Math.round(5 + (1 - (v.z * 0.5 + 0.5)) * 40));
    el.style.visibility = 'visible';
  });

  return useMemo(() => <group ref={g} position={position} />, [position[0], position[1], position[2]]); // eslint-disable-line react-hooks/exhaustive-deps
}
