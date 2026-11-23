import { useEffect, useState } from 'react';
import { useApp } from './store/useApp';
import { StartScreen } from './ui/StartScreen';
import { Plaza } from './plaza/Plaza';
import { GameShell } from './games/GameShell';
import { Wardrobe } from './ui/Wardrobe';
import { Teacher } from './teacher/Teacher';

function useHash(): string {
  const [h, setH] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

export default function App() {
  const hash = useHash();
  const scene = useApp((s) => s.scene);
  const activeGame = useApp((s) => s.activeGame);
  const openGame = useApp((s) => s.openGame);
  const init = useApp((s) => s.init);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void init().finally(() => setReady(true));
  }, [init]);

  if (hash.startsWith('#/teacher')) return <Teacher />;
  if (!ready) return <div className="app" />;

  return (
    <div className="app">
      {scene === 'start' && <StartScreen />}
      {scene === 'plaza' && <Plaza onEnter={openGame} />}
      {scene === 'game' && activeGame && <GameShell key={activeGame} game={activeGame} />}
      <Wardrobe />
    </div>
  );
}
