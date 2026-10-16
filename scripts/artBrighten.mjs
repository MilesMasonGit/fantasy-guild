// Fantasy Guild — the brightness script for the art's vibrancy pass.
//
//   npm run art:brighten                                   all four presets (previews)
//   npm run art:brighten -- --preset drag                  one preset
//   npm run art:brighten -- --all-presets --outline 30     all four, a different outline threshold
//   npm run art:brighten -- --brightness 1.15 --saturation 1.25 --outline 40
//   npm run art:brighten -- --preset gentle --only tokens/nature/tree,items/wood
//   npm run art:brighten -- --preset drag --bake --backup D:/backups/assets_2026-10-17.zip
//
// Preview mode (the default) writes to the git-ignored bench folder
// `public/_gen/art-bench/<preset>/<path under public/assets>` plus
// `public/_gen/art-bench/presets.json` (each folder's settings, for the bench
// page), and never writes under public/assets.
//
// Bake mode (--bake) rewrites the covered art in place and is refused unless
// every covered file is committed, the git tag `art-before-vibrancy` exists,
// and --backup names a zip outside the project with today's date in its name.
//
// The transform is the browser's own `filter: brightness(b) saturate(s)` (what
// the drag look in DndKit.jsx uses), per pixel in sRGB: brightness multiplies
// each channel; saturate is the W3C luminance-preserving colour matrix, so it
// strengthens colour without shifting how light a pixel reads. Pixels whose
// brightest channel is at or below the outline threshold, and fully clear
// pixels, are left byte-for-byte as drawn. No resampling: same size, same
// pixels, only colours change.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import sharp from 'sharp';
import { DEFAULT_OUTLINE, makeColorBrightener } from '../cms/artBrightenColor.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');

/** Relative to `public/`. Git-ignored by the `public/_gen/` rule. */
export const BENCH_DIR = '_gen/art-bench';

export const PRESETS = {
    unchanged: { brightness: 1, saturation: 1 },
    gentle: { brightness: 1.08, saturation: 1.12 },
    drag: { brightness: 1.15, saturation: 1.25 },
    bold: { brightness: 1.22, saturation: 1.4 }
};

/** A pixel whose brightest channel is at or below this (0–255) stays exactly as drawn. */
export { DEFAULT_OUTLINE };

export const BACKUP_TAG = 'art-before-vibrancy';

// Tokens, items (the gear is items/gear/), heroes and enemies, and any loose PNG
// dropped at the top of public/assets before it is filed. Not ui/, skills/ (UI
// icons), backgrounds/ (the 256 px card and banner art), playmat/ (the ground
// has its own pass) or audio/.
const COVERED_FOLDERS = new Set(['tokens', 'items', 'heroes', 'enemies']);

/** Is this PNG (path relative to public/assets, either slash) part of the pass? */
export function isCovered(rel) {
    const parts = rel.replace(/\\/g, '/').split('/');
    if (!/\.png$/i.test(parts[parts.length - 1])) return false;
    // `waste/` folders are git-ignored discards.
    if (parts.includes('waste')) return false;
    return parts.length === 1 || COVERED_FOLDERS.has(parts[0]);
}

/** Every covered PNG under `<root>/public/assets`, relative to it, with forward slashes, sorted. */
export function listCovered(root = DEFAULT_ROOT) {
    const base = path.join(root, 'public', 'assets');
    const out = [];
    const walk = (dir, rel) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) {
                if (!rel && !COVERED_FOLDERS.has(e.name)) continue;
                walk(path.join(dir, e.name), r);
            } else if (isCovered(r)) out.push(r);
        }
    };
    walk(base, '');
    return out.sort();
}

// ---------------------------------------------------------------------------
// The pixel maths (pure)
// ---------------------------------------------------------------------------

/**
 * The transformed copy of an RGBA buffer. Clear pixels (alpha 0) and pixels
 * whose brightest channel is at or below `outline` are copied unchanged. The
 * colour maths is `makeColorBrightener`, shared with the Studio's palettes.
 */
