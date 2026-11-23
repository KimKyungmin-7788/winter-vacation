import { isMuted } from './speak';

/** 경보음 같은 짧은 효과음 (파일 없이 WebAudio로 만든다) */
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function beep(freq = 880, ms = 160, vol = 0.12): void {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + ms / 1000);
}

export function chime(): void {
  beep(660, 90, 0.1);
  setTimeout(() => beep(990, 140, 0.1), 100);
}

export function startAlarm(): void {
  if (timer) return;
  let hi = false;
  timer = setInterval(() => {
    beep(hi ? 760 : 980, 200, 0.07);
    hi = !hi;
  }, 420);
}
export function stopAlarm(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
