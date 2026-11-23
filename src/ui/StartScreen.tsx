import { useEffect, useState } from 'react';
import { backend } from '../lib';
import { normalizeCode, RosterEntry } from '../lib/backend';
import { CHARACTER_BY_KEY, PIN_LENGTH, PIN_PICTURES } from '../data/items';
import { Level, LEVELS } from '../data/types';
import { useApp } from '../store/useApp';
import { BigButton, Line, useSpeakOnMount } from './Line';
import { SoundToggle } from './Overlay';
import type { VoiceKey } from '../data/voice';

const CODE_KEY = 'svs.classCode';

function savedCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

type Step = 'code' | 'friend' | 'pin' | 'guest';

export function StartScreen() {
  const loginSnapshot = useApp((s) => s.loginSnapshot);
  const startGuest = useApp((s) => s.startGuest);
  const [code, setCode] = useState(savedCode());
  const [step, setStep] = useState<Step>(savedCode() ? 'friend' : 'code');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [friend, setFriend] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<VoiceKey | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRoster = async (c: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const list = await backend.listRoster(c);
      if (!list) {
        setMsg('start.badCode');
        setStep('code');
        return;
      }
      try {
        localStorage.setItem(CODE_KEY, normalizeCode(c));
      } catch {
        /* 저장이 안 되면 다음에 다시 입력 */
      }
      setRoster(list);
      setStep('friend');
    } catch {
      setMsg('start.loginError');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (savedCode()) void loadRoster(savedCode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakKey: VoiceKey = msg ?? (step === 'code' ? 'start.classCode' : step === 'friend' ? 'start.pickFriend' : step === 'pin' ? 'start.pickPin' : 'start.guestLevel');
  useSpeakOnMount(speakKey, [step, msg]);

  const tryPin = async (next: string) => {
    if (!friend) return;
    setBusy(true);
    try {
      const snap = await backend.studentLogin(friend.id, next);
      if (!snap) {
        setMsg('start.wrongPin');
        setPin('');
      } else {
        loginSnapshot(snap);
      }
    } catch {
      setMsg('start.loginError');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const press = (i: number) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + String(i);
    setPin(next);
    setMsg(null);
    if (next.length === PIN_LENGTH) void tryPin(next);
  };

  return (
    <div className="start-screen">
      <div className="hud-top" style={{ position: 'absolute', top: 0, right: 0 }}>
        <SoundToggle />
      </div>
      <div className="card">
        <div className="big-emoji">⛄❄️🏘️</div>
        <h1><Line k="start.welcome" /></h1>

        {step === 'code' && (
          <>
            <p><Line k="start.classCode" speaker /></p>
            <input
              className="code-input"
              value={code}
              maxLength={6}
              inputMode="text"
              autoCapitalize="characters"
              aria-label="학급 코드"
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
            <div className="row" style={{ marginTop: 16 }}>
              <BigButton icon="➡️" k="start.enter" tone="primary" disabled={code.length < 6 || busy} onClick={() => void loadRoster(code)} />
            </div>
          </>
        )}

        {step === 'friend' && (
          <>
            <p><Line k="start.pickFriend" speaker /></p>
            <div className="friend-grid">
              {roster.map((r) => (
                <button
                  key={r.id}
                  className="friend"
                  onClick={() => {
                    setFriend(r);
                    setPin('');
                    setMsg(null);
                    setStep('pin');
                  }}
                >
                  <span className="em">{CHARACTER_BY_KEY[r.character_key]?.emoji ?? '🐻'}</span>
                  {r.nickname}
                </button>
              ))}
            </div>
            <button
              className="tiny-link"
              onClick={() => {
                try {
                  localStorage.removeItem(CODE_KEY);
                } catch {
                  /* 무시 */
                }
                setCode('');
                setStep('code');
              }}
            >
              <Line k="start.changeClass" />
            </button>
          </>
        )}

        {step === 'pin' && friend && (
          <>
            <p>
              <span style={{ fontSize: 48 }}>{CHARACTER_BY_KEY[friend.character_key]?.emoji}</span> {friend.nickname}
            </p>
            <p><Line k="start.pickPin" speaker /></p>
            <div className="pin-dots">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`}>
                  {i < pin.length ? '●' : ''}
                </div>
              ))}
            </div>
            <div className="pin-pad">
              {PIN_PICTURES.map((p, i) => (
                <button key={i} onClick={() => press(i)} aria-label={`그림 ${i + 1}`}>{p}</button>
              ))}
            </div>
            <div className="row">
              <BigButton icon="⌫" k="start.clear" tone="secondary" size="md" onClick={() => setPin('')} />
              <BigButton icon="⬅️" k="common.back" tone="plain" size="md" onClick={() => setStep('friend')} />
            </div>
          </>
        )}

        {step === 'guest' && (
          <>
            <p><Line k="start.guestLevel" speaker /></p>
            <div className="row">
              {LEVELS.map((lv: Level) => (
                <BigButton key={lv} k={`level.${lv}` as VoiceKey} tone="primary" size="xl" onClick={() => startGuest(lv)} />
              ))}
            </div>
            <p style={{ fontSize: 20 }}><Line k="start.guestNote" /></p>
            <BigButton icon="⬅️" k="common.back" tone="plain" size="md" onClick={() => setStep(savedCode() ? 'friend' : 'code')} />
          </>
        )}

        {msg && <p style={{ color: '#e2574c', fontWeight: 700 }}><Line k={msg} /></p>}

        {step !== 'guest' && (
          <div className="row" style={{ marginTop: 10 }}>
            <BigButton icon="🎮" k="start.guest" tone="warn" size="md" onClick={() => setStep('guest')} />
            <a className="tiny-link" href="#/teacher">선생님</a>
          </div>
        )}
      </div>
    </div>
  );
}