export function brightenRgba(rgba, { brightness = 1, saturation = 1, outline = DEFAULT_OUTLINE } = {}) {
    const out = Buffer.from(rgba);
    const f = makeColorBrightener({ brightness, saturation, outline });
    if (!f) return out;
    for (let i = 0; i < out.length; i += 4) {
        if (out[i + 3] === 0) continue;
        const [r, g, b] = f(out[i], out[i + 1], out[i + 2]);
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

const toPosix = (p) => p.replace(/\\/g, '/');

/** Throws if `file` is inside `<root>/public/assets` (preview mode must never write there). */
export function assertNotUnderAssets(file, root = DEFAULT_ROOT) {
    const assets = path.resolve(root, 'public', 'assets');
    const rel = path.relative(assets, path.resolve(file));
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        throw new Error(`refusing to write a preview under public/assets: ${toPosix(file)}`);
    }
}

/**
 * The transformed PNG for one source, or null when nothing changes (no pixel
 * above the threshold, or the unchanged preset). Throws for a source it
 * cannot transform exactly.
 */
async function transformFile(src, settings) {
    const meta = await sharp(src).metadata();
    if (meta.depth && meta.depth !== 'uchar') throw new Error(`${meta.depth} colour depth (only 8-bit art is handled)`);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = brightenRgba(data, settings);
    if (out.equals(data)) return null;
    return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/** Run `fn` over `items`, `n` at a time. */
async function pool(items, n, fn) {
    let next = 0;
    const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

const settingsOf = (name, outline) => ({ ...PRESETS[name], outline });
export const customFolder = ({ brightness, saturation, outline }) => `custom_b${brightness}_s${saturation}_o${outline}`;

const matchesOnly = (rel, only) => !only || only.some(p => rel === p || rel.startsWith(p.replace(/\/$/, '') + '/'));

/**
 * Preview mode: writes each preset (or one custom setting) to the bench
 * folder. Never writes under public/assets.
 *
 * @param {object} o
 * @param {string[]} [o.presets]  preset names
 * @param {{brightness:number, saturation:number, outline?:number}} [o.settings]  a custom setting instead
 * @param {number} [o.outline]  the threshold for the presets
 * @param {string[]} [o.only]  path prefixes under public/assets to limit the run to
 */
export async function writePreviews({ root = DEFAULT_ROOT, presets = [], settings = null, outline = DEFAULT_OUTLINE, only = null, log = () => {} } = {}) {
    const t0 = Date.now();
    const jobs = settings
        ? [{ folder: customFolder({ outline, ...settings }), settings: { outline, ...settings } }]
        : presets.map(name => {
            if (!PRESETS[name]) throw new Error(`unknown preset "${name}" (presets: ${Object.keys(PRESETS).join(', ')})`);
            return { folder: name, settings: settingsOf(name, outline) };
        });
    const rels = listCovered(root).filter(r => matchesOnly(r, only));
    const bench = path.join(root, 'public', BENCH_DIR);
    const skipped = [];
    for (const job of jobs) {
        const dir = path.join(bench, job.folder);
        assertNotUnderAssets(dir, root);
        // A full run starts the folder clean so deleted art leaves no preview behind.
        if (!only) {
            for (const e of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
                fs.rmSync(path.join(dir, e), { recursive: true, force: true });
            }
        }
        await pool(rels, 8, async (rel) => {
            const src = path.join(root, 'public', 'assets', rel);
            const dest = path.join(dir, rel);
            assertNotUnderAssets(dest, root);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            try {
                const png = await transformFile(src, job.settings);
                if (png) fs.writeFileSync(dest, png);
                else fs.copyFileSync(src, dest);
            } catch (e) {
                skipped.push(`${rel}: ${e.message}`);
            }
        });
        log(`art-bench: ${job.folder} (brightness ${job.settings.brightness}, saturation ${job.settings.saturation}, outline ${job.settings.outline}): ${rels.length} file(s)`);
    }

    // The bench (scripts/artBench.mjs) reads this for each preview folder's settings.
    const listFile = path.join(bench, 'presets.json');
    let list;
    try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { list = null; }
    if (!Array.isArray(list)) list = [];
    // The page shows exactly this list, so the four presets are always in it
    // (a preset without a folder yet falls back to the page's live filter).
    for (const [id, p] of Object.entries(PRESETS)) {
        if (!list.some(e => e && e.id === id)) {
            list.push({ id, label: id[0].toUpperCase() + id.slice(1), brightness: p.brightness, saturation: p.saturation, threshold: DEFAULT_OUTLINE });
        }
    }
    for (const job of jobs) {
        const entry = {
            id: job.folder,
            label: PRESETS[job.folder] ? job.folder[0].toUpperCase() + job.folder.slice(1)
                : `Custom ${job.settings.brightness} / ${job.settings.saturation}`,
            brightness: job.settings.brightness,
            saturation: job.settings.saturation,
            threshold: job.settings.outline
        };
        const at = list.findIndex(p => p && p.id === entry.id);
        if (at >= 0) list[at] = entry; else list.push(entry);
    }
    const order = Object.keys(PRESETS);
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
    list.sort((a, b) => rank(a.id) - rank(b.id) || String(a.id).localeCompare(String(b.id)));
    fs.mkdirSync(bench, { recursive: true });
    fs.writeFileSync(listFile, JSON.stringify(list, null, 1));

    for (const s of skipped) log(`art-bench: skipped ${s}`);
    return { files: rels.length, folders: jobs.map(j => j.folder), skipped, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// Bake mode
// ---------------------------------------------------------------------------

const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const gitOut = (root, args) => execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

/** Covered files under public/assets that git shows as changed, new or deleted. */
function uncommittedCovered(root) {
    const out = gitOut(root, ['-c', 'core.quotepath=off', 'status', '--porcelain', '--untracked-files=all', '--', 'public/assets']);
    const found = [];
    for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        let p = line.slice(3);
        if (p.includes(' -> ')) p = p.split(' -> ')[1];
        p = p.replace(/^"|"$/g, '');
        if (!p.startsWith('public/assets/')) continue;
        const rel = p.slice('public/assets/'.length);
        if (isCovered(rel)) found.push(rel);
    }
    return found.sort();
}

/**
 * Why a bake would be refused, as plain sentences; empty when it may run.
 * The three conditions: every covered file committed, the backup tag, and a
 * zip of public/assets outside the project dated today.
 */
export function bakeRefusals({ root = DEFAULT_ROOT, backup = null, today = localToday() } = {}) {
    const reasons = [];
    let isRepo = true;
    try { gitOut(root, ['rev-parse', '--git-dir']); } catch { isRepo = false; reasons.push(`${toPosix(root)} is not a git repository`); }

    if (isRepo) {
        try {
            const dirty = uncommittedCovered(root);
            if (dirty.length) {
                reasons.push(`these files are not committed (commit or remove them first):\n  ${dirty.map(r => `public/assets/${r}`).join('\n  ')}`);
            }
        } catch (e) {
            reasons.push(`could not read git status (${e.message.split('\n')[0]})`);
        }
        try { gitOut(root, ['rev-parse', '-q', '--verify', `refs/tags/${BACKUP_TAG}`]); } catch {
            reasons.push(`the git tag ${BACKUP_TAG} does not exist (git tag ${BACKUP_TAG})`);
        }
    }

    if (!backup) {
        reasons.push(`no backup given: pass --backup <zip>, a zip of public/assets outside the project with today's date (${today}) in its name`);
    } else {
        const zip = path.resolve(backup);
        const inProject = !path.relative(path.resolve(root), zip).startsWith('..') && !path.isAbsolute(path.relative(path.resolve(root), zip));
        if (!fs.existsSync(zip) || !fs.statSync(zip).isFile()) {
            reasons.push(`the backup ${toPosix(backup)} does not exist`);
        } else {
            if (inProject) reasons.push(`the backup ${toPosix(backup)} must be outside the project`);
            if (!path.basename(zip).includes(today)) reasons.push(`the backup's name must carry today's date (${today}): ${path.basename(zip)}`);
            const head = Buffer.alloc(4);
            const fd = fs.openSync(zip, 'r');
            try { fs.readSync(fd, head, 0, 4, 0); } finally { fs.closeSync(fd); }
            if (head[0] !== 0x50 || head[1] !== 0x4b) reasons.push(`the backup ${path.basename(zip)} is not a zip file`);
        }
    }
    return reasons;
}

/**
 * Bake mode: rewrites the covered art in place with one setting. Refused
 * (throws, writing nothing) unless `bakeRefusals` is empty.
 */
export async function bake({ root = DEFAULT_ROOT, settings, backup = null, today = localToday(), only = null, log = () => {} } = {}) {
    const t0 = Date.now();
    const reasons = bakeRefusals({ root, backup, today });
    if (reasons.length) throw new Error(`bake refused:\n- ${reasons.join('\n- ')}`);
    const s = { outline: DEFAULT_OUTLINE, ...settings };
    const rels = listCovered(root).filter(r => matchesOnly(r, only));
    // Transform everything first, so a file that cannot be read stops the bake before anything is written.
    const results = new Map();
    const failed = [];
    await pool(rels, 8, async (rel) => {
        try { results.set(rel, await transformFile(path.join(root, 'public', 'assets', rel), s)); } catch (e) { failed.push(`${rel}: ${e.message}`); }
    });
    if (failed.length) throw new Error(`bake stopped before writing anything; could not transform:\n  ${failed.join('\n  ')}`);
    let changed = 0;
    for (const [rel, png] of results) {
        if (!png) continue;
        fs.writeFileSync(path.join(root, 'public', 'assets', rel), png);
        changed++;
    }
    log(`art-bake: brightness ${s.brightness}, saturation ${s.saturation}, outline ${s.outline}: ${changed} file(s) rewritten, ${rels.length - changed} unchanged`);
    return { changed, unchanged: rels.length - changed, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
    const o = { presets: [], allPresets: false, brightness: null, saturation: null, outline: null, only: null, bake: false, backup: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const val = () => {
            const v = argv[++i];
            if (v === undefined) throw new Error(`${a} needs a value`);
            return v;
        };
        const num = () => {
            const v = Number(val());
            if (!Number.isFinite(v) || v < 0) throw new Error(`${a} needs a number`);
            return v;
        };
        if (a === '--preset') o.presets.push(...val().split(',').filter(Boolean));
        else if (a === '--all-presets') o.allPresets = true;
        else if (a === '--brightness') o.brightness = num();
        else if (a === '--saturation') o.saturation = num();
        else if (a === '--outline') o.outline = num();
        else if (a === '--only') o.only = val().split(',').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);
        else if (a === '--bake') o.bake = true;
        else if (a === '--backup') o.backup = val();
        else throw new Error(`unknown option ${a}`);
    }
    return o;
}

async function main(argv) {
    const o = parseArgs(argv);
    const outline = o.outline ?? DEFAULT_OUTLINE;
    const custom = o.brightness !== null || o.saturation !== null;
    if (custom && (o.presets.length || o.allPresets)) throw new Error('give either a --preset or --brightness/--saturation, not both');
    const log = (m) => console.log(m);

    if (o.bake) {
        if (o.allPresets || o.presets.length > 1) throw new Error('--bake takes one setting: one --preset, or --brightness and --saturation');
        if (!custom && !o.presets.length) throw new Error('--bake needs a --preset, or --brightness and --saturation');
        const settings = custom
            ? { brightness: o.brightness ?? 1, saturation: o.saturation ?? 1, outline }
            : (() => {
                if (!PRESETS[o.presets[0]]) throw new Error(`unknown preset "${o.presets[0]}"`);
                return settingsOf(o.presets[0], outline);
            })();
        const r = await bake({ settings, backup: o.backup, only: o.only, log });
        console.log(`done in ${(r.ms / 1000).toFixed(1)} s. Check the art, then commit public/assets as art only.`);
        return;
    }

    const r = custom
        ? await writePreviews({ settings: { brightness: o.brightness ?? 1, saturation: o.saturation ?? 1, outline }, outline, only: o.only, log })
        : await writePreviews({ presets: o.allPresets || !o.presets.length ? Object.keys(PRESETS) : o.presets, outline, only: o.only, log });
    console.log(`previews in public/${BENCH_DIR}/ (${r.folders.join(', ')}), ${r.files} file(s) each, ${(r.ms / 1000).toFixed(1)} s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
