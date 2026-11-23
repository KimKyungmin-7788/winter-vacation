import { useCallback, useEffect, useState } from 'react';
import { backend } from '../lib';
import { ClassOverview, TeacherUser } from '../lib/backend';
import { CHARACTERS, PIN_LENGTH, PIN_PICTURES } from '../data/items';
import { ClassRecord, GAME_KEYS, Level, LEVELS, LEVEL_LABEL } from '../data/types';
import { GAMES } from '../data/games';

const GAME_NAME = Object.fromEntries(GAMES.map((g) => [g.key, g])) as Record<string, (typeof GAMES)[number]>;

export function Teacher() {
  const [user, setUser] = useState<TeacherUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    backend
      .teacherSession()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="teacher">불러오는 중…</div>;
  return (
    <div className="teacher">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1>🏫 눈꽃마을 선생님 페이지</h1>
        <div>
          <a href="#/" style={{ marginRight: 16 }}>← 학생 화면</a>
          {user && (
            <button
              className="act ghost"
              onClick={async () => {
                await backend.teacherSignOut();
                setUser(null);
              }}
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
      {backend.mode === 'local' && (
        <p className="note">
          🧪 <b>체험 모드</b>: 서버가 연결되지 않아 이 태블릿(브라우저) 안에만 저장돼요. 다른 태블릿에서는 보이지 않아요.
          서버 연결 방법은 README를 보세요.
        </p>
      )}
      {user ? <ClassManager user={user} /> : <Login onLogin={setUser} />}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (u: TeacherUser) => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const local = backend.mode === 'local';

  const run = async (kind: 'in' | 'up') => {
    setBusy(true);
    setErr('');
    try {
      const u = kind === 'in' ? await backend.teacherSignIn(email, pw) : await backend.teacherSignUp(email, pw);
      onLogin(u);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '로그인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 480 }}>
      <h2>선생님 로그인</h2>
      {local ? (
        <button className="act" onClick={() => void run('in')}>시작하기</button>
      ) : (
        <>
          <p>
            <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
          </p>
          <p>
            <input type="password" placeholder="비밀번호 (6자 이상)" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: '100%' }} />
          </p>
          <button className="act" disabled={busy} onClick={() => void run('in')}>로그인</button>{' '}
          <button className="act ghost" disabled={busy} onClick={() => void run('up')}>처음이에요 (가입)</button>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function ClassManager({ user }: { user: TeacherUser }) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const reload = useCallback(async () => {
    try {
      const list = await backend.listClasses();
      setClasses(list);
      setSel((cur) => cur ?? list[0]?.id ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했어요.');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const current = classes.find((c) => c.id === sel) ?? null;
  return (
    <>
      <p style={{ opacity: 0.7 }}>{user.email}</p>
      {err && <p className="err">{err}</p>}
      <div className="panel">
        <h2>우리 반</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {classes.map((c) => (
            <button key={c.id} className={`act ${c.id === sel ? '' : 'ghost'}`} onClick={() => setSel(c.id)}>
              {c.name}
            </button>
          ))}
          <input placeholder="새 학급 이름 (예: 1반)" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="act"
            disabled={!name.trim()}
            onClick={async () => {
              try {
                const c = await backend.createClass(name);
                setName('');
                setSel(c.id);
                await reload();
              } catch (e) {
                setErr(e instanceof Error ? e.message : '만들지 못했어요.');
              }
            }}
          >
            학급 만들기
          </button>
        </div>
      </div>
      {current && (
        <ClassView
          key={current.id}
          cls={current}
          onDeleted={() => {
            setSel(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

function ClassView({ cls, onDeleted }: { cls: ClassRecord; onDeleted: () => void }) {
  const [data, setData] = useState<ClassOverview | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await backend.classOverview(cls.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했어요.');
    }
  }, [cls.id]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            학급 코드 <span className="code">{cls.class_code}</span>
            <div style={{ opacity: 0.7 }}>학생 화면 첫 칸에 이 코드를 넣어요. 한 번 넣으면 이 태블릿에 저장돼요.</div>
          </div>
          <button
            className="act danger"
            onClick={async () => {
              if (confirm(`"${cls.name}" 학급과 학생 기록을 모두 지울까요?`)) {
                await backend.deleteClass(cls.id);
                onDeleted();
              }
            }}
          >
            학급 지우기
          </button>
        </div>
      </div>

      <AddStudent classId={cls.id} onAdded={load} />

      <div className="panel">
        <h2>클리어 현황 <button className="act ghost" onClick={() => void load()}>새로고침</button></h2>
        {err && <p className="err">{err}</p>}
        {data && data.students.length === 0 && <p>아직 학생이 없어요. 위에서 등록해요.</p>}
        {data && data.students.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>학생</th>
                <th>수준 (다음 판부터 적용)</th>
                {GAME_KEYS.map((g) => (
                  <th key={g}>{GAME_NAME[g].emoji} {GAME_NAME[g].entrance}</th>
                ))}
                <th>배지</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => {
                const rows = GAME_KEYS.map((g) => data.progress.find((p) => p.student_id === s.id && p.game_key === g));
                const all = rows.every((r) => r?.cleared);
                return (
                  <tr key={s.id}>
                    <td>
                      {CHARACTERS.find((c) => c.key === s.character_key)?.emoji} {s.nickname}
                    </td>
                    <td>
                      <select
                        value={s.level}
                        onChange={async (e) => {
                          await backend.setStudentLevel(s.id, e.target.value as Level);
                          void load();
                        }}
                      >
                        {LEVELS.map((lv) => (
                          <option key={lv} value={lv}>{LEVEL_LABEL[lv]} 수준</option>
                        ))}
                      </select>
                    </td>
                    {rows.map((r, i) => (
                      <td key={i}>
                        {r?.cleared ? (
                          <>
                            ✅ {'⭐'.repeat(r.stars)}
                            <div style={{ fontSize: 13, opacity: 0.6 }}>{LEVEL_LABEL[r.level]} · {r.play_count}번</div>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                    ))}
                    <td>{all ? '🏅' : ''}</td>
                    <td>
                      <button
                        className="act danger"
                        onClick={async () => {
                          if (confirm(`${s.nickname} 학생을 지울까요?`)) {
                            await backend.deleteStudent(s.id);
                            void load();
                          }
                        }}
                      >
                        지우기
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function AddStudent({ classId, onAdded }: { classId: string; onAdded: () => void }) {
  const [nick, setNick] = useState('');
  const [ch, setCh] = useState(CHARACTERS[0].key);
  const [pin, setPin] = useState('');
  const [level, setLevel] = useState<Level>('ga');
  const [err, setErr] = useState('');

  return (
    <div className="panel">
      <h2>학생 등록</h2>
      <p style={{ opacity: 0.7, marginTop: 0 }}>별명만 받아요. 실명·사진·이메일은 넣지 않아요.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          별명 <input value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} placeholder="예: 토리" />
        </div>
        <div className="pin-pick">
          캐릭터{' '}
          {CHARACTERS.map((c) => (
            <button key={c.key} style={{ borderColor: c.key === ch ? '#2b8be0' : undefined, background: c.key === ch ? '#e4f1ff' : undefined }} onClick={() => setCh(c.key)} title={c.name}>
              {c.emoji}
            </button>
          ))}
        </div>
        <div className="pin-pick">
          그림 비밀번호 (4개){' '}
          {PIN_PICTURES.map((p, i) => (
            <button key={i} onClick={() => pin.length < PIN_LENGTH && setPin(pin + i)}>{p}</button>
          ))}
          <span style={{ fontSize: 30, minWidth: 160 }}>
            {pin.split('').map((d) => PIN_PICTURES[Number(d)]).join(' ') || '…'}
          </span>
          <button onClick={() => setPin('')}>⌫</button>
        </div>
        <div>
          수준{' '}
          <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((lv) => (
              <option key={lv} value={lv}>{LEVEL_LABEL[lv]} 수준</option>
            ))}
          </select>
        </div>
        <div>
          <button
            className="act"
            disabled={!nick.trim() || pin.length !== PIN_LENGTH}
            onClick={async () => {
              setErr('');
              try {
                await backend.addStudent(classId, nick, ch, pin, level);
                setNick('');
                setPin('');
                onAdded();
              } catch (e) {
                setErr(e instanceof Error ? e.message : '등록하지 못했어요.');
              }
            }}
          >
            등록하기
          </button>
          {err && <span className="err"> {err}</span>}
        </div>
      </div>
    </div>
  );
}
