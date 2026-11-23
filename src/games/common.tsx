import { useCallback, useEffect, useRef, useState } from 'react';
import { Level, GameResult } from '../data/types';
import { VoiceKey } from '../data/voice';
import { speak } from '../audio/speak';
import { Toast } from '../ui/Overlay';

export interface GameProps {
  level: Level;
  /** 게임을 끝까지 했을 때 */
  onFinish: (r: GameResult) => void;
  /** 순찰대 함께 하기 (반 친구들과 같은 맵) */
  coop?: boolean;
}

export function starsFromMistakes(n: number): number {
  if (n === 0) return 3;
  if (n <= 2) return 2;
  return 1;
}

/** 말풍선 + 음성. 같은 말이 연달아 와도 다시 나타난다 */
export function useToast() {
  const [toast, setToast] = useState<{ k: VoiceKey; tone?: 'bad' | 'good'; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const n = useRef(0);
  const show = useCallback((k: VoiceKey, tone?: 'bad' | 'good', ms = 4200, onSpoken?: () => void) => {
    n.current += 1;
    setToast({ k, tone, n: n.current });
    void speak(k, onSpoken);
    if (timer.current) clearTimeout(timer.current);
    if (ms > 0) timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const hide = useCallback(() => setToast(null), []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = toast ? <Toast key={toast.n} k={toast.k} tone={toast.tone} /> : null;
  return { toast: node, show, hide };
}

/** 실수 기록을 모으는 도우미 */
export function useMistakes() {
  const list = useRef<string[]>([]);
  return {
    add: (k: string) => {
      list.current.push(k);
    },
    count: () => list.current.length,
    all: () => [...list.current],
  };
}

/** 자동 점검용(?e2e): 게임 상태를 밖에서 들여다볼 수 있게 한다 */
export function exposeE2E(get: () => unknown): void {
  if (typeof window === 'undefined' || !/[?&]e2e/.test(window.location.search)) return;
  const w = window as unknown as { __e2e?: Record<string, unknown> };
  w.__e2e = { ...(w.__e2e ?? {}), state: get };
}
