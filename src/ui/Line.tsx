import { ReactNode, useEffect, useSyncExternalStore } from 'react';
import { VOICE, VoiceKey } from '../data/voice';
import { isMuted, onMuteChange, speak, stopSpeaking } from '../audio/speak';

/** 글 + 소리 한 쌍. 글을 누르면 읽어 준다. */
export function Line({ k, className = '', speaker = false }: { k: VoiceKey; className?: string; speaker?: boolean }) {
  return (
    <span className={`line ${className}`} onClick={() => void speak(k)} role="text">
      {VOICE[k]}
      {speaker && <span className="speaker" aria-hidden> 🔊</span>}
    </span>
  );
}

/** 화면이 나타날 때 자동으로 읽기 */
export function useSpeakOnMount(k: VoiceKey | null, deps: unknown[] = []): void {
  useEffect(() => {
    if (!k) return;
    const t = setTimeout(() => void speak(k), 250);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, ...deps]);
}

export function useMuted(): boolean {
  return useSyncExternalStore(onMuteChange, isMuted);
}

interface BtnProps {
  icon?: ReactNode;
  k?: VoiceKey;
  onClick?: () => void;
  onPointerDown?: () => void;
  tone?: 'primary' | 'secondary' | 'warn' | 'good' | 'plain';
  size?: 'xl' | 'lg' | 'md';
  active?: boolean;
  disabled?: boolean;
  className?: string;
  /** 누르면 라벨을 읽어 준다 */
  sayOnPress?: boolean;
  label?: string;
}

/** 큰 터치 버튼: 그림 + 짧은 글 (+ 음성) */
export function BigButton({ icon, k, onClick, onPointerDown, tone = 'primary', size = 'lg', active, disabled, className = '', sayOnPress, label }: BtnProps) {
  return (
    <button
      type="button"
      className={`big-btn ${tone} ${size} ${active ? 'active' : ''} ${className}`}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (sayOnPress && k) void speak(k);
        onClick?.();
      }}
    >
      {icon !== undefined && <span className="icon">{icon}</span>}
      {(k || label) && <span className="label">{label ?? (k ? VOICE[k] : '')}</span>}
    </button>
  );
}
