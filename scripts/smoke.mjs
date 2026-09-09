/* Haven — smoke test (dev). Sobe o serve.py, abre o app num Chromium headless,
   navega as 4 abas, entra no editar e falha se houver erro de console/página.
   Uso: python serve.py 5222   (noutro terminal)
        npm i playwright-core   (uma vez)
        node scripts/smoke.mjs
   Requer o Chromium do Playwright (npx playwright install chromium). */
import { chromium } from 'playwright-core';

const URL = process.env.HAVEN_URL || 'http://localhost:5222/index.html?local=1';

const run = async () => {
  const browser = await chromium.launch();   // usa o chromium do playwright
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('haven.onboarded', '1'); } catch (_) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/now-playing\.json/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  for (const nav of ['map', 'music', 'catalog', 'home']) {
    await page.evaluate(n => document.querySelector(`.dock__i[data-nav="${n}"]`)?.click(), nav);
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => document.querySelector('[data-hi-edit]')?.click());   // entra no editar
  await page.waitForTimeout(600);
  const widgets = await page.evaluate(() => document.querySelectorAll('.hi__card[data-wid]').length);

  await browser.close();
  if (errs.length){ console.error('❌ SMOKE FALHOU:\n' + errs.join('\n')); process.exit(1); }
  console.log(`✅ smoke ok — 4 abas + editar, ${widgets} widgets, zero erro.`);
};
run().catch(e => { console.error('❌', e.message); process.exit(1); });
