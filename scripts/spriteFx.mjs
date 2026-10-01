// Fantasy Guild — generates the sprites' hard shadows and coloured outlines
// (Wave 5, CR3-350). See `src/config/spriteFx.js` for what and why.
//
//   node scripts/spriteFx.mjs          generate (only what changed)
//   node scripts/spriteFx.mjs --force  regenerate everything
//
// Normally you never run it by hand: `spriteFxPlugin()` (in vite.config.js)
// runs it when `npm run dev` starts, before `npm run build`, and again for any
// sprite added or changed while the dev server is up.
//
// Output, all under the git-ignored `public/_gen/sprite-fx/`:
//   sil/<assets path>                black where the art is, clear elsewhere
//   ol-<colour>/<path>               the 1-art-pixel ring a plus-shaped
//                                    (4-connected) dilation adds around the
//                                    art, in that colour (padded by 1 on
//                                    every side — except a sprite sheet,
//                                    grown inside each frame cell and not
//                                    padded, so it is drawn with the sheet's
//                                    own frame maths)
//   manifest.json                    what exists, and each source's hash
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import sharp from 'sharp';
import {
    SPRITE_FX_DIR, SPRITE_FX_VERSION, OUTLINE_COLOURS,
    sheetGridOf, isOutlined, SKIPPED_DIRS, MAX_SILHOUETTE_PX, MAX_OUTLINE_PX,
    silhouetteFolder, outlineFolder
} from '../src/config/spriteFx.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');

// ---------------------------------------------------------------------------
// The pixel maths (pure — `SpriteFxGenerator.test.js` pins it)
// ---------------------------------------------------------------------------

/** 1 where the art has any alpha, 0 elsewhere. `rgba` is w×h×4 bytes. */
export function alphaMask(rgba, w, h) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
    return mask;
}

/** The silhouette: opaque black wherever the mask is set. w×h×4 bytes. */
export function silhouetteRgba(mask, w, h) {
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) if (mask[i]) out[i * 4 + 3] = 255;
    return out;
}

/** The four edge neighbours: an outline pixel touches the art edge to edge. */
const CARDINAL = [[0, -1], [-1, 0], [1, 0], [0, 1]];

/**
 * The outline mask: every clear pixel that touches the art **edge to edge**
 * (up, down, left or right — a plus-shaped, 4-connected dilation), on the
 * art's own pixel grid. A pixel that only touches the art corner to corner is
 * never part of it (owner ruling, 2026-10-01: no "doubles").
 *
 * The art's own 1-px black border counts as art: the ring grows from the full
 * alpha mask, so it sits outside that border.
 *
 * A single sprite is padded by one pixel on every side so the ring has room
 * (`(w + 2) × (h + 2)`). A sheet (`grid` given) is not padded and grows only
 * inside each frame cell, so one frame's ring never reaches the next.
 */
export function outlineMask(mask, w, h, { grid = null } = {}) {
    const pad = grid ? 0 : 1;
    const W = w + 2 * pad, H = h + 2 * pad;
    const cellW = grid ? w / grid.cols : 0;
    const cellH = grid ? h / grid.rows : 0;
    const out = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask[y * w + x]) continue;
            for (const [dx, dy] of CARDINAL) {
                const nx = x + dx, ny = y + dy;
                if (grid) {
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    if (Math.floor(nx / cellW) !== Math.floor(x / cellW) || Math.floor(ny / cellH) !== Math.floor(y / cellH)) continue;
                }
                const inside = nx >= 0 && ny >= 0 && nx < w && ny < h;
                if (inside && mask[ny * w + nx]) continue;   // art, not ring
                out[(ny + pad) * W + (nx + pad)] = 1;
            }
        }
    }
    return { mask: out, width: W, height: H };
}

/** A mask filled with one colour, opaque. W×H×4 bytes. */
export function colourRgba(mask, W, H, [cr, cg, cb]) {
    const out = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        if (!mask[i]) continue;
        out[i * 4] = cr; out[i * 4 + 1] = cg; out[i * 4 + 2] = cb; out[i * 4 + 3] = 255;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const toPosix = (p) => p.split(path.sep).join('/');

/** Every sprite PNG under `public/assets`, as `assets/...` paths. */
export function listSprites(root = DEFAULT_ROOT) {
    const publicDir = path.join(root, 'public');
    const out = [];
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (!SKIPPED_DIRS.includes(e.name)) walk(full);
            } else if (/\.png$/i.test(e.name)) {
                out.push(toPosix(path.relative(publicDir, full)));
            }
        }
    };
    walk(path.join(publicDir, 'assets'));
    return out.sort();
}

