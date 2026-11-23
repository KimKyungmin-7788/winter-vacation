import { Suspense, lazy, useState } from 'react';
import { GAME_BY_KEY } from '../data/games';
import { GAME_REWARDS, ITEM_BY_KEY } from '../data/items';
import { GameKey, GameResult, LEVEL_LABEL } from '../data/types';
import { VoiceKey } from '../data/voice';
import { useApp } from '../store/useApp';
import { BigButton, Line, useSpeakOnMount } from '../ui/Line';
import { Scrim, SoundToggle, Stars } from '../ui/Overlay';
import { speak } from '../audio/speak';
import type { GameProps } from './common';

const Obi = lazy(() => import('./obi/Obi'));
const Tycoon = lazy(() => import('./tycoon/Tycoon'));
const Snow = lazy(() => import('./snow/Snow'));
const Patrol = lazy(() => import('./patrol/Patrol'));
const COMPONENTS: Record<GameKey, React.ComponentType<GameProps>> = { obi: Obi, tycoon: Tycoon, snow: Snow, patrol: Patrol };

type Phase = 'card' | 'play' | 'result';

export function GameShell({ game }: { game: GameKey }) {
  const closeGame = useApp((s) => s.closeGame);
  const completeGame = useApp((s) => s.completeGame);
  const level = useApp((s) => s.levelFor());
  const def = GAME_BY_KEY[game];
  const [phase, setPhase] = useState<Phase>('card');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [newItems, setNewItems] = useState<string[]>([]);
  const [saved, setSaved] = useState(true);
  const [coop, setCoop] = useState(false);
  const Game = COMPONENTS[game];

  const finish = async (r: GameResult) => {
    setResult(r);
    const { newItems: items, saved: ok } = await completeGame(game, level, r);
    setNewItems(items);
    setSaved(ok);
    setPhase('result');
  };

  return (
    <>
      {phase !== 'card' && (
        <Suspense fallback={null}>
          {/* key로 다시 하기 때마다 처음 상태로 */}
          {phase === 'play' && <Game key={attempt} level={level} coop={coop} onFinish={(r) => void finish(r)} />}
        </Suspense>
      )}
      {phase === 'play' && (
        <div className="overlay" style={{ pointerEvents: 'none' }}>
          <div className="hud-top" style={{ justifyContent: 'flex-end' }}>
            <div className="row">
              <SoundToggle />
              <BigButton icon="🏠" k="common.exit" tone="secondary" size="md" onClick={closeGame} />
            </div>
          </div>
        </div>
      )}
      {phase === 'card' && <StartCard game={game} onStart={(c) => { setCoop(c); setPhase('play'); }} onExit={closeGame} />}
      {phase === 'result' && result && (
        <ResultCard
          game={game}
          stars={result.stars}
          newItems={newItems}
          saved={saved}
          onAgain={() => {
            setAttempt((a) => a + 1);
            setPhase('play');
          }}
          onExit={closeGame}
        />
      )}
      <span className="sr-only">{def.title}</span>
    </>
  );
}

function StartCard({ game, onStart, onExit }: { game: GameKey; onStart: (coop: boolean) => void; onExit: () => void }) {
  const student = useApp((s) => s.student);
  const def = GAME_BY_KEY[game];
  const level = useApp((s) => s.levelFor());
  const ruleKey = `rule.${game}` as VoiceKey;
  useSpeakOnMount(ruleKey);
  return (
    <Scrim>
      <div className="card" style={{ background: '#fff' }}>
        <div className="big-emoji">{def.emoji}</div>
        <h2>{def.title}</h2>
        <p style={{ fontSize: 34, fontWeight: 700 }}>
          <Line k={ruleKey} speaker />
        </p>
        <p style={{ fontSize: 20, opacity: 0.7 }}>{LEVEL_LABEL[level]} 수준</p>
        <div className="row">
          <BigButton icon="🔊" k="common.listenAgain" tone="secondary" onClick={() => void speak(ruleKey)} />
          <BigButton icon="▶️" k="common.start" tone="good" size="xl" onClick={() => onStart(false)} />
          {game === 'patrol' && student && <BigButton icon="👫" k="patrol.coop" tone="warn" onClick={() => onStart(true)} />}
          <BigButton icon="🏠" k="common.back" tone="plain" onClick={onExit} />
        </div>
      </div>
    </Scrim>
  );
}

function ResultCard({ game, stars, newItems, saved, onAgain, onExit }: { game: GameKey; stars: number; newItems: string[]; saved: boolean; onAgain: () => void; onExit: () => void }) {
  const learned = `learned.${game}` as VoiceKey;
  useSpeakOnMount(learned);
  return (
    <Scrim>
      <div className="card" style={{ background: '#fff' }}>
        <h1><Line k="common.great" /></h1>
        <Stars n={stars} />
        <p style={{ fontWeight: 700 }}><Line k={learned} speaker /></p>
        <div className="reward-row">
          {GAME_REWARDS[game].map((k) => (
            <div key={k} className="reward">
              <span className="em">{ITEM_BY_KEY[k].emoji}</span>
              <Line k={`item.${k}` as VoiceKey} />
              {newItems.includes(k) ? <div style={{ color: '#e56d1c' }}>NEW</div> : null}
            </div>
          ))}
          <div className="reward">
            <span className="em">⛄</span>
            <Line k={`piece.${game}` as VoiceKey} />
          </div>
        </div>
        <p style={{ fontSize: 24, margin: '4px 0' }}>
          <Line k="result.piece" />
          {newItems.length > 0 && <> · <Line k="result.newItem" /></>}
        </p>
        {stars < 3 && <p style={{ fontSize: 20, margin: '4px 0', opacity: 0.8 }}><Line k="result.moreStars" /></p>}
        {!saved && <p style={{ fontSize: 20, color: '#e2574c' }}><Line k="result.saveFailed" /></p>}
        <div className="row">
          <BigButton icon="🔊" k="common.listenAgain" tone="secondary" onClick={() => void speak(learned)} />
          <BigButton icon="🔁" k="common.again" tone="warn" onClick={onAgain} />
          <BigButton icon="🏠" k="common.toPlaza" tone="good" onClick={onExit} />
        </div>
      </div>
    </Scrim>
  );
}
