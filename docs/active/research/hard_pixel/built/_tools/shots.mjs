// Throwaway (brief 460 P2): shoot the soft-to-hard marks in the real game, before the change (run on the
// old code) or after it (run on the new code). Pictures go to raw/<label>_<job>_<W>_<name>.png, the boxes
// to raw/pos_<label>_<job>_<W>.json. The -1, the gold gear and the demolition mark cannot show in the
// starter camp, so the helpers draw each with the component's own classes for that label.
// node shots.mjs <before|after> <job> [W H]   jobs: camp, busy, shop, ghost
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'raw');
mkdirSync(out, { recursive: true });
const label = process.argv[2];
const job = process.argv[3] || 'camp';
const W = Number(process.argv[4] || 1920), H = Number(process.argv[5] || 1080);
const URL0 = 'http://localhost:5461/';
const BADGE = label === 'before' ? 'filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]' : 'drop-shadow-[2px_2px_0_#000]';
const FLOAT = label === 'before' ? 'drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]' : '';
const RING = label === 'before' ? ['ring-4', 'ring-gi-success', 'shadow-[0_0_15px_rgba(34,197,94,0.6)]'] : ['ring-4', 'ring-gi-success'];
const pos = {};

const helpers = `(() => {
  window.P2 = {
    badge(tokenId, kind, iconSrc) {
      const token = document.querySelector('[data-token-overlay="' + tokenId + '"]') || document.querySelector('[data-token-id="' + tokenId + '"]');
      const row = document.createElement('div');
      row.className = 'absolute z-20 flex items-center justify-center pointer-events-none';
      Object.assign(row.style, { left: '0', width: '100%', top: '50%', transform: 'translateY(-50%)' });
      if (kind === 'marked') {
        row.innerHTML = '<div data-demolish-badge="true" class="shrink-0 select-none w-7 h-7 flex items-center justify-center rounded-full bg-black/70 border border-gi-warning/80 ${BADGE}"><img src="' + iconSrc + '" style="width:16px;height:16px;image-rendering:pixelated"></div>';
      } else {
        const mask = (dx, dy) => 'left:' + dx + 'px;top:' + dy + 'px;width:24px;height:24px;mask-image:url(/assets/ui/u_gear.png);-webkit-mask-image:url(/assets/ui/u_gear.png);mask-size:100% 100%;-webkit-mask-size:100% 100%;mask-repeat:no-repeat;image-rendering:pixelated';
        const outline = [[-2, 0], [2, 0], [0, -2], [0, 2]].map(([dx, dy]) => '<span class="gi-gear-alert absolute pointer-events-none" style="' + mask(dx, dy) + '"></span>').join('');
        row.innerHTML = '<div data-station-gear="unset" class="relative shrink-0"><button type="button" class="w-7 h-7 flex items-center justify-center p-0 select-none ${BADGE} relative">' + outline + '<img src="/assets/ui/u_gear.png" class="relative object-contain w-6 h-6" style="image-rendering:pixelated"></button></div>';
      }
      token.appendChild(row);
      const r = row.firstElementChild.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    },
    floater(tokenId, text) {
      const token = document.querySelector('[data-token-overlay="' + tokenId + '"]') || document.querySelector('[data-token-id="' + tokenId + '"]');
      const host = document.createElement('div');
      host.setAttribute('data-charge-floater', 'ring');
      host.className = 'absolute z-50 pointer-events-none';
      host.style.left = '58%'; host.style.top = '18%';
      const d = document.createElement('div');
      d.className = 'font-bold ui-text-title tabular-nums leading-none tracking-tight pointer-events-none select-none ${FLOAT} whitespace-nowrap text-amber-200';
      d.textContent = text || '-1';
      host.appendChild(d); token.appendChild(host);
      const r = d.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
  };
  return 'ok';
})()`;

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    const ev = (js) => page.evaluate(js);
    const shot = async (name) => {
        const r = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(out, `${label}_${job}_${W}_${name}.png`), Buffer.from(r.data, 'base64'));
        console.log('saved', `${label}_${job}_${W}_${name}.png`);
    };
    const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })()`);
    const tokenOf = (type, n = 0) => ev(`(() => { const e = [...document.querySelectorAll('[data-token-art][data-token-type=${JSON.stringify(type)}]')][${n}]; if (!e) return null; const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-token-id'), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const styleOf = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const s = getComputedStyle(e); return { filter: s.filter, textShadow: s.textShadow, boxShadow: s.boxShadow, animation: s.animationName }; })()`);

    await page.setViewport(W, H);
    if (job === 'busy') {
        await page.navigate(URL0 + '?stress=realistic');
        await page.waitFor('window.__perf?.running === true', { timeoutMs: 180000, intervalMs: 500 });
        await sleep(3000);
        await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'HIDE')?.click()`);
    } else {
        await page.navigate(URL0);
        await page.waitFor('!!window.Game', { timeoutMs: 180000 });
        await sleep(2500);
        await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME')?.click()`);
        await sleep(8000);
    }
    await ev(`window.Game.GameLoop.stop()`);
    await sleep(500);
    console.log(await ev(helpers));
    pos.mat = await rect('[data-mat-surface]');

    if (job === 'camp') {
        const tree = await tokenOf('token_oak_tree', 1);
        const rock = await tokenOf('token_stone_outcrop', 0);
        const vein = await tokenOf('token_copper_ore_vein', 0);
        const fire = await tokenOf('token_campfire', 0) || await tokenOf('token_copper_mine', 0);
        await ev(`(async () => { const m = await import('/src/ui/hooks/useMapMode.js'); m.flipDisallowed(${JSON.stringify(tree.id)}); })()`);
        await sleep(800);
        pos.floater = await ev(`window.P2.floater(${JSON.stringify(vein.id)})`);
        const icon = await ev(`(async () => (await import('/src/ui/components/base/SkillIcon.jsx')).skillArt(null, 'construction').spritePath)()`);
        await ev(`window.P2.badge(${JSON.stringify(rock.id)}, 'marked', ${JSON.stringify(icon.startsWith('/') ? icon : '/' + icon)})`);
        await ev(`window.P2.badge(${JSON.stringify(fire.id)}, 'gear')`);
        await ev(`document.querySelectorAll('[data-token-type="token_coal_vein"]').forEach(e => e.setAttribute('data-summary-highlight', 'true'))`);
        await ev(`document.querySelector('#bank-bubble-target, [id$="-bubble-target"]:not(#guild-bubble-target)')?.classList.add(...${JSON.stringify(RING)})`);
        pos.disallow = await rect('[data-tile-disallowed]');
        pos.marked = await rect('[data-demolish-badge]');
        pos.gear = await rect('[data-station-gear]');
        pos.navRing = await rect('.ring-gi-success');
        pos.nav = await rect('#guild-bubble-target');
        pos.coal = await tokenOf('token_coal_vein', 0);
        pos.dockName = await rect('[data-dock-name]');
        pos.styles = {
            disallow: await styleOf('[data-tile-disallowed]'),
            summary: await styleOf('[data-summary-highlight="true"]'),
            navIcon: await styleOf('[data-alpha-circle] > svg'),
            navRing: await styleOf('.ring-gi-success'),
            dockName: await styleOf('[data-dock-name]'),
            ringLabel: await styleOf('[data-ring-label]'),
            mat: await styleOf('[data-mat-surface]')
        };
        await page.mouse('mouseMoved', W - 5, H - 5);
        await sleep(600);
        await shot('still');
        await page.mouse('mouseMoved', fire.x, fire.y);
        await sleep(1200);
        pos.name = await rect('[data-token-name] span');
        pos.styles.name = await styleOf('[data-token-name] span');
        await shot('hover');
        const tree2 = await tokenOf('token_oak_tree', 0);
        await page.mouse('mouseMoved', tree2.x, tree2.y + 10);
        await sleep(1200);
        pos.name2 = await rect('[data-token-name] span');
        await shot('hover2');
        // The mat with the ground switched off: the surface draws its own edge.
        await page.mouse('mouseMoved', W - 5, H - 5);
        await ev(`(async () => (await import('/src/ui/dev/perf/drawSwitches.js')).setDrawn('terrain', false))()`);
        await sleep(1500);
        pos.styles.matNoGround = await styleOf('[data-mat-surface]');
        await shot('noground');
        await ev(`(async () => (await import('/src/ui/dev/perf/drawSwitches.js')).setDrawn('terrain', true))()`);
    }

    if (job === 'busy') {
        const pick = await ev(`(() => {
            for (const t of ['bench_forest', 'bench_tree', 'bench_rock']) for (const e of document.querySelectorAll('[data-token-art][data-token-type="' + t + '"]')) {
                const r = e.getBoundingClientRect();
                if (r.x > 500 && r.x < ${W} - 400 && r.y > 200 && r.y < ${H} - 300) return { id: e.getAttribute('data-token-id'), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
            return null;
        })()`);
        pos.floater = await ev(`window.P2.floater(${JSON.stringify(pick.id)})`);
        await page.mouse('mouseMoved', pick.x, pick.y);
        await sleep(1200);
        pos.name = await rect('[data-token-name] span');
        pos.pick = pick;
        pos.health = await rect('[data-health-label]');
        pos.styles = {
            name: await styleOf('[data-token-name] span'),
            health: await styleOf('[data-health-label]'),
            ringLabel: await styleOf('[data-ring-label]')
        };
        await shot('hover');
    }

    if (job === 'shop') {
        const at = await rect('button[aria-label="Shop"]');
        await page.click(at[0] + at[2] / 2, at[1] + at[3] / 2);
        await sleep(2000);
        const sprite = await ev(`(() => { for (const e of document.querySelectorAll('[data-item-bar-sprite]')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.y > 100 && r.y < innerHeight - 100) return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; } return null; })()`);
        await page.mouse('mouseMoved', sprite[0], sprite[1]);
        await sleep(800);
        pos.ribbon = sprite;
        pos.styles = { sprite: await styleOf('.group:hover [data-item-bar-sprite]') };
        await shot('ribbon');
    }

    if (job === 'ghost') {
        const hall = await tokenOf('token_guild_hall', 0);
        await page.mouse('mouseMoved', hall.x, hall.y);
        await sleep(300);
        await page.mouse('mousePressed', hall.x, hall.y, { button: 'left', buttons: 1, clickCount: 1 });
        for (let i = 1; i <= 20; i++) {
            await page.mouse('mouseMoved', hall.x + (760 - hall.x) * i / 20, hall.y + (H - 18 - hall.y) * i / 20, { button: 'left', buttons: 1 });
            await sleep(40);
        }
        await sleep(800);
        pos.ghost = await rect('img[alt="Disallow"]');
        pos.styles = { ghost: await styleOf('img[alt="Disallow"]') };
        await shot('ghost');
        await page.mouse('mouseReleased', 160, H - 60, { button: 'left', buttons: 0, clickCount: 1 });
    }

    console.log('console errors:', page.consoleErrors.slice(0, 5));
    writeFileSync(path.join(out, `pos_${label}_${job}_${W}.json`), JSON.stringify(pos, null, 1));
    console.log(JSON.stringify(pos.styles || {}, null, 1));
} finally {
    await chrome.close();
}
