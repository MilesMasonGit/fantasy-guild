// Captures the ledger's view of the Guild Hall (brief 320 H2) from a running CMS dev server, at 1920 x 1080:
// node capture_hall_h2.mjs <url> <outDir>
// A throwaway headless Chrome profile; the workspace is the shipped data/ with the H1 QA sky
// (src/ui/dev/qaHallSky.js), seeded in the page with the store's persistence switched off, so
// nothing is saved and nothing is synced. Shots: the Guild Hall page's rank pricing, the Pace
// page's paybacks (the Guild Hall's default 24 h payback, then 6 min so some ranks are red), the
// Ledger settings with both payback times, and, after the
// first ranks of three Mining stars are set to the Starter Camp on the Guild Hall page, Mining's
// breakdown with the Hall's share and the Copper Ore Vein's rates.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';
import { qaHallSky } from '../../../../src/ui/dev/qaHallSky.js';

const [url = 'http://localhost:5196', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
// Built here: the CMS's dev server serves only the game files the CMS imports.
const QA_SKY = JSON.stringify(qaHallSky());

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor(`!!document.querySelector('button')`);
    await sleep(1500);
    const shot = async (name) => writeFileSync(path.join(out, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    const clickText = async (text, within = 'document') => {
        const ok = await page.evaluate(`(() => { const b = [...${within}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`);
        if (!ok) throw new Error(`no button "${text}"`);
        await sleep(600);
    };
    const scrollTo = async (sel, block = 'start') => {
        const ok = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.scrollIntoView({ block: ${JSON.stringify(block)} }); return true; })()`);
        if (!ok) throw new Error(`nothing at ${sel}`);
        await sleep(400);
    };
    const setSelect = (sel, value) => page.evaluate(`(() => {
        const s = document.querySelector(${JSON.stringify(sel)});
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)});
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return s.value;
    })()`);
    const setInput = (label, value) => page.evaluate(`(() => {
        const i = [...document.querySelectorAll('input')].find(x => x.getAttribute('aria-label') === ${JSON.stringify(label)});
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)});
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        return i.value;
    })()`);

    const seeded = await page.evaluate(`(async () => {
        const { useEntityStore } = await import('/src/stores/useEntityStore.js');
        useEntityStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
        const data = await fetch('/api/load-game-data').then(r => r.json());
        const sky = ${QA_SKY};
        useEntityStore.getState().hydrate({ ...data, hallConstellations: sky.constellations, hallStars: sky.stars });
        const s = useEntityStore.getState();
        return Object.keys(s.items).length + ' items, ' + Object.keys(s.tokens).length + ' tokens, ' + Object.keys(s.hallStars).length + ' stars';
    })()`);
    console.log('seeded:', seeded);

    const openGuildHall = async () => { await clickText('Guild Hall'); await sleep(2500); };
    const openRanks = async (starId) => page.evaluate(`(() => { const s = document.querySelector('[data-hall-star="${starId}"]'); const b = [...s.querySelectorAll('button')].find(b => / ranks?$/.test(b.textContent.trim())); b?.click(); return !!b; })()`);

    await openGuildHall();
    for (const id of ['qa_mining_xp', 'qa_mining_yield', 'qa_well_copper']) await openRanks(id);
    await sleep(500);
    await scrollTo('[data-hall-constellation="qa_mining"]');
    console.log('Miner\'s Lore ranks:', await page.evaluate(`[...document.querySelectorAll('[data-hall-star="qa_mining_xp"] [data-hall-rank]')].map(r => r.textContent.replace(/No tier set|Starter Camp|Plane \\d/g, '').trim()).join(' | ')`));
    await shot('h2_01_guild_hall_rank_pricing.png');

    await clickText('Ledger');
    await sleep(4000);
    await clickText('Pace');
    await sleep(800);
    await scrollTo('[aria-label="Guild Hall paybacks"]');
    console.log('paybacks red at 24 h:', await page.evaluate(`[...document.querySelectorAll('[data-hall-pays="no"]')].map(r => r.getAttribute('data-hall')).join(', ') || 'none'`));
    await shot('h2_02_pace_hall_paybacks.png');

    await clickText('Settings');
    await scrollTo('[aria-label="Guild Hall payback hours"]', 'center');
    await shot('h2_06_ledger_settings_paybacks.png');
    console.log('Guild Hall payback hours now', await setInput('Guild Hall payback hours', '0.1'));
    await sleep(400);
    await clickText('Pace');
    await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Refresh')?.click()`);
    await sleep(3000);
    await scrollTo('[aria-label="Guild Hall paybacks"]');
    console.log('paybacks red at 6 min:', await page.evaluate(`[...document.querySelectorAll('[data-hall-pays="no"]')].map(r => r.getAttribute('data-hall')).join(', ') || 'none'`));
    await shot('h2_03_pace_hall_paybacks_6min.png');
    await clickText('Settings');
    await setInput('Guild Hall payback hours', '24');
    await sleep(300);

    // The owner sets three Mining stars' first ranks to the Starter Camp, where Mining's levels are worked.
    await openGuildHall();
    for (const id of ['qa_mining_xp', 'qa_mining_yield', 'qa_mining_speed', 'qa_vein_rest']) await openRanks(id);
    await sleep(400);
    for (const id of ['qa_mining_xp', 'qa_mining_speed', 'qa_vein_rest', 'qa_mining_yield']) {
        console.log(id, 'rank 1 tier ->', await setSelect(`[data-hall-star="${id}"] [data-hall-rank="1"] [data-hall-rank-tier]`, '0'));
    }
    await page.evaluate(`document.querySelector('[data-hall-pricing-refresh]').click()`);
    await sleep(3000);
    await clickText('Ledger');
    await sleep(4000);
    await clickText('Pace');
    await sleep(800);
    await scrollTo('[data-breakdown^="mining|"]', 'center');
    console.log('Mining\'s Hall share:', await page.evaluate(`[...document.querySelectorAll('[data-breakdown^="mining|"] [data-hall-share]')].map(e => e.textContent).join(' / ')`));
    await shot('h2_04_mining_breakdown_hall_share.png');

    // The Mining row's Typical source opens the vein's page.
    await page.evaluate(`[...document.querySelectorAll('[data-breakdown^="mining|"] button')].find(b => b.textContent.trim() === 'Copper Ore Vein').click()`);
    await sleep(2000);
    await scrollTo('[aria-label="Rates"]');
    console.log('vein Typical chose:', await page.evaluate(`document.querySelector('[data-rate]')?.textContent.match(/Typical chose(.*)$/)?.[1] || ''`));
    await shot('h2_05_vein_rates_with_stars.png');

    console.log('page errors:', page.consoleErrors.length ? page.consoleErrors.join(' | ') : 'none');
    console.log('saved:', await page.evaluate(`localStorage.getItem('fantasy-guild-cms-v2') ? 'something' : 'nothing'`));
} finally {
    await chrome.close();
}
