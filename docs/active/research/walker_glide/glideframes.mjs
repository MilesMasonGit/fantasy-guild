// A strolling goblin, frame by frame, at 1920x1080: is it drawn crisp in every frame, and how far
// does it jump between frames? Usage: node glideframes.mjs <baseUrl> <label> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const REPO = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/p23b';
const { launchChrome, sleep, runCleanups } = await import(pathToFileURL(`${REPO}/bench/browser/cdp.mjs`).href);
const { SCENES, sceneUrl, openBoard } = await import(pathToFileURL(`${REPO}/bench/browser/scenes.mjs`).href);
const require = createRequire(`${REPO}/package.json`);
const sharp = require('sharp');

const [base, label, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const FIND = `(() => {
  const mat = document.querySelector('[data-board-scale]');
  const fit = Number(mat.dataset.boardScale);
  const boxes = [...document.querySelectorAll('[data-token-art="true"]')].filter(el => /translate\\(/.test(el.style.transform || ''));
  const walking = boxes.filter(el => /linear|steps\\(/.test(el.style.transition || ''));
  const inView = walking.map(el => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.left > 80 && r.top > 80 && r.right < innerWidth - 80 && r.bottom < innerHeight - 80);
  if (!inView.length) return null;
  const { el, r } = inView[0];
  el.dataset.glideWatch = 'true';
  return { id: el.dataset.tokenId, type: el.dataset.tokenType, fit, x: r.left, y: r.top, w: r.width, h: r.height };
})()`;

const READ = `(() => {
  const el = document.querySelector('[data-glide-watch]');
  if (!el) return null;
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { tx: m.m41, ty: m.m42, transition: el.style.transition, t: performance.now() };
})()`;

/** Share of pixels with an identical neighbour across AND down: 1 for a whole-pixel upscale, low for a resampled one. */
function blockShare(raw, w, x0, y0, x1, y1) {
    const px = (x, y) => { const p = (y * w + x) * 4; return (raw[p] << 16) | (raw[p + 1] << 8) | raw[p + 2]; };
    let total = 0, ok = 0;
    for (let y = y0 + 1; y < y1 - 1; y++) {
        for (let x = x0 + 1; x < x1 - 1; x++) {
            const c = px(x, y);
            total++;
            if ((c === px(x - 1, y) || c === px(x + 1, y)) && (c === px(x, y - 1) || c === px(x, y + 1))) ok++;
        }
    }
    return total ? ok / total : null;
}

let chrome;
try {
    chrome = await launchChrome({ width: 1920, height: 1080 });
    const page = await openBoard(chrome, sceneUrl(base, SCENES.S2), { cpu: 1, stress: SCENES.S2.stress });
    await sleep(15000);
    let g = null;
    const until = Date.now() + 60000;
    while (!g && Date.now() < until) { g = await page.evaluate(FIND); if (!g) await sleep(40); }
    if (!g) throw new Error('no goblin walking in view');
    const full = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `${label}_full_1920x1080.png`), Buffer.from(full.data, 'base64'));
    const clip = { x: Math.max(0, Math.round(g.x - 70)), y: Math.max(0, Math.round(g.y - 70)), width: Math.round(g.w + 140), height: Math.round(g.h + 140), scale: 1 };
    const frames = [];
    const end = Date.now() + 1000;
    while (Date.now() < end) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', clip });
        const at = await page.evaluate(READ);
        frames.push({ png: Buffer.from(shot.data, 'base64'), at });
    }
    // Then a walk again, every frame of it in the page.
    await page.evaluate(`(document.querySelectorAll('[data-glide-watch]').forEach(e => delete e.dataset.glideWatch), true)`);
    let g2 = null;
    const until2 = Date.now() + 60000;
    while (!g2 && Date.now() < until2) { g2 = await page.evaluate(FIND); if (!g2) await sleep(20); }
    // Every frame for 1.5 s, in the page: where the box is drawn (its live transform), in screen px.
    const perFrame = await page.evaluate(`new Promise(done => {
      const el = document.querySelector('[data-glide-watch]');
      const fit = ${g2.fit};
      const out = [];
      const t0 = performance.now();
      const step = (t) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        out.push({ t: +(t - t0).toFixed(1), x: +(m.m41 * fit).toFixed(3), y: +(m.m42 * fit).toFixed(3), walking: /linear|steps/.test(el.style.transition) });
        if (t - t0 < 1500) requestAnimationFrame(step); else done(out);
      };
      requestAnimationFrame(step);
    })`);
    const walkingFrames = perFrame.filter(f => f.walking);
    const pairs = perFrame.slice(1).map((f, i) => [perFrame[i], f]).filter(([a, b]) => a.walking && b.walking);
    const changed = pairs.filter(([a, b]) => a.x !== b.x || a.y !== b.y);
    const drawnMoves = pairs.map(([a, b]) => ({ dx: Math.round(b.x) - Math.round(a.x), dy: Math.round(b.y) - Math.round(a.y) }));
    const perFrameSummary = {
        frames: perFrame.length,
        framesWalking: walkingFrames.length, walkingFramePairs: pairs.length,
        walkingFramesWherePositionChanged: changed.length,
        walkingFramesWhereRoundedPixelChanged: drawnMoves.filter(m => m.dx || m.dy).length,
        biggestRoundedMovePx: Math.max(...drawnMoves.map(m => Math.max(Math.abs(m.dx), Math.abs(m.dy)))),
        biggestRawMovePx: +Math.max(...pairs.map(([a, b]) => Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)))).toFixed(3)
    };
    fs.writeFileSync(path.join(outDir, `${label}_perframe.json`), JSON.stringify({ perFrameSummary, perFrame }, null, 2));
    console.log(JSON.stringify(perFrameSummary));
    // The goblin's own middle (its box's middle 50 %), in clip pixels, per frame from where its box was.
    const rows = [];
    let prev = null;
    for (const f of frames) {
        const { data, info } = await sharp(f.png).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
        const sx = (f.at.tx * g.fit), sy = (f.at.ty * g.fit);
        const ox = g.x - clip.x + (prev0(frames, f, g) .dx), oy = g.y - clip.y + (prev0(frames, f, g).dy);
        const share = blockShare(data, info.width, Math.round(ox + g.w * 0.25), Math.round(oy + g.h * 0.25), Math.round(ox + g.w * 0.75), Math.round(oy + g.h * 0.75));
        const move = prev ? { dx: +(sx - prev.sx).toFixed(2), dy: +(sy - prev.sy).toFixed(2) } : { dx: 0, dy: 0 };
        rows.push({ t: +f.at.t.toFixed(1), screenX: +sx.toFixed(2), screenY: +sy.toFixed(2), move, transition: f.at.transition, crisp: share == null ? null : +share.toFixed(3) });
        prev = { sx, sy };
    }
    // A strip of the first 10 frames, 3x nearest-neighbour, side by side.
    const pick = frames.slice(0, 10);
    const meta = await sharp(pick[0].png).metadata();
    const W = meta.width * 3, H = meta.height * 3;
    const tiles = await Promise.all(pick.map(f => sharp(f.png).resize(W, H, { kernel: 'nearest' }).png().toBuffer()));
    await sharp({ create: { width: W * tiles.length + 4 * (tiles.length - 1), height: H, channels: 4, background: { r: 255, g: 0, b: 255, alpha: 1 } } })
        .composite(tiles.map((input, i) => ({ input, left: i * (W + 4), top: 0 })))
        .png().toFile(path.join(outDir, `${label}_strip_10frames_x3.png`));
    const crisp = rows.map(r => r.crisp).filter(v => v != null);
    const moves = rows.slice(1).map(r => Math.max(Math.abs(r.move.dx), Math.abs(r.move.dy)));
    const summary = {
        label, base, goblin: { id: g.id, type: g.type }, fit: g.fit, frames: rows.length,
        msPerFrame: +((rows.at(-1).t - rows[0].t) / (rows.length - 1)).toFixed(1),
        crisp: { min: Math.min(...crisp), median: crisp.sort((a, b) => a - b)[Math.floor(crisp.length / 2)] },
        positionsSeen: new Set(rows.map(r => `${r.screenX},${r.screenY}`)).size,
        biggestMovePx: Math.max(...moves),
        transitions: [...new Set(rows.map(r => r.transition))]
    };
    fs.writeFileSync(path.join(outDir, `${label}_frames.json`), JSON.stringify({ summary, rows }, null, 2));
    console.log(JSON.stringify(summary, null, 2));
} finally {
    await runCleanups();
}

// The goblin moves inside the fixed clip: offset its middle by how far its box moved since the first frame.
function prev0(frames, f, g) {
    const a = frames[0].at, b = f.at;
    return { dx: (b.tx - a.tx) * g.fit, dy: (b.ty - a.ty) * g.fit };
}
