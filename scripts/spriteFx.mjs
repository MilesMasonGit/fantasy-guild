// Fantasy Guild — generates the sprites' hard shadows and coloured outlines
// (Wave 5, CR3-350). See `src/config/spriteFx.js` for what and why.
//
//   node scripts/spriteFx.mjs                 generate (only what changed)
//   node scripts/spriteFx.mjs --force         regenerate everything
//   node scripts/spriteFx.mjs --root <dir>    for another checkout
//
// Normally you never run it by hand: `spriteFxPlugin()` (in vite.config.js)
// runs it when `npm run dev` starts (as a child process), before
// `npm run build`, and again for any sprite added or changed while the dev
// server is up.
//
// Output, all under the git-ignored `public/_gen/sprite-fx/`:
//   sil/<assets path>                black where the art is, clear elsewhere
//   ol-<colour>/<path>               the 1-art-pixel ring a plus-shaped
//                                    (4-connected) dilation adds around the
//                                    art, in that colour (padded by 1 on
//                                    every side; a sprite sheet pads every
//                                    frame cell by 1, so art touching a
//                                    frame's edge keeps its ring)
//   manifest.json                    what exists, and each source's hash
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fork } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import sharp from 'sharp';
import {
    SPRITE_FX_DIR, SPRITE_FX_VERSION, OUTLINE_COLOURS,
    sheetGridOf, isOutlined, SKIPPED_DIRS, MAX_SILHOUETTE_PX, MAX_OUTLINE_PX,
    silhouetteFolder, outlineFolder
} from '../src/config/spriteFx.js';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');

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
 * (`(w + 2) × (h + 2)`). A sheet (`grid` given) pads every frame cell the same
 * way, each cell becoming `(cellW + 2) × (cellH + 2)` in the same grid: art
 * at a frame's edge (a bow's tip, a foot) keeps its ring, and one frame's
 * ring never reaches the next.
 */
export function outlineMask(mask, w, h, { grid = null } = {}) {
    const cols = grid ? grid.cols : 1, rows = grid ? grid.rows : 1;
    const cellW = w / cols, cellH = h / rows;
    const PW = cellW + 2, PH = cellH + 2;
    const W = cols * PW, H = rows * PH;
    const out = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask[y * w + x]) continue;
            const cx = Math.floor(x / cellW), cy = Math.floor(y / cellH);
            const lx = x - cx * cellW, ly = y - cy * cellH;
            for (const [dx, dy] of CARDINAL) {
                const nx = lx + dx, ny = ly + dy;
                const inCell = nx >= 0 && ny >= 0 && nx < cellW && ny < cellH;
                if (inCell && mask[(cy * cellH + ny) * w + cx * cellW + nx]) continue;   // art, not ring
                out[(cy * PH + ny + 1) * W + cx * PW + nx + 1] = 1;
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
    // `ringPad`: a sheet's outline cells are padded by this many pixels a side (`outlineMask`).
    return { w, h, ...(grid ? { cols: grid.cols, rows: grid.rows, ...(outlined ? { ringPad: 1 } : {}) } : {}), outlined, hash };
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
// The dev server's redraw, in its own process
// ---------------------------------------------------------------------------

/**
 * Run the generator as a child Node process. `done` resolves with its result
 * (plus the child's `pid`), or rejects if it crashed, failed or was killed;
 * `kill()` stops it.
 *
 * ⚠️ The dev server never draws in its own process. There, sharp's work
 * queues behind the file watcher's on Node's four shared worker threads (a
 * full redraw crawled for minutes on the main checkout), and a native fault
 * in the image library would end the whole server. In a child, the worst
 * case is one lost redraw.
 *
 * @returns {{ done: Promise<object>, kill: () => void }}
 */
export function runSpriteFxInChild({ root = DEFAULT_ROOT, force = false, script = SCRIPT_FILE } = {}) {
    const args = ['--root', root, ...(force ? ['--force'] : [])];
    const child = fork(script, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let reply = null;
    child.on('message', (m) => { if (m?.type === 'sprite-fx:result') reply = m; });
    // `close` comes after both the exit and the message channel's end, so the reply is in by then.
    const done = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => {
            if (code === 0 && reply) resolve({ ...reply.result, pid: reply.pid });
            else reject(new Error(signal ? `generator stopped (${signal})` : `generator exited with code ${code}`));
        });
    });
    const kill = () => { if (child.exitCode === null && child.signalCode === null) child.kill(); };
    return { done, kill };
}

// ---------------------------------------------------------------------------
// The Vite plugin
// ---------------------------------------------------------------------------

/** `file` is `dir` or inside it (both absolute). Windows paths compare without case. */
function isUnder(file, dir) {
    const norm = (p) => {
        const s = toPosix(path.resolve(p));
        return process.platform === 'win32' ? s.toLowerCase() : s;
    };
    const f = norm(file), d = norm(dir).replace(/\/$/, '');
    return f === d || f.startsWith(d + '/');
}

