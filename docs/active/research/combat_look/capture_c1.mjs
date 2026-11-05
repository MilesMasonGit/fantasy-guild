// node capture_c1.mjs <url> <outDir>
// The combat look mock-ups (brief 360 C1), each a real screen of the game at 1920 x 1080 with the
// mock-up drawn into the page by look.js. Needs the dev server (its modules build the fights).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { sleep } from '../../../../bench/browser/cdp.mjs';
import { openGame, setUpCrowd, readFights, H, W } from './scene.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [url = 'http://localhost:5183/', out = here] = process.argv.slice(2);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(out, { recursive: true });

const KIRA = {
    hero: 'Kira', enemy: 'Goblin', sprite: '/assets/enemies/goblin/e_goblin.png', hp: [17, 24], ehp: [9, 25], say: 'Shiv', floatHero: '2',
    heroS: { style: 'melee', styleName: 'Melee', lv: '14/99', hit: [2, 'slash'], swing: '2.4s', resist: '25%' },
    enemyS: { style: 'melee', styleName: 'Melee', lv: '5/99', hit: [1, 'stab'], swing: '3.0s', resist: '–' },
    moves: [{ name: 'Shiv', type: 'stab', typeName: 'Stab', last: true }, { name: 'Club', type: 'crush', typeName: 'Crush' }],
    heroFx: [{ icon: 'drop', name: 'Venom', n: '×2' }, { icon: 'star', colour: 'gold', name: 'Valor' }, { icon: 'star', colour: 'gold', name: 'Ironskin' }],
    enemyFx: [{ icon: 'flame', name: 'Burn', n: '×1' }, { icon: 'sunder', name: 'Sunder', n: '×2' }],
    elixirs: [['i_potion_sun_red', 10], ['i_potion_hammer_grey', 7]]
};
const AELA = {
    hero: 'Aela', enemy: 'Wolf', sprite: '/assets/enemies/animal/e_wolf.png', hp: [12, 21], ehp: [15, 24], say: 'Bite', floatHero: '1',
    heroS: { style: 'melee', styleName: 'Melee', lv: '11/99', hit: [2, 'slash'], swing: '2.4s', resist: '–' },
    enemyS: { style: 'melee', styleName: 'Melee', lv: '4/99', hit: [1, 'stab'], swing: '1.8s', resist: '–' },
    moves: [{ name: 'Bite', type: 'stab', typeName: 'Stab', last: true }, { name: 'Claw', type: 'slash', typeName: 'Slash' }],
    heroFx: [], enemyFx: [], elixirs: []
};
const BRAM = {
    hero: 'Bram', enemy: 'Goblin Chief', sprite: '/assets/enemies/goblin/e_goblin_chief.png', hp: [26, 32], ehp: [41, 60],
    heroS: { style: 'melee', styleName: 'Melee', lv: '22/99', hit: [3, 'slash'], swing: '2.4s', resist: '25%' },
    enemyS: { style: 'melee', styleName: 'Melee', lv: '12/99', hit: [3, 'slash'], swing: '4.0s', resist: '–' },
    moves: [{ name: 'Cleave', type: 'slash', typeName: 'Slash' }, { name: 'Bash', type: 'crush', typeName: 'Crush', last: true }],
    heroFx: [{ icon: 'star', colour: 'gold', name: 'Valor' }], enemyFx: [{ icon: 'star', colour: 'gold', name: 'Brute' }],
    elixirs: [['i_potion_sun_red', 4]]
};
const TOMAS = { hero: 'Tomas', enemy: 'Cow', sprite: '/assets/enemies/animal/e_cow.png', hp: [15, 16], ehp: [6, 21] };
const NEVE = { hero: 'Neve', enemy: 'Slime', sprite: '/assets/enemies/slime/e_slime_green_greater.png', hp: [28, 28], ehp: [0, 28], result: 'Won' };

const { chrome, page } = await openGame(url);
const grab = async (clip) => {
    const d = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { x: Math.round(clip.x), y: Math.round(clip.y), width: Math.round(clip.width), height: Math.round(clip.height), scale: 1 } } : {}) });
    return Buffer.from(d.data, 'base64');
};
const shot = async (name, clip = null) => {
    await page.evaluate('CL.tidy()');
    writeFileSync(path.join(out, `${name}.png`), await grab(clip));
    console.log('saved', name);
};
const want = (k) => !only || only.includes(k);
const toJs = (v) => JSON.stringify(v);

