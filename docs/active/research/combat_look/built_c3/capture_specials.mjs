// node capture_specials.mjs <url> [outDir]
// The QA panel's crowd of fights, set up by clicking its button, watched for 40 s: which bubbles the
// mat says over the enemies (only special moves, status landings and a boss's rule), against the
// moves the fights made; a picture of the crowd, 12 s in, while a special move's bubble is up; then one fight
// window opened by its fight button, for its stat block.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from '../../../../../bench/browser/cdp.mjs';
import { openGame } from '../scene.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [url = 'http://localhost:5401/', out = here, c2Out = path.join(here, '..', 'built_c2')] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const { chrome, page } = await openGame(url);
const shot = async (dir, name, clip = null) => {
    const d = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    writeFileSync(path.join(dir, `${name}.png`), Buffer.from(d.data, 'base64'));
    console.log('saved', name);
};
const box = (sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const clickAt = async (b) => { await page.click(Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2)); await sleep(300); };

try {
    // The QA panel's button, then its crowd, then the panel shut.
    await clickAt(await box('button[title="Open QA Dashboard"]'));
    await clickAt(await box('[data-qa-combat-crowd]'));
    console.log('status', await page.evaluate(`document.querySelector('[data-qa-combat-crowd]')?.parentElement?.textContent.slice(0, 200)`));
    const close = await box('[data-testid="qa-panel"] [data-close-x], [data-testid="qa-panel"] button[aria-label="Close"]');
    if (close) await clickAt(close);
    else await page.key('Escape', 'Escape', 27);
    await page.mouse('mouseMoved', 5, 1075);

    // Every bubble said over the mat, from now on.
    await page.evaluate(`(() => {
        window.__said = [];
        const seen = new WeakSet();
        const look = () => document.querySelectorAll('[data-callout]').forEach(el => { if (!seen.has(el)) { seen.add(el); window.__said.push(el.getAttribute('data-callout')); } });
        new MutationObserver(look).observe(document.body, { subtree: true, childList: true });
    })()`);
    let pictured = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
        await sleep(150);
        if (pictured || Date.now() - t0 < 12000) continue;
        const up = await page.evaluate(`!!document.querySelector('[data-callout="Flutter"]')`);
        if (up) {
            const chips = await page.evaluate(`[...document.querySelectorAll('[data-fight-chip]')].map(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top }; })`);
            const xs = chips.map(c => c.x); const ys = chips.map(c => c.y);
            const x0 = Math.max(0, Math.min(...xs) - 220); const y0 = Math.max(0, Math.min(...ys) - 200);
            const x1 = Math.min(1920, Math.max(...xs) + 240); const y1 = Math.min(1080, Math.max(...ys) + 220);
            await shot(out, 'crowd_specials_only', { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) });
            pictured = true;
        }
    }
    const said = await page.evaluate(`window.__said`);
    const made = await page.evaluate(`(async () => {
        const w = await import('/src/ui/components/combat/fightWatch.js');
        const HM = await import('/src/systems/hero/HeroManager.js');
        const counts = {};
        for (const h of HM.getAllHeroes()) {
            const f = w.fightsOf(h.id);
            for (const rec of [f?.current, f?.last].filter(Boolean)) for (const l of rec.log) if (l.vars?.move) counts[l.vars.move] = (counts[l.vars.move] || 0) + 1;
        }
        return counts;
    })()`);
    const tally = said.reduce((m, s) => ({ ...m, [s]: (m[s] || 0) + 1 }), {});
    console.log('bubbles said', JSON.stringify(tally));
    console.log('moves in the logs', JSON.stringify(made));
    if (!pictured) console.log('no Flutter bubble seen in 40 s');

    // One fight window, opened by its fight button, for its stat block.
    const heroes = await page.evaluate(`[...document.querySelectorAll('[data-fight-chip]')].map(e => e.getAttribute('data-fight-chip'))`);
    const names = await page.evaluate(`(async () => { const HM = await import('/src/systems/hero/HeroManager.js'); return Object.fromEntries(HM.getAllHeroes().map(h => [h.id, h.name])); })()`);
    const pick = heroes.find(id => names[id] === 'Kira') || heroes[0];
    await clickAt(await box(`[data-fight-chip="${pick}"]`));
    await page.mouse('mouseMoved', 5, 1075);
    await sleep(1500);
    const win = await box(`[data-fight-window="${pick}"]`);
    if (win) await shot(c2Out, 'c2_window_closeup', { x: Math.round(win.x - 4), y: Math.round(win.y - 4), width: Math.round(win.w + 12), height: Math.round(win.h + 12) });
    console.log('rows', JSON.stringify(await page.evaluate(`[...document.querySelectorAll('[data-fight-window="${pick}"] [data-fight-stat]')].map(r => [r.getAttribute('data-fight-stat'), ...[...r.children].map(c => c.textContent.trim())])`)));
} finally {
    await chrome.close();
}