const SERVED_TYPES = Object.freeze({ '.png': 'image/png', '.json': 'application/json' });

/**
 * The dev server's route to the generated folder, read from disk at every
 * request.
 *
 * ⚠️ Vite serves a file under `public/` only if it was there when the server
 * started or its file watcher has reported it since, and a watcher still
 * making its first scan reports nothing it finds. A redraw writes as the
 * server starts, so through Vite alone those pictures are answered with the
 * game's own page, and no outline or shadow draws until a restart.
 */
export function serveSpriteFx(outDir) {
    const prefix = `/${SPRITE_FX_DIR}/`;
    return function spriteFxFiles(req, res, next) {
        const pathname = (req.url || '').split(/[?#]/)[0];
        if (!pathname.startsWith(prefix) || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
        const notFound = () => { res.statusCode = 404; res.end(); };
        let file;
        try { file = path.resolve(outDir, decodeURIComponent(pathname.slice(prefix.length))); } catch { return notFound(); }
        const type = SERVED_TYPES[path.extname(file).toLowerCase()];
        if (!type || !isUnder(file, outDir)) return notFound();
        fs.stat(file, (err, st) => {
            if (err || !st.isFile()) return notFound();
            // The same address gets new pixels when its sprite is redrawn.
            const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('ETag', etag);
            if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return; }
            res.setHeader('Content-Type', type);
            res.setHeader('Content-Length', st.size);
            if (req.method === 'HEAD') { res.end(); return; }
            fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
        });
    };
}

/**
 * Keeps the generated images current, so new art gets its shadow and outlines
 * with no step to remember:
 *
 * - **`npm run build`** — generated before the bundle (`buildStart`), so Vite
 *   copies them from `public/` into `dist/` with everything else.
 * - **`npm run dev`** — generated in a child process as the server starts
 *   (the game draws without them for those few seconds, never broken), then a
 *   file watcher on `public/assets` redraws any sprite added or changed and
 *   tells the page to re-read the manifest (`sprite-fx:update`). The
 *   generator's own files are outside `public/assets`, so they never start
 *   another redraw. Closing or restarting the server stops a redraw in flight.
 *   The server reads the generated folder through `serveSpriteFx`, not
 *   through Vite's `public/` serving.
 *
 * `runGenerator` is how the dev server runs it (`runSpriteFxInChild`); tests
 * pass a stand-in.
 */
export function spriteFxPlugin({ root = DEFAULT_ROOT, runGenerator = runSpriteFxInChild } = {}) {
    let command = 'serve';
    const log = (m) => console.log(m);
    let stop = () => {};
    return {
        name: 'sprite-fx',
        configResolved(config) { command = config.command; },
        async buildStart() {
            if (command !== 'build') return;
            await generateSpriteFx({ root, log });
        },
        configureServer(server) {
            server.middlewares.use(serveSpriteFx(path.join(root, 'public', SPRITE_FX_DIR)));
            const assetsDir = path.join(root, 'public', 'assets');
            let job = null;
            let again = false;
            let closed = false;
            const run = () => {
                if (closed) return;
                if (job) { again = true; return; }
                job = runGenerator({ root });
                job.done
                    .then((r) => {
                        if (!closed && (r.generated || r.removed)) server.ws.send({ type: 'custom', event: 'sprite-fx:update' });
                    })
                    .catch((e) => {
                        if (!closed) log(`sprite-fx: failed (${e.message}) — sprites draw without shadows or outlines`);
                    })
                    .finally(() => {
                        job = null;
                        if (again && !closed) { again = false; run(); }
                    });
            };
            let timer = null;
            const onFile = (file) => {
                if (!/\.png$/i.test(file) || !isUnder(file, assetsDir)) return;
                clearTimeout(timer);
                timer = setTimeout(run, 250);
            };
            server.watcher.on('add', onFile);
            server.watcher.on('change', onFile);
            server.watcher.on('unlink', onFile);
            stop = () => {
                closed = true;
                clearTimeout(timer);
                job?.kill();
            };
            run();
        },
        // Vite calls this as the dev server closes, including the close before a restart.
        closeBundle() { stop(); }
    };
}

// Run directly: `node scripts/spriteFx.mjs [--force] [--root <dir>]`. As the
// dev server's child, it hands the result back over the message channel.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const at = process.argv.indexOf('--root');
    const root = at > 0 && process.argv[at + 1] ? path.resolve(process.argv[at + 1]) : DEFAULT_ROOT;
    const r = await generateSpriteFx({ root, force: process.argv.includes('--force'), log: (m) => console.log(m) });
    if (process.send) {
        process.send({ type: 'sprite-fx:result', result: r, pid: process.pid }, () => {
            if (process.connected) process.disconnect();
        });
    } else {
        console.log(JSON.stringify(r));
    }
}
