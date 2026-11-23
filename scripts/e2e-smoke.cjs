// 브라우저(Playwright)로 4종 미니게임을 끝까지 해 보는 자동 점검.
//   npm run build && npm run preview -- --port 4173   (다른 터미널)
//   node scripts/e2e-smoke.cjs [게임이름,쉼표로] [ga|na|da]
// 가 수준 기준으로 처음부터 결과 화면까지 간다. 화면 캡처는 e2e-shots/ 에 저장한다.
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const OUT = 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4173/?e2e=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(b, lv, gate) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') logs.push('E: ' + m.text()); });
  await p.goto(BASE);
  await p.waitForTimeout(700);
  await p.getByText('바로 해 보기').first().click();
  await p.getByText({ ga: '가', na: '나', da: '다' }[lv] + ' 수준').click();
  await p.waitForTimeout(1200);
  await p.locator('.gate-label', { hasText: gate }).click();
  await p.waitForSelector('text=시작!', { timeout: 20000 });
  await p.getByText('시작!').click();
  await p.waitForTimeout(800);
  return { p, ctx, logs };
}
const proj = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__e2e.project(x, y, z), [x, y, z]);
// 카메라가 멈출 때까지 기다린 뒤 세계 좌표를 터치한다
const settle = async (p) => {
  let last = null;
  for (let i = 0; i < 100; i++) {
    const s = await proj(p, 0, 0, 0);
    const moving = await p.evaluate(() => !!(window.__e2e.pos && window.__e2e.pos.moving));
    if (!moving && last && Math.abs(s.x - last.x) < 0.3 && Math.abs(s.y - last.y) < 0.3) return;
    last = s;
    await sleep(300);
  }
};
const tapWorld = async (p, x, y, z) => { await settle(p); const s = await proj(p, x, y, z); await p.touchscreen.tap(s.x, s.y); };
const waitResult = (p, ms = 40000) => p.waitForSelector('text=잘했어요!', { timeout: ms });

const tests = {
  async obi(b, lv) {
    const { p, ctx, logs } = await open(b, lv, '빙판 골목');
    await p.getByText('천천히 걷기').click();
    await waitResult(p, 90000);
    await p.screenshot({ path: `${OUT}/obi-result.png` });
    await p.getByText('광장으로').click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/obi-plaza.png` });
    await ctx.close();
    return logs;
  },
  async tycoon(b, lv) {
    const { p, ctx, logs } = await open(b, lv, '우리 집');
    const wx = (x) => (x - 2.5) * 2, wz = (z) => (z - 1.5) * 2;
    await tapWorld(p, wx(2), 0.7, wz(0)); await p.waitForTimeout(300); // 커튼 옆 히터 집기
    await tapWorld(p, wx(2), 0.02, wz(3)); await p.waitForTimeout(400); // 먼 곳에 놓기
    await tapWorld(p, wx(4), 0.45, wz(2)); await p.waitForTimeout(300); // 문어발의 주전자 집기
    await p.getByText('넣어 두기').click(); await p.waitForTimeout(400);
    await p.getByText('히터 놓기').click(); await p.waitForTimeout(300);
    await tapWorld(p, wx(0), 0.02, wz(2)); await p.waitForTimeout(500);
    await p.getByText('가게').click(); await p.waitForTimeout(300);
    await p.getByText('카펫').click(); await p.waitForTimeout(500);
    await waitResult(p, 15000);
    await p.screenshot({ path: `${OUT}/tycoon-result.png` });
    await ctx.close();
    return logs;
  },
  async snow(b, lv) {
    const { p, ctx, logs } = await open(b, lv, '눈밭');
    const go = async (x, z, ms) => { await tapWorld(p, x, 0, z); await p.waitForTimeout(ms); };
    for (const [x, z] of [[-3, 4], [3, 5], [6, 0], [9, 4], [4, -6], [-6, 5], [-8, -5]]) await go(x, z, 1500);
    await waitResult(p, 15000);
    await p.screenshot({ path: `${OUT}/snow-result.png` });
    await ctx.close();
    return logs;
  },
  async patrol(b, lv) {
    const { p, ctx, logs } = await open(b, lv, '개울가');
    for (const [x, z] of [[-11, -1.5], [-4, 1.5], [5, -1], [12, 1.8]]) {
      await tapWorld(p, x, 0, 5.5); await p.waitForTimeout(500);
      await tapWorld(p, x, 1, z); await p.waitForTimeout(300);
      const btn = p.getByText('나와요!');
      if (await btn.count()) { try { await btn.first().click({ timeout: 1500 }); } catch { /* 동료가 먼저 불렀을 수 있다 */ } }
      await p.waitForTimeout(500);
    }
    await waitResult(p, 20000);
    await p.screenshot({ path: `${OUT}/patrol-result.png` });
    await ctx.close();
    return logs;
  },
};

(async () => {
  const only = process.argv[2];
  const lv = process.argv[3] || 'ga';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failed = 0;
  for (const name of Object.keys(tests)) {
    if (only && !only.split(',').includes(name)) continue;
    try {
      const logs = await tests[name](b, lv);
      console.log('PASS', name, logs.join(' | '));
    } catch (e) {
      failed++;
      console.log('FAIL', name, e.message.split('\n')[0]);
    }
  }
  await b.close();
  process.exit(failed ? 1 : 0);
})();