const writePng = (file, rgba, width, height) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Two colours only (clear + one), so a palette PNG is exact and small.
    return sharp(rgba, { raw: { width, height, channels: 4 } })
        .png({ palette: true, colours: 2, dither: 0, compressionLevel: 9 })
        .toFile(file);
};

/** Every output file one source makes, relative to the output folder. */
function outputsOf(rel, entry) {
    const files = [`${silhouetteFolder()}/${rel}`];
    if (entry?.outlined) {
        for (const colour of Object.keys(OUTLINE_COLOURS)) files.push(`${outlineFolder(colour)}/${rel}`);
    }
    return files;
}

/** Generate one sprite's images. Returns its manifest entry, or null to skip it. */
async function generateOne(root, outDir, rel, hash) {
    const src = path.join(root, 'public', rel);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    if (w > MAX_SILHOUETTE_PX || h > MAX_SILHOUETTE_PX) return null;
    const grid = sheetGridOf(rel);
    if (grid && (w % grid.cols || h % grid.rows)) return null;   // not the sheet we think it is
    const mask = alphaMask(data, w, h);
    const jobs = [writePng(path.join(outDir, silhouetteFolder(), rel), silhouetteRgba(mask, w, h), w, h)];
    const outlined = isOutlined(rel) && w <= MAX_OUTLINE_PX && h <= MAX_OUTLINE_PX;
    if (outlined) {
        const ring = outlineMask(mask, w, h, { grid });
        for (const [colour, rgb] of Object.entries(OUTLINE_COLOURS)) {
            jobs.push(writePng(
                path.join(outDir, outlineFolder(colour), rel),
                colourRgba(ring.mask, ring.width, ring.height, rgb),
                ring.width, ring.height
            ));
        }
    }
    await Promise.all(jobs);
    return { w, h, ...(grid ? { cols: grid.cols, rows: grid.rows } : {}), outlined, hash };
}

const hashOf = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

