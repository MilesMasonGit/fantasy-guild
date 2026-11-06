// Throwaway (brief 390 G4): the upgrade ceremony in the real game on the throwaway server (port 5417,
// vite.g4.config.mjs). Sets the sky up with the QA panel's own plans, opens the Guild Hall, buys
// through the panel's Upgrade button, then holds the ceremony's animations and steps them frame by
// frame for pictures (built_g4/). Also checks nothing plays on load or after time away, and counts
// what the ceremony changes in the page while it plays. node capture_g4.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'built_g4');
mkdirSync(out, { recursive: true });
const log = [];
const say = (...a) => { const l = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(l); log.push(l); };

const W = 1920, H = 1080;
const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    const ev = (js) => page.evaluate(js);
    const shot = async (name, clip) => {
        const r = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
        writeFileSync(path.join(out, name), Buffer.from(r.data, 'base64'));
        say('saved', name);
    };
    const centre = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const away = async () => { await page.mouse('mouseMoved', 900, 1075); await sleep(200); };
    const mod = (p) => `await import('/src/${p}')`;

    await page.setViewport(W, H);
    await page.navigate('http://localhost:5417/');
    await page.waitFor('!!window.Game', { timeoutMs: 180000 });
    await sleep(2500);
    await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME')?.click()`);
    await sleep(6000);

    // Hold ceremony timers (the take-down after it plays) so the frames can be stepped; real ones run on.
    await ev(`(() => {
        const real = window.setTimeout.bind(window);
        window.__held = [];
        window.__hold = false;
        window.setTimeout = (fn, ms, ...rest) => {
            if (window.__hold && ms >= 400 && ms <= 4000) { window.__held.push(fn); return -1; }
            return real(fn, ms, ...rest);
        };
        window.__release = () => { window.__hold = false; const h = window.__held; window.__held = []; h.forEach(f => f()); };
    })()`);

    // Watch the board: every change in the page while a ceremony plays.
    const watch = () => ev(`(() => {
        window.__muts = 0;
        window.__mo?.disconnect();
        window.__mo = new MutationObserver(list => { window.__muts += list.length; });
        window.__mo.observe(document.querySelector('[data-guild-hall-board]'), { subtree: true, childList: true, attributes: true });
    })()`);

    const openHall = async () => {
        const bubble = await centre('#guild-bubble-target button');
        await page.click(bubble.x, bubble.y);
        await sleep(1800);
        await away();
    };
    const closeHall = async () => {
        await ev(`document.querySelector('[data-hall-return]')?.click()`);
        await sleep(1200);
    };

    const ceremonyAnims = `document.getAnimations().filter(a => a.effect?.target?.closest?.('[data-hall-ceremony], [data-constellation-glow], [data-constellation-picture]'))`;
    const stepTo = (t) => ev(`(() => { const list = ${ceremonyAnims}; list.forEach(a => { a.pause(); a.currentTime = ${t}; }); return list.length; })()`);

    /** Buy a star through the panel, hold its ceremony, and picture it at each time in `times`. */
    async function playAndShoot(id, tag, times, clipAround) {
        // A click by script: the star may lie past the window's edge (the sky is dragged to see it).
        await ev(`document.querySelector('button[data-hall-node="${id}"]').click()`);
        await sleep(500);
        say(tag, 'panel shows:', await ev(`document.querySelector('[data-hall-details] h2, [data-hall-details] [class*=title]')?.innerText || document.querySelector('[data-hall-details]')?.innerText.slice(0, 30)`));
        await away();
        await watch();
        await ev(`window.__hold = true`);
        const t0 = await ev(`performance.now()`);
        await ev(`document.querySelector('#guild-upgrade-button button, button#guild-upgrade-button, #guild-upgrade-button')?.click()`);
        const n = await stepTo(0);
        say(tag, 'ceremony animations held:', n, 'ceremony:', await ev(`(() => { const e = document.querySelector('[data-hall-ceremony]'); return e && { star: e.dataset.hallCeremony, opened: e.dataset.ceremonyOpened, finished: e.dataset.ceremonyFinished }; })()`));
        const clip = await clipAround();
        for (const t of times) {
            await stepTo(t);
            await sleep(60);
            await shot(`${tag}_${String(t).padStart(4, '0')}ms.png`, clip);
        }
        // Let it play out for real, and count what changed in the page meanwhile.
        await ev(`(() => { ${ceremonyAnims}.forEach(a => a.play()); })()`);
        await ev(`window.__muts = 0`);
        await sleep(1500);
        const during = await ev(`window.__muts`);
        await ev(`window.__release()`);
        await sleep(300);
        say(tag, 'page changes while it played (after the purchase render):', during, '; ceremony gone after:', await ev(`!document.querySelector('[data-hall-ceremony]')`), '; wall ms', Math.round((await ev(`performance.now()`)) - t0));
        await ev(`window.__mo?.disconnect()`);
    }

    const boxAround = (ids, pad = 120) => () => ev(`(() => {
        const rs = ${JSON.stringify(ids)}.map(id => document.querySelector('button[data-hall-node="' + id + '"]')?.getBoundingClientRect()).filter(Boolean);
        const x0 = Math.min(...rs.map(r => r.left)) - ${pad}, y0 = Math.min(...rs.map(r => r.top)) - ${pad};
        const x1 = Math.max(...rs.map(r => r.right)) + ${pad}, y1 = Math.max(...rs.map(r => r.bottom)) + ${pad};
        const x = Math.max(0, Math.round(x0)), y = Math.max(0, Math.round(y0));
        return { x, y, width: Math.round(Math.min(innerWidth, x1) - x), height: Math.round(Math.min(innerHeight, y1) - y) };
    })()`);

    // 1. A star that opens others: burst, light runs, the opened stars pop.
    const opens = await ev(`(async () => {
        const p = (${mod('ui/dev/hallCeremonyDev.js')}).planStarThatOpens();
        const d = ${mod('ui/dev/GuildHallDevSection.jsx')};
        d.devSetGuildRanks(p.ranks); d.devGiveNextPrice([p.id]);
        return p;
    })()`);
    say('star that opens:', opens.id, '->', opens.opens);
    await openHall();
    const openedIds = await ev(`(async () => (${mod('ui/components/board/hallCeremony.js')}).ceremonyFor(${JSON.stringify(opens.id)}, 1, {}).opened)()`);
    await playAndShoot(opens.id, 'opens', [0, 70, 140, 210, 280, 420, 560, 700, 840, 1000], boxAround([opens.id, ...openedIds], 90));
    await closeHall();

    // 2. A constellation one star short: the bigger moment.
    const short = await ev(`(async () => {
        const p = (${mod('ui/dev/hallCeremonyDev.js')}).planConstellationOneShort();
        const d = ${mod('ui/dev/GuildHallDevSection.jsx')};
        d.devSetGuildRanks(p.ranks); d.devGiveNextPrice([p.id]);
        return p;
    })()`);
    say('constellation one short:', short.constellation, 'last star', short.id);
    await page.setViewport(2560, 2200);
    await sleep(800);
    await openHall();
    const members = await ev(`(async () => (${mod('ui/components/board/hallCeremony.js')}).constellationStars((${mod('config/guildUpgrades.js')}).getUpgradeDef(${JSON.stringify(short.id)}).constellation))()`);
    await playAndShoot(short.id, 'constellation', [0, 70, 140, 210, 280, 350, 420, 600, 800, 1000, 1300], boxAround(members, 110));
    await shot('constellation_after_full.png');
    await page.setViewport(W, H);
    await sleep(800);

    // 3. Reduced motion: the still version.
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await closeHall();
    const still = await ev(`(async () => {
        const p = (${mod('ui/dev/hallCeremonyDev.js')}).planStarThatOpens();
        const d = ${mod('ui/dev/GuildHallDevSection.jsx')};
        d.devSetGuildRanks(p.ranks); d.devGiveNextPrice([p.id]);
        return p;
    })()`);
    await openHall();
    await playAndShoot(still.id, 'reduced', [0, 400], boxAround([still.id, ...openedIds], 90));
    await page.send('Emulation.setEmulatedMedia', { features: [] });

    // 4. Nothing on load: a finished constellation and fresh ranks in the save, the Hall opened after.
    await closeHall();
    await ev(`(async () => {
        const d = ${mod('ui/dev/GuildHallDevSection.jsx')};
        d.devSetGuildRanks({ ...${JSON.stringify(short.ranks)}, ${JSON.stringify(short.id)}: 1, bank_tabs: 2 });
    })()`);
    await openHall();
    await sleep(500);
    say('on opening the Hall with a finished constellation: ceremony', await ev(`!!document.querySelector('[data-hall-ceremony]')`), 'glow', await ev(`!!document.querySelector('[data-constellation-glow]')`));

    // 5. Time away with the Hall open, and a rank bought inside it: nothing plays.
    const awayResult = await ev(`(async () => {
        const { EventBus, UI_LISTENER } = ${mod('systems/core/EventBus.js')};
        const { ENGINE_EVENTS } = ${mod('systems/core/engineEvents.js')};
        const d = ${mod('ui/dev/GuildHallDevSection.jsx')};
        let bought = null;
        const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_STARTED, () => {
            off();
            d.devGiveNextPrice(['roster_size']);
            bought = window.Game.GuildUpgradeManager.purchase('roster_size').success;
        }, UI_LISTENER);
        let sound = 0;
        const offS = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (x) => { if (String(x?.clip).startsWith('hall_')) sound++; });
        const n = ${mod('ui/dev/notificationsDev.js')};
        await n.timeAwayWithNews();
        offS();
        return { bought, sound };
    })()`);
    await sleep(800);
    say('time away (20 min) with a rank bought inside it:', awayResult, 'ceremony', await ev(`!!document.querySelector('[data-hall-ceremony]')`), 'glow', await ev(`!!document.querySelector('[data-constellation-glow]')`), 'Hall still open', await ev(`!!document.querySelector('[data-guild-hall-board]')`));
    await shot('after_time_away.png');

    // 6. Bought while the Hall is closed: nothing when it opens.
    await ev(`document.querySelectorAll('button').forEach(b => { if (/^(continue|close|ok)$/i.test(b.innerText.trim())) b.click(); })`);
    await sleep(500);
    await closeHall();
    await ev(`(async () => { const d = ${mod('ui/dev/GuildHallDevSection.jsx')}; d.devGiveNextPrice(['bank_tabs']); window.Game.GuildUpgradeManager.purchase('bank_tabs'); })()`);
    await openHall();
    await sleep(400);
    say('a rank bought while the Hall was closed, then opened: ceremony', await ev(`!!document.querySelector('[data-hall-ceremony]')`));

    // The missing chime file falls back.
    say('chime file status:', await ev(`fetch('/assets/audio/sfx/hall_star_chime.ogg').then(r => r.status + ' ' + r.headers.get('content-type'))`));
    say('picture slot status:', await ev(`fetch('/assets/playmat/screens/constellation_forestry.png').then(r => r.status + ' ' + r.headers.get('content-type'))`));
    say('picture slots drawn:', await ev(`[...document.querySelectorAll('[data-constellation-picture]')].map(e => e.dataset.constellationPicture)`));
} finally {
    writeFileSync(path.join(out, 'verify_log.txt'), log.join('\n') + '\n');
    await chrome.close();
}
