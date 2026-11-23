// 음성이 빠진 문구가 없는지 확인한다.
//  1) 코드에서 쓰는 음성 키가 모두 문구표(src/data/voice/*.ts)에 있는가
//  2) 문구표의 모든 문구에 mp3(public/audio/<키>.mp3)가 있는가  (없으면 태블릿 내장 음성으로 읽지만 목록을 알려 준다)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const catalog = {};
for (const f of readdirSync(join(root, 'src/data/voice'))) {
  const src = readFileSync(join(root, 'src/data/voice', f), 'utf8');
  for (const m of src.matchAll(/^\s*'([a-z]+(?:\.[A-Za-z_0-9]+)+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) catalog[m[1]] = m[2];
}
const keys = Object.keys(catalog);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(f) && !p.includes('/voice/') && !f.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const used = new Set();
const dynamic = [/`([a-z]+\.(?:[a-z]+\.)?)\$\{/g];
for (const f of walk(join(root, 'src'))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/['"`]([a-z]+(?:\.[A-Za-z_0-9]+)+)['"`]/g)) if (catalog[m[1]]) used.add(m[1]);
  for (const re of dynamic) for (const m of src.matchAll(re)) for (const k of keys) if (k.startsWith(m[1])) used.add(k);
}
const unusedKeys = keys.filter((k) => !used.has(k));
const missingMp3 = keys.filter((k) => !existsSync(join(root, 'public/audio', `${k}.mp3`)));
console.log(`문구 ${keys.length}개`);
console.log(`코드에서 쓰지 않는 문구: ${unusedKeys.length}개`, unusedKeys.length ? unusedKeys : '');
console.log(`mp3가 없는 문구: ${missingMp3.length}개 ${missingMp3.length ? '(npm run tts:generate 로 만들어요. 그 전에는 태블릿 내장 음성이 대신 읽어요)' : ''}`);
if (process.argv.includes('--strict') && missingMp3.length) process.exit(1);