/** Run `fn` over `items`, `n` at a time. */
async function pool(items, n, fn) {
    let next = 0;
    const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/**
 * Bring `public/_gen/sprite-fx/` up to date with `public/assets/`.
 *
 * Only sprites whose bytes changed (or whose outputs are missing) are redrawn;
 * a sprite that was deleted has its images removed. The manifest records each
 * source's hash, so a restart with nothing new takes about a second.
 *
 * @returns {{ generated: number, kept: number, removed: number, skipped: number, ms: number }}
 */
export async function generateSpriteFx({ root = DEFAULT_ROOT, force = false, log = () => {} } = {}) {
    const t0 = Date.now();
    const outDir = path.join(root, 'public', SPRITE_FX_DIR);
    const manifestFile = path.join(outDir, 'manifest.json');
    let old;
    try { old = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { old = null; }
    const current = !force && old?.version === SPRITE_FX_VERSION;
    const oldSprites = current ? (old.sprites || {}) : {};
    const oldSkipped = current ? (old.skipped || {}) : {};
    if (!force && old && !current) log('sprite-fx: generator changed, redrawing everything');
    // A different generator (or --force) starts from an empty folder, so no
    // images of an older layout are left behind to ship.
    // (Its contents, not the folder: on Windows a running dev server's watcher
    // holds the folder itself open.)
    if (!current && fs.existsSync(outDir)) {
        for (const e of fs.readdirSync(outDir)) {
            try { fs.rmSync(path.join(outDir, e), { recursive: true, force: true }); } catch { /* in use: overwritten below */ }
        }
    }

    const rels = listSprites(root);
    const sprites = {};
    // Sources deliberately left alone (too big to be a mat sprite, or a sheet
    // whose size does not fit its grid), by hash, so they are not re-read.
    const skipped = {};
    const todo = [];
    for (const rel of rels) {
        const hash = hashOf(path.join(root, 'public', rel));
        const prev = oldSprites[rel];
        const outlineRuleSame = prev && prev.outlined === (isOutlined(rel) && prev.w <= MAX_OUTLINE_PX && prev.h <= MAX_OUTLINE_PX);
        if (prev && prev.hash === hash && outlineRuleSame && outputsOf(rel, prev).every(f => fs.existsSync(path.join(outDir, f)))) {
            sprites[rel] = prev;
        } else if (oldSkipped[rel] === hash) {
            skipped[rel] = hash;
        } else {
            todo.push({ rel, hash });
        }
    }
    if (todo.length) log(`sprite-fx: drawing shadows and outlines for ${todo.length} sprite(s)…`);
    await pool(todo, 8, async ({ rel, hash }) => {
        try {
            const entry = await generateOne(root, outDir, rel, hash);
            if (entry) sprites[rel] = entry;
            else skipped[rel] = hash;
        } catch (e) {
            log(`sprite-fx: could not read ${rel} (${e.message}) — it will draw without a shadow or outline`);
        }
    });

    // Sources that are gone take their images with them.
    let removed = 0;
    for (const rel of Object.keys(oldSprites)) {
        if (sprites[rel]) continue;
        for (const f of outputsOf(rel, oldSprites[rel])) {
            try { fs.rmSync(path.join(outDir, f)); removed++; } catch { /* already gone */ }
        }
    }

    // Sorted keys, so the file only changes when the content does.
    const ordered = Object.fromEntries(Object.keys(sprites).sort().map(k => [k, sprites[k]]));
    fs.mkdirSync(outDir, { recursive: true });
    const skippedOrdered = Object.fromEntries(Object.keys(skipped).sort().map(k => [k, skipped[k]]));
    fs.writeFileSync(manifestFile, JSON.stringify({ version: SPRITE_FX_VERSION, sprites: ordered, skipped: skippedOrdered }));
    const result = {
        generated: todo.length,
        kept: rels.length - todo.length - Object.keys(oldSkipped).filter(r => skipped[r] === oldSkipped[r]).length,
        removed,
        skipped: Object.keys(skipped).length,
        ms: Date.now() - t0
    };
    if (todo.length || removed) log(`sprite-fx: done in ${(result.ms / 1000).toFixed(1)} s (${todo.length} drawn, ${result.kept} unchanged, ${removed} old file(s) removed)`);
    return result;
}

// ---------------------------------------------------------------------------
// The Vite plugin
// ---------------------------------------------------------------------------

/**
 * Keeps the generated images current, so new art gets its shadow and outlines
 * with no step to remember:
 *
 * - **`npm run build`** — generated before the bundle (`buildStart`), so Vite
 *   copies them from `public/` into `dist/` with everything else.
 * - **`npm run dev`** — generated in the background as the server starts (the
 *   game draws without them for those few seconds, never broken), then a file
 *   watcher on `public/assets` redraws any sprite added or changed and tells
 *   the page to re-read the manifest (`sprite-fx:update`).
 */
export function spriteFxPlugin({ root = DEFAULT_ROOT } = {}) {
    let command = 'serve';
    const log = (m) => console.log(m);
    return {
        name: 'sprite-fx',
        configResolved(config) { command = config.command; },
        async buildStart() {
            if (command !== 'build') return;
            await generateSpriteFx({ root, log });
        },
        configureServer(server) {
            const assetsDir = toPosix(path.join(root, 'public', 'assets'));
            let running = null;
            let again = false;
            const run = () => {
                if (running) { again = true; return running; }
                running = generateSpriteFx({ root, log })
                    .then((r) => {
                        if (r.generated || r.removed) server.ws.send({ type: 'custom', event: 'sprite-fx:update' });
                    })
                    .catch(e => log(`sprite-fx: failed (${e.message}) — sprites draw without shadows or outlines`))
                    .finally(() => {
                        running = null;
                        if (again) { again = false; run(); }
                    });
                return running;
            };
            let timer = null;
            const onFile = (file) => {
                const f = toPosix(file);
                if (!f.startsWith(assetsDir) || !/\.png$/i.test(f)) return;
                clearTimeout(timer);
                timer = setTimeout(run, 250);
            };
            server.watcher.on('add', onFile);
            server.watcher.on('change', onFile);
            server.watcher.on('unlink', onFile);
            run();
        }
    };
}

// Run directly: `node scripts/spriteFx.mjs [--force]`.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const r = await generateSpriteFx({ force: process.argv.includes('--force'), log: (m) => console.log(m) });
    console.log(JSON.stringify(r));
}
