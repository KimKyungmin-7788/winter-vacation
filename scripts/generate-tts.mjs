// 모든 문구를 Google Cloud TTS로 미리 mp3로 만들어 public/audio 에 넣는다.
// 실행 중(학생이 쓰는 중)에는 TTS를 부르지 않는다. 이 스크립트는 개발 PC에서 한 번만 돌린다.
//
//   GOOGLE_TTS_API_KEY=발급받은키 npm run tts:generate
//   (목소리 바꾸기: TTS_VOICE=ko-KR-Neural2-A  TTS_RATE=0.85)
//
// 이미 있는 mp3는 건너뛴다. 다시 만들려면 --force.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const key = process.env.GOOGLE_TTS_API_KEY;
if (!key) {
  console.error('GOOGLE_TTS_API_KEY 환경변수가 필요해요. (비밀 키는 파일에 적지 않아요)');
  process.exit(1);
}
const voice = process.env.TTS_VOICE ?? 'ko-KR-Neural2-A';
const rate = Number(process.env.TTS_RATE ?? 0.85);
const force = process.argv.includes('--force');
const root = new URL('..', import.meta.url).pathname;
const outDir = join(root, 'public/audio');
mkdirSync(outDir, { recursive: true });

const catalog = {};
for (const f of readdirSync(join(root, 'src/data/voice'))) {
  const src = readFileSync(join(root, 'src/data/voice', f), 'utf8');
  for (const m of src.matchAll(/^\s*'([a-z]+(?:\.[A-Za-z_0-9]+)+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) catalog[m[1]] = m[2].replace(/\\'/g, "'");
}

let made = 0;
for (const [k, text] of Object.entries(catalog)) {
  const file = join(outDir, `${k}.mp3`);
  if (existsSync(file) && !force) continue;
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ko-KR', name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
    }),
  });
  if (!res.ok) {
    console.error('실패', k, res.status, await res.text());
    process.exit(1);
  }
  const { audioContent } = await res.json();
  writeFileSync(file, Buffer.from(audioContent, 'base64'));
  made++;
  console.log('만듦', k);
}
const all = Object.keys(catalog).filter((k) => existsSync(join(outDir, `${k}.mp3`)));
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(all));
console.log(`끝: 새로 ${made}개, 목록(manifest.json) ${all.length}개`);
