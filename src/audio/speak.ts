import { VOICE, VoiceKey } from '../data/voice';

/**
 * 음성 재생. 미리 만들어 둔 mp3(/audio/<키>.mp3)가 있으면 그것을 쓰고,
 * 없으면 태블릿에 내장된 한국어 음성(speechSynthesis)으로 대신 읽는다.
 * 실행 중에는 외부 TTS 서비스를 부르지 않는다.
 */
let manifest: Set<string> | null = null;
let manifestLoading: Promise<void> | null = null;
let current: HTMLAudioElement | null = null;
let muted = false;
let listeners: Array<() => void> = [];

function loadManifest(): Promise<void> {
  if (manifest) return Promise.resolve();
  manifestLoading ??= fetch('/audio/manifest.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((arr: string[]) => {
      manifest = new Set(arr);
    })
    .catch(() => {
      manifest = new Set();
    });
  return manifestLoading;
}

export function stopSpeaking(): void {
  if (current) {
    current.pause();
    current = null;
  }
  try {
    globalThis.speechSynthesis?.cancel();
  } catch {
    /* 음성 합성이 없는 기기 */
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  if (m) stopSpeaking();
  listeners.forEach((l) => l());
}
export function isMuted(): boolean {
  return muted;
}
export function onMuteChange(l: () => void): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

let koVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (koVoice !== undefined) return koVoice;
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  koVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? null;
  if (voices.length === 0) koVoice = undefined; // 아직 목록이 안 올라옴
  return koVoice ?? null;
}

function speakWithSynthesis(text: string, onEnd?: () => void): void {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.85; // 천천히
  u.pitch = 1.1;
  const v = pickVoice();
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
}

/** 키에 해당하는 문구를 읽어 준다. 끝나면 onEnd 호출. */
export async function speak(key: VoiceKey, onEnd?: () => void): Promise<void> {
  if (muted) {
    onEnd?.();
    return;
  }
  stopSpeaking();
  await loadManifest();
  if (manifest?.has(key)) {
    const a = new Audio(`/audio/${key}.mp3`);
    current = a;
    a.onended = () => onEnd?.();
    a.onerror = () => {
      current = null;
      speakWithSynthesis(VOICE[key], onEnd);
    };
    a.play().catch(() => speakWithSynthesis(VOICE[key], onEnd));
    return;
  }
  speakWithSynthesis(VOICE[key], onEnd);
}
