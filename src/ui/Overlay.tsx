import { ReactNode } from 'react';
import { Line, useMuted } from './Line';
import { setMuted } from '../audio/speak';

export function Stars({ n, total = 3 }: { n: number; total?: number }) {
  return (
    <div className="stars" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < n ? '' : 'off'}>⭐</span>
      ))}
    </div>
  );
}

export function SoundToggle() {
  const muted = useMuted();
  return (
    <button className="big-btn md plain" onClick={() => setMuted(!muted)} aria-label="소리">
      <span className="icon">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}

export function Scrim({ children }: { children: ReactNode }) {
  return <div className="scrim">{children}</div>;
}

export function Toast({ k, tone }: { k: Parameters<typeof Line>[0]['k']; tone?: 'bad' | 'good' }) {
  return (
    <div className={`toast ${tone ?? ''}`}>
      <Line k={k} />
    </div>
  );
}
