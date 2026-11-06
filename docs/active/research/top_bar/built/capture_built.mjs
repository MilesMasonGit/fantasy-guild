// Captures the built top bar (brief 420 T1) from a running dev server and checks its hover, Esc and
// Demolish behaviour with real mouse input:
//   node capture_built.mjs <url> <outDir> <label> [checks]
// Per window size (1920 x 1080, 1366 x 768): the whole window, the whole bar, the bar's left end at
// 2x, and the bar over five places' banners (the picture swapped in the page, the box untouched).
// With `checks`: the Token Summary opening on hover, staying while the pointer crosses into it,
// a row lighting the mat, closing after the pointer leaves, Esc; Demolish on, a mark, Cancel All
// Marks, Esc. Prints one JSON line of results per size.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5406', out = '.', label = 'shot', checks = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SIZES = [[1920, 1080], [1366, 768]];
const BANNERS = ['b_golden_plains', 'b_lush_forest', 'b_beach', 'b_mountains_snowy', 'b_swamp'];

const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

async function clipScaled(page, clip, k) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    return page.evaluate(`(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

const rectOf = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;

const MEASURE = `(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const img = document.querySelector('[data-mat-region-banner] img');
    return {
        bar: r('[data-mat-top-bar]'), left: r('[data-mat-top-bar-left]'), middle: r('[data-mat-top-bar-middle]'),
        bannerBox: r('[data-mat-region-banner] [data-banner-art]'), img: r('[data-mat-region-banner] img'),
        scale: img?.getAttribute('data-banner-scale'),
        banner: document.querySelector('[data-mat-region-banner]')?.getAttribute('data-mat-region-banner')
    };
})()`;

const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];

for (const [w, h] of SIZES) {
    const chrome = await launchChrome({ width: w, height: h });
    const result = { size: `${w}x${h}` };
    try {
        const page = await chrome.newPage();
        await page.setViewport(w, h);
        await page.navigate(url);
        await page.waitFor('!!window.Game');
        await sleep(3000);
        const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
        if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
        await sleep(6000);
        await page.mouse('mouseMoved', w - 5, h - 5);
        const m = await page.evaluate(MEASURE);
        result.measure = m;
        save(`${label}_${w}x${h}.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
        const barClip = { x: m.bar.x, y: m.bar.y, width: m.bar.w, height: m.bar.h };
        save(`${label}_${w}x${h}_bar.png`, (await page.send('Page.captureScreenshot', { format: 'png', clip: { ...barClip, scale: 1 } })).data);
        save(`${label}_${w}x${h}_bar_left_2x.png`, await clipScaled(page, { ...barClip, width: Math.min(800, m.bar.w) }, 2));

        for (const banner of BANNERS) {
            const ok = await page.evaluate(`import('/src/config/areaBanners.js').then(a => {
                const src = a.areaBannerSrc(${JSON.stringify(banner)});
                const img = document.querySelector('[data-mat-region-banner] img');
                if (!src || !img) return false;
                img.src = src; return img.decode().then(() => true, () => false);
            })`);
            if (!ok) { console.log('banner missing', banner); continue; }
            await sleep(300);
            save(`${label}_${w}x${h}_bar_${banner}.png`, (await page.send('Page.captureScreenshot', { format: 'png', clip: { ...barClip, scale: 1 } })).data);
        }

        if (checks) {
            const panelOpen = () => page.evaluate(`!!document.querySelector('[data-token-summary]')`);
            const badge = await page.evaluate(rectOf('[data-mat-cap-badge]'));
            const [bx, by] = centre(badge);
            await page.mouse('mouseMoved', bx, by);
            await sleep(200);
            result.openOnHover = await panelOpen();
            const tip = await page.evaluate(`!!document.querySelector('[data-top-bar-tip]') || /Click for/.test(document.body.textContent)`);
            result.oldTooltipGone = !tip;
            save(`${label}_${w}x${h}_token_summary.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
            // Cross into the panel in small steps, as a hand would.
            const panel = await page.evaluate(rectOf('[data-token-summary]'));
            const row = await page.evaluate(rectOf('[data-token-summary-row]'));
            const rowType = await page.evaluate(`document.querySelector('[data-token-summary-row]')?.getAttribute('data-token-summary-row')`);
            const [rx, ry] = centre(row);
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
                await page.mouse('mouseMoved', bx + (rx - bx) * i / steps, by + (ry - by) * i / steps);
                await sleep(25);
            }
            await sleep(400);
            result.panelTop = panel.y; result.badgeBottom = badge.y + badge.h;
            result.staysAfterCrossing = await panelOpen();
            result.rowType = rowType;
            result.rowLights = await page.evaluate(`(() => {
                const lit = [...document.querySelectorAll('[data-summary-highlight]')];
                const all = [...document.querySelectorAll('[data-token-art="true"][data-token-type=${JSON.stringify(rowType)}]')];
                return { lit: lit.length, ofType: all.length, allOfType: lit.every(e => e.getAttribute('data-token-type') === ${JSON.stringify(rowType)}) };
            })()`);
            save(`${label}_${w}x${h}_token_summary_row.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
            // Leave both: shut after the delay, highlight cleared.
            await page.mouse('mouseMoved', Math.max(20, panel.x - 80), panel.y + 60);
            await sleep(60);
            result.stillOpen60msAfterLeaving = await panelOpen();
            await sleep(400);
            result.closedAfterLeaving = !(await panelOpen());
            result.highlightCleared = await page.evaluate(`document.querySelectorAll('[data-summary-highlight]').length === 0`);
            // Esc while open (pointer on the panel).
            await page.mouse('mouseMoved', bx, by);
            await sleep(200);
            const p2 = await page.evaluate(rectOf('[data-token-summary]'));
            await page.mouse('mouseMoved', bx, p2.y + 10);
            await sleep(100);
            await page.key('Escape', 'Escape', 27);
            await sleep(200);
            result.escCloses = !(await panelOpen());
            await page.mouse('mouseMoved', w - 5, h - 5);
            await sleep(400);

            // Upkeep still opens on hover and stays while crossing.
            const up = await page.evaluate(rectOf('[data-mat-upkeep-badge]'));
            const [ux, uy] = centre(up);
            await page.mouse('mouseMoved', ux, uy);
            await sleep(200);
            const upPanel = await page.evaluate(rectOf('[data-mat-upkeep-popover]'));
            if (upPanel) {
                for (let i = 1; i <= 6; i++) { await page.mouse('mouseMoved', ux, uy + (upPanel.y + 20 - uy) * i / 6); await sleep(25); }
                await sleep(300);
            }
            result.upkeepOpensAndStays = !!upPanel && await page.evaluate(`!!document.querySelector('[data-mat-upkeep-popover]')`);
            await page.mouse('mouseMoved', w - 5, h - 5);
            await sleep(400);

            // Demolish: the button with its pixel X, a mark, Cancel All Marks, Esc.
            const toggle = await page.evaluate(rectOf('[data-map-mode-toggle="demolish"]'));
            save(`${label}_${w}x${h}_demolish_button_4x.png`, await clipScaled(page, { x: toggle.x - 4, y: toggle.y - 4, width: toggle.w + 8, height: toggle.h + 8 }, 4));
            await page.click(...centre(toggle));
            await sleep(400);
            result.demolishOn = await page.evaluate(`document.querySelector('[data-map-mode-toggle="demolish"]')?.getAttribute('data-on') === 'true'`);
            // The Starter Camp's own Tokens cannot be marked: lay one as if bought (a Coast), for the check only.
            await page.evaluate(`Promise.all([import('/src/systems/board/BoardState.js'), import('/src/systems/board/Placement.js')]).then(([B, P]) => {
                P.placeArrivalNear(B.createTokenInstance('token_coast'), { x: P.centreOfBoard().x + 300, y: P.centreOfBoard().y + 200 });
            })`);
            await sleep(800);
            // A Token the engine lets you mark, whose hit circle is on top at its centre.
            const target = await page.evaluate(`Promise.all([import('/src/systems/board/BoardState.js'), import('/src/ui/hooks/useMapMode.js')]).then(([B, M]) => {
                for (const t of B.tokens()) {
                    if (M.isProtectedFromDemolition(t)) continue;
                    const el = document.querySelector('[data-token-hit="' + t.id + '"]');
                    if (!el) continue;
                    const r = el.getBoundingClientRect();
                    const x = r.x + r.width / 2, y = r.y + r.height / 2;
                    const top = document.elementFromPoint(x, y);
                    if (top && (top === el || el.contains(top))) return { x, y, typeId: t.typeId };
                }
                return null;
            })`);
            result.markTarget = target?.typeId || null;
            if (target) {
                await page.click(target.x, target.y);
                await sleep(500);
            }
            result.marked = await page.evaluate(`Number(document.querySelector('[data-cancel-all-marks]')?.getAttribute('data-cancel-all-marks') || 0)`);
            save(`${label}_${w}x${h}_bar_demolish.png`, (await page.send('Page.captureScreenshot', { format: 'png', clip: { ...barClip, scale: 1 } })).data);
            const cancel = await page.evaluate(rectOf('[data-cancel-all-marks]'));
            if (cancel) { await page.click(...centre(cancel)); await sleep(400); }
            result.marksAfterCancel = await page.evaluate(`Number(document.querySelector('[data-cancel-all-marks]')?.getAttribute('data-cancel-all-marks') || 0)`);
            await page.mouse('mouseMoved', w - 5, h - 5);
            await page.key('Escape', 'Escape', 27);
            await sleep(300);
            result.demolishOffAfterEsc = await page.evaluate(`document.querySelector('[data-map-mode-toggle="demolish"]')?.getAttribute('data-on') === 'false'`);
            result.consoleErrors = page.consoleErrors;
        }
    } finally {
        console.log(JSON.stringify(result));
        await chrome.close();
    }
}
