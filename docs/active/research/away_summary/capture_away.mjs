// node capture_away.mjs <url> <outDir> [date]
// "While you were away" as built (brief 440 A1), with headless Chrome at 1920 x 1080 and 1366 x 768,
// from a New Game, through the QA panel's Notifications buttons only:
//   <date>_<w>_full.png         the made-up time away with every section (both columns overflow)
//   <date>_<w>_full_scrolled.png  the same after one press of each column's down arrow
//   <date>_<w>_news_end.png     the news column scrolled to its end: the kill counts
//   <date>_<w>_hover_both.png   the hover on an item both gained and spent
//   <date>_<w>_hover_mat.png    the hover on an item still waiting on the mat
//   <date>_<w>_confirm_return.png  Return to the Guild's question
//   <date>_<w>_banners.png      after confirming: the banners for the news
//   <date>_<w>_empty.png        a return with nothing to say
//   <date>_<w>_real_short.png   a real 20 minutes away (the game played it)
//   <date>_<w>_real_long.png    a real 3 hours away with lots of news
//   <date>_1366_confirm_undo.png  Load as I left it's question (then cancelled, then confirmed)
// It prints what it checked as JSON.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-11-06'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_away.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });

const shot = async (page) => (await page.send('Page.captureScreenshot', { format: 'png' })).data;
const centreOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()`);
const exists = (page, sel) => page.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);

/** Open the QA panel, press one Notifications button, close the panel. */
const qa = (page, id) => page.evaluate(`(async () => {
    const open = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'QA') || document.querySelector('button[title="Open QA Dashboard"]');
    if (!document.querySelector('[data-dev-notify]')) { if (!open) return 'no QA button'; open.click(); await new Promise(r => setTimeout(r, 800)); }
    const b = document.querySelector('[data-dev-notify="${id}"]');
    if (!b) return 'no button ${id}';
    b.click();
    await new Promise(r => setTimeout(r, 300));
    document.querySelector('[data-testid="qa-panel"] [data-close-x]')?.click();
    return true;
})()`);

/** The panel's measures: size, whether it fits, each column's arrows and scroll. */
const measure = (page) => page.evaluate(`(() => {
    const p = document.querySelector('[data-catch-up-summary]');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const col = (id) => {
        const c = document.querySelector('[data-summary-column="' + id + '"]');
        const l = c?.querySelector('[data-scroll-list]');
        return c && { arrows: c.querySelectorAll('[data-scroll-arrow]').length, scrollTop: Math.round(l.scrollTop),
            overflow: l.scrollHeight - l.clientHeight, scrollbarWidth: l.offsetWidth - l.clientWidth,
            sections: [...c.querySelectorAll('[data-summary-section]')].map(s => s.getAttribute('data-summary-section')),
            rows: c.querySelectorAll('[data-item-bar]').length };
    };
    return { panel: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
        fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight },
        viewport: [innerWidth, innerHeight], heading: document.querySelector('[data-summary-away]')?.textContent,
        headingCentred: getComputedStyle(document.querySelector('[data-summary-header]')).textAlign,
        items: col('items'), news: col('news'), undoOffered: !!document.querySelector('[data-summary-undo]') };
})()`);

const tipText = (page) => page.evaluate(`[...document.querySelectorAll('[data-tooltip] .ui-text-title, [data-tooltip] .ui-text-body')].map(d => d.textContent)`);

const log = {};
for (const [W, H] of [[1920, 1080], [1366, 768]]) {
    const L = (log[W] = {});
    const file = (name) => path.join(out, `${date}_${W}_${name}.png`);
    const save = async (page, name) => writeFileSync(file(name), Buffer.from(await shot(page), 'base64'));
    const chrome = await launchChrome({ width: W, height: H });
    try {
        const page = await chrome.newPage();
        await page.setViewport(W, H);
        await page.navigate(url);
        await page.waitFor('!!window.Game', { timeoutMs: 120000 });
        await sleep(2500);
        const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
        if (!clicked) throw new Error('no New Game button');
        await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
        await sleep(3000);
        L.slot = await page.evaluate(`window.Game?.SaveManager?.currentSlot ?? null`);

        // 1. Every section, both columns overflowing.
        L.preview = await qa(page, 'away-preview');
        await page.waitFor(`!!document.querySelector('[data-catch-up-summary]')`, { timeoutMs: 10000 });
        await sleep(1200);
        await page.mouse('mouseMoved', 2, 2);
        L.full = await measure(page);
        await save(page, 'full');

        // 2. Hover: an item both gained and spent; one waiting on the mat.
        const both = await page.evaluate(`(() => { const r = [...document.querySelectorAll('[data-summary-column="items"] [data-item-bar]')]; return r.findIndex(e => Number(e.getAttribute('data-summary-gained')) > 0 && Number(e.getAttribute('data-summary-spent')) > 0 && Number(e.getAttribute('data-summary-net')) !== 0); })()`);
        const hoverRow = async (index, name) => {
            const at = await page.evaluate(`(() => { const e = [...document.querySelectorAll('[data-summary-column="items"] [data-item-bar]')][${index}]; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width * 0.6), Math.round(r.top + r.height / 2)]; })()`);
            await sleep(400);
            await page.mouse('mouseMoved', at[0] - 30, at[1]);
            await page.mouse('mouseMoved', at[0], at[1]);
            await sleep(500);
            L[name] = { tip: await tipText(page), count: await page.evaluate(`[...document.querySelectorAll('[data-summary-column="items"] [data-item-bar]')][${index}].querySelector('[data-item-bar-count]').className.match(/text-gi-\\w+/)?.[0]`) };
            await save(page, name);
            await page.mouse('mouseMoved', 2, 2);
            await sleep(300);
        };
        await hoverRow(both, 'hover_both');
        const mat = await page.evaluate(`[...document.querySelectorAll('[data-summary-column="items"] [data-item-bar]')].findIndex(e => e.querySelector('[data-summary-on-mat]'))`);
        await hoverRow(mat, 'hover_mat');
        await page.evaluate(`document.querySelectorAll('[data-scroll-list]').forEach(l => { l.scrollTop = 0; })`);
        await sleep(300);

        // 3. One press of each column's down arrow.
        for (const id of ['items', 'news']) {
            const c = await centreOf(page, `[data-summary-column="${id}"] [data-scroll-arrow="down"]`);
            if (c) await page.click(c[0], c[1]);
        }
        await sleep(800);
        await page.mouse('mouseMoved', 2, 2);
        L.scrolled = await measure(page);
        await save(page, 'full_scrolled');
        // The news column's end: the fights, each enemy with its kill count.
        await page.evaluate(`(() => { const l = document.querySelector('[data-summary-column="news"] [data-scroll-list]'); l.scrollTop = l.scrollHeight; })()`);
        await sleep(400);
        L.newsEnd = await measure(page);
        L.kills = await page.evaluate(`[...document.querySelectorAll('[data-summary-section="kills"] [data-item-bar]')].map(e => e.querySelector('[data-item-bar-name]').textContent + ' ' + e.querySelector('[data-item-bar-count]').textContent)`);
        await save(page, 'news_end');

        // 4. Return asks; Cancel goes back; Esc asks the same; Esc cancels; then Return, confirmed.
        let c = await centreOf(page, '[data-summary-close]');
        await page.click(c[0], c[1]);
        await sleep(300);
        L.returnAsks = await page.evaluate(`document.querySelector('[data-summary-confirm]')?.getAttribute('data-summary-confirm') + ': ' + document.querySelector('[data-summary-confirm]')?.textContent`);
        await page.mouse('mouseMoved', 2, 2);
        await save(page, 'confirm_return');
        c = await centreOf(page, '[data-summary-confirm-no]');
        await page.click(c[0], c[1]);
        await sleep(200);
        L.cancelBack = (await exists(page, '[data-summary-close]')) && !(await exists(page, '[data-summary-confirm]'));
        await page.key('Escape', 'Escape', 27);
        await sleep(200);
        L.escAsks = await page.evaluate(`document.querySelector('[data-summary-confirm]')?.getAttribute('data-summary-confirm') || null`);
        await page.key('Escape', 'Escape', 27);
        await sleep(200);
        L.escCancels = (await exists(page, '[data-catch-up-summary]')) && !(await exists(page, '[data-summary-confirm]'));
        const bannersBefore = await page.evaluate(`document.querySelectorAll('[data-banner]').length`);
        c = await centreOf(page, '[data-summary-close]');
        await page.click(c[0], c[1]);
        await sleep(200);
        c = await centreOf(page, '[data-summary-confirm-yes]');
        await page.click(c[0], c[1]);
        await sleep(1500);
        L.closed = !(await exists(page, '[data-catch-up-summary]'));
        L.banners = { before: bannersBefore, after: await page.evaluate(`document.querySelectorAll('[data-banner]').length`) };
        await save(page, 'banners');
        await page.evaluate(`document.querySelectorAll('[data-banner]').forEach(b => b.click())`);
        await sleep(600);

        // 5. A return with nothing to say.
        L.emptyRun = await qa(page, 'away-preview-empty');
        await page.waitFor(`!!document.querySelector('[data-catch-up-summary]')`, { timeoutMs: 10000 });
        await sleep(1000);
        L.empty = await measure(page);
        L.emptyText = await page.evaluate(`[...document.querySelectorAll('[data-summary-empty]')].map(e => e.textContent)`);
        await save(page, 'empty');
        await page.key('Escape', 'Escape', 27);
        await sleep(200);
        c = await centreOf(page, '[data-summary-confirm-yes]');
        await page.click(c[0], c[1]);
        await sleep(500);

        // 6. Real time away, played by the game: 20 minutes, then 3 hours with lots of news.
        for (const [id, name] of [['away', 'real_short'], ['away-long', 'real_long']]) {
            L[name + '_run'] = await qa(page, id);
            await page.waitFor(`!!document.querySelector('[data-catch-up-summary]')`, { timeoutMs: 240000 });
            await sleep(1200);
            await page.mouse('mouseMoved', 2, 2);
            L[name] = await measure(page);
            await save(page, name);
            if (W === 1366 && name === 'real_long' && L[name].undoOffered) {
                // Load as I left it: asks with today's warning; cancel; then confirm (the page reloads).
                c = await centreOf(page, '[data-summary-undo]');
                await page.click(c[0], c[1]);
                await sleep(300);
                L.undoAsks = await page.evaluate(`document.querySelector('[data-summary-confirm]')?.textContent`);
                L.undoFocus = await page.evaluate(`document.activeElement?.hasAttribute('data-summary-confirm-no')`);
                await page.mouse('mouseMoved', 2, 2);
                await save(page, 'confirm_undo');
                c = await centreOf(page, '[data-summary-confirm-no]');
                await page.click(c[0], c[1]);
                await sleep(200);
                L.undoCancelBack = await exists(page, '[data-summary-undo]');
                const navs = page.navigations;
                c = await centreOf(page, '[data-summary-undo]');
                await page.click(c[0], c[1]);
                await sleep(200);
                c = await centreOf(page, '[data-summary-confirm-yes]');
                await page.click(c[0], c[1]);
                await sleep(4000);
                L.undoReloaded = page.navigations > navs;
                break;
            }
            await page.key('Escape', 'Escape', 27);
            await sleep(200);
            c = await centreOf(page, '[data-summary-confirm-yes]');
            await page.click(c[0], c[1]);
            await sleep(1500);
            await page.evaluate(`document.querySelectorAll('[data-banner]').forEach(b => b.click())`);
            await sleep(600);
        }
        L.consoleErrors = page.consoleErrors;
    } finally {
        await chrome.close();
    }
}
console.log(JSON.stringify(log, null, 2));