try {
    console.log(await setUpCrowd(page));
    await sleep(500);
    await page.key('Escape', 'Escape', 27);
    await page.mouse('mouseMoved', 5, H - 5);
    await page.evaluate(readFileSync(path.join(here, 'look.js'), 'utf8'));
    await sleep(24000);
    await page.evaluate('CL.tidy()');
    await sleep(200);

    // Today's fight panel, the real one.
    if (want('today')) {
        await page.evaluate(`document.querySelector('[data-fight-chip]').click()`);
        await sleep(900);
        await page.mouse('mouseMoved', 5, H - 5);
        const box = await page.evaluate(`(() => { const r = document.querySelector('[data-fight-panel]').getBoundingClientRect(); return { x: r.left - 24, y: r.top - 24, width: r.width + 48, height: r.height + 48 }; })()`);
        await shot('window_today', box);
        await page.key('Escape', 'Escape', 27);
        await sleep(400);
    }

    // The busy mat today, the moment floats are up, then the same moment redrawn.
    for (let i = 0; i < 500; i++) {
        if (await page.evaluate(`document.querySelectorAll('[data-fight-float]').length`) >= 3) break;
        await sleep(30);
    }
    const q = await readFights(page);
    console.log(JSON.stringify(q.map(f => [f.heroName, f.heroText, f.enemyText])));
    const bs = q.flatMap(f => [f.hero, f.enemy, f.heroBar, f.enemyBar, f.plate, f.chip].filter(Boolean));
    const cx = Math.max(180, Math.min(...bs.map(b => b.x)) - 40), cy = Math.max(90, Math.min(...bs.map(b => b.y)) - 60);
    const crop = { x: cx, y: cy, width: Math.min(W, Math.max(...bs.map(b => b.x + b.w)) + 40) - cx, height: Math.min(H, Math.max(...bs.map(b => b.y + b.h)) + 30) - cy };
    await shot('mat_today', crop);

    // The after pictures show the look at rest: the white hit flash stays out of them.
    await page.evaluate(`(async () => { (await import('/src/ui/dev/perf/drawSwitches.js')).setDrawn('tokenFx', false); CL.after(true); })()`);
    await sleep(300);
    const drawAll = (qs) => page.evaluate(`(() => {
        CL.clear();
        const fs = ${toJs(qs)}.map(f => ({ f, at: CL.matFight(f) }));
        const by = (n) => fs.find(x => x.f.heroName === n);
        const a = by('Aela'), k = by('Kira'), b = by('Bram'), n = by('Neve'), t = by('Tomas');
        if (a) { CL.say(a.at.he, 'Bite'); CL.float(a.at.he, 'hit', 1, true); }
        if (k) { CL.float(k.at.en, 'crit', 7, false, 62); }
        if (b) { CL.say(b.at.en, 'Cleave', 'attention'); CL.float(b.at.he, 'hit', 3, true); }
        if (n) { CL.float(n.at.en, 'miss', 0, false); }
        if (t) { CL.float(t.at.he, 'heal', 2, false); }
    })()`);
    if (want('mat')) {
        await drawAll(q);
        await sleep(100);
        await shot('mat_after', crop);
    }

    // Close up, one fight, six moments, twice the size.
    if (want('moments')) {
        const box = { x: 1264, y: 345, width: 276, height: 236 };
        const moments = [
            ['Damage', `CL.float(at.en, 'hit', 2, false); CL.float(at.he, 'hit', 1, true);`],
            ['Crit!', `CL.float(at.en, 'crit', 7, false, 62);`],
            ['Miss', `CL.float(at.he, 'miss', 0, true);`],
            ['Heal', `CL.float(at.he, 'heal', 2, false);`],
            ['Named move', `CL.say(at.en, 'Shiv'); CL.float(at.he, 'hit', 1, true);`],
            ['Effect lands', `CL.say(at.he, 'Venom!');`]
        ];
        const tiles = [];
        for (const [name, js] of moments) {
            await page.evaluate(`(() => { CL.clear(); const at = CL.stage(${box.x + 24}, ${box.y + 62}); ${js}; CL.label(${toJs(name)}, ${box.x + 6}, ${box.y + box.height - 24}); })()`);
            await sleep(60);
            tiles.push(await grab(box));
        }
        const gap = 4;
        const comp = tiles.map((t, i) => ({ input: t, left: (i % 3) * (box.width + gap), top: Math.floor(i / 3) * (box.height + gap) }));
        const sheet = await sharp({ create: { width: box.width * 3 + gap * 2, height: box.height * 2 + gap, channels: 4, background: '#0a0a0a' } }).composite(comp).png().toBuffer();
        const m = await sharp(sheet).metadata();
        writeFileSync(path.join(out, 'mat_moments.png'), await sharp(sheet).resize(m.width * 2, m.height * 2, { kernel: 'nearest' }).png().toBuffer());
        console.log('saved mat_moments');
    }

    // Each window look: alone over quiet mat, then three open at once over the redrawn mat.
    for (const look of ['A', 'B', 'C']) {
        if (!want('win' + look)) continue;
        await page.evaluate('CL.clear()');
        const place = { A: [420, 90], B: [420, 110], C: [300, 110] }[look];
        const r = await page.evaluate(`CL.win('${look}', ${toJs(KIRA)}, ${place[0]}, ${place[1]})`);
        await sleep(120);
        await shot(`window_${look}`, { x: r.x - 24, y: r.y - 24, width: r.width + 48, height: r.height + 48 });
        await drawAll(await readFights(page));
        const three = {
            A: [[190, 88, KIRA], [700, 130, AELA], [1210, 172, BRAM]],
            B: [[190, 88, KIRA], [570, 88, AELA], [1520, 88, BRAM]],
            C: [[190, 88, KIRA], [1040, 88, AELA], [190, 540, BRAM]]
        }[look];
        for (const [x, y, f] of three) await page.evaluate(`CL.win('${look}', ${toJs(f)}, ${x}, ${y})`);
        await sleep(120);
        await shot(`window_${look}_three`);
    }

    // The tabs: a strip above the hero bar.
    for (const look of ['D', 'E']) {
        if (!want('tab' + look)) continue;
        await drawAll(await readFights(page));
        const r = await page.evaluate(`CL.strip('${look}', ${toJs([KIRA, AELA, BRAM, TOMAS, NEVE])}, 190, 972)`);
        await sleep(120);
        const top = Math.min(r.y - 40, 800);
        await shot(`tabs_${look}`, { x: 170, y: top, width: 1560, height: H - top });
    }
    console.log('errors', page.consoleErrors);
} finally {
    await chrome.close();
}
