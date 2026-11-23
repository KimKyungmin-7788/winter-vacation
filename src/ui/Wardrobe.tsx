import { Canvas } from '@react-three/fiber';
import { ITEMS } from '../data/items';
import { useApp } from '../store/useApp';
import { Avatar } from '../three/Avatar';
import { QuarterCamera } from '../three/Scene';
import { BigButton, Line, useSpeakOnMount } from './Line';
import { Scrim } from './Overlay';
import type { VoiceKey } from '../data/voice';
import { speak } from '../audio/speak';

export function Wardrobe() {
  const open = useApp((s) => s.wardrobeOpen);
  const setOpen = useApp((s) => s.setWardrobe);
  const inventory = useApp((s) => s.inventory);
  const equipped = useApp((s) => s.equipped);
  const toggle = useApp((s) => s.toggleEquip);
  const student = useApp((s) => s.student);
  useSpeakOnMount(open ? 'wardrobe.title' : null, [open]);
  if (!open) return null;
  return (
    <Scrim>
      <div className="card" style={{ width: 'min(760px, 94vw)' }}>
        <h2><Line k="wardrobe.title" speaker /></h2>
        <div className="wardrobe-preview">
          <Canvas flat dpr={[1, 1.5]} onCreated={({ gl }) => gl.setClearColor('#dff0ff')}>
            <ambientLight intensity={1.1} />
            <directionalLight position={[4, 8, 6]} intensity={1.5} />
            <QuarterCamera target={[0, 0.9, 0]} fitWidth={3.6} fitHeight={3} distance={20} />
            <Avatar character={student?.character_key ?? 'penguin'} equipped={equipped} />
          </Canvas>
        </div>
        {inventory.length === 0 && <p style={{ fontSize: 22 }}><Line k="wardrobe.empty" /></p>}
        <div className="wardrobe-grid">
          {ITEMS.map((it) => {
            const have = inventory.includes(it.key);
            const on = !!equipped[it.slot];
            return (
              <button
                key={it.key}
                className={`wardrobe-item ${on ? 'on' : ''} ${have ? '' : 'locked'}`}
                onClick={() => {
                  if (!have) return;
                  toggle(it.slot);
                  void speak(on ? 'wardrobe.off' : 'wardrobe.on');
                }}
              >
                <span className="em">{have ? it.emoji : '❔'}</span>
                {have ? <Line k={`item.${it.key}` as VoiceKey} /> : ''}
                {have && <div>{on ? '✅' : '⬜'}</div>}
              </button>
            );
          })}
        </div>
        <BigButton icon="✖️" k="common.close" tone="good" onClick={() => setOpen(false)} />
      </div>
    </Scrim>
  );
}
