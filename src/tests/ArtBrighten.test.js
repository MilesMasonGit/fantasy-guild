// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import {
    PRESETS, DEFAULT_OUTLINE, brightenRgba, isCovered, listCovered,
    writePreviews, bake, bakeRefusals, assertNotUnderAssets, BENCH_DIR
} from '../../scripts/artBrighten.mjs';

/**
 * The brightness script (`npm run art:brighten`): previews go to the bench's
 * scratch folder and never over the art; the bake is refused without the
 * owner's three backups.
 */

const px = (r, g, b, a = 255) => Buffer.from([r, g, b, a]);

describe('brightenRgba: the per-pixel transform', () => {
    const drag = { ...PRESETS.drag, outline: 40 };

    it('leaves pixels at or below the outline threshold byte-identical', () => {
        for (const p of [px(0, 0, 0), px(40, 40, 40), px(40, 10, 0), px(12, 30, 25, 200)]) {
            expect([...brightenRgba(p, drag)]).toEqual([...p]);
        }
    });

    it('transforms pixels just above the threshold and lighter ones', () => {
        for (const p of [px(41, 30, 20), px(120, 100, 80), px(200, 60, 40)]) {
            const out = brightenRgba(p, drag);
            expect([...out]).not.toEqual([...p]);
            expect(out[3]).toBe(p[3]);
        }
        // Brighter, and more saturated: the spread between channels grows.
        const out = brightenRgba(px(120, 100, 80), drag);
        expect(out[0] + out[1] + out[2]).toBeGreaterThan(300);
        expect(out[0] - out[2]).toBeGreaterThan(40);
    });

    it('keeps transparent pixels exactly as they were, colour bytes included', () => {
        const p = px(200, 100, 50, 0);
        expect([...brightenRgba(p, { ...PRESETS.bold, outline: 0 })]).toEqual([...p]);
    });

    it('keeps a semi-transparent pixel’s alpha', () => {
        expect(brightenRgba(px(120, 100, 80, 128), drag)[3]).toBe(128);
    });

    it('unchanged (1 / 1) is the identity on every pixel', () => {
        const all = Buffer.alloc(256 * 4);
        for (let i = 0; i < 256; i++) all.set([i, 255 - i, (i * 7) % 256, 255], i * 4);
        expect(brightenRgba(all, { ...PRESETS.unchanged, outline: 0 }).equals(all)).toBe(true);
    });

    it('every preset has outline protection on by default', () => {
        expect(Object.keys(PRESETS)).toEqual(['unchanged', 'gentle', 'drag', 'bold']);
        expect(DEFAULT_OUTLINE).toBeGreaterThan(0);
        expect(PRESETS.gentle).toEqual({ brightness: 1.08, saturation: 1.12 });
        expect(PRESETS.drag).toEqual({ brightness: 1.15, saturation: 1.25 });
        expect(PRESETS.bold).toEqual({ brightness: 1.22, saturation: 1.4 });
    });
});

describe('what the script covers', () => {
    it('Tokens, items, heroes, enemies and the loose gear at the top; not UI, icons, skills, backgrounds, the mat or waste', () => {
        for (const rel of ['tokens/nature/tree/token_sap_oak.png', 'items/ore/ore_copper.png', 'heroes/hm_cook.png',
            'heroes/animations/ani_fighter_0.png', 'enemies/slime/anim/ani_slime_green_big.png', 'g_body_mage.png']) {
            expect(isCovered(rel)).toBe(true);
        }
        for (const rel of ['ui/ui_add_green.png', 'icon/icon.png', 'skills/skill_crime.png', 'backgrounds/cards/bg_mine.png',
            'playmat/props/prop_rock.png', 'enemies/slime/waste/x.png', 'maybe/item.png', 'archive/ore.png',
            'audio/sfx/x.png', 'tokens/readme.txt']) {
            expect(isCovered(rel)).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// Scratch trees
// ---------------------------------------------------------------------------

let root;
const assets = (rel) => path.join(root, 'public', 'assets', rel);

async function writeArt(rel, w, h, colour = [120, 100, 80]) {
    const buf = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        // A black outline ring around a coloured fill, clear in one corner.
        const x = i % w, y = Math.floor(i / w);
        if (x === 0 && y === 0) continue;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        buf.set(edge ? [10, 10, 10, 255] : [...colour, 255], i * 4);
    }
    fs.mkdirSync(path.dirname(assets(rel)), { recursive: true });
    await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(assets(rel));
}

const read = async (file) => {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
};

/** Every file under a folder with its hash and modification time. */
function snapshot(dir) {
    const out = {};
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out[path.relative(dir, p)] = [crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'), fs.statSync(p).mtimeMs];
        }
    };
    walk(dir);
    return out;
}

async function scratchTree() {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-brighten-'));
    await writeArt('tokens/nature/tree/token_oak.png', 6, 5);
    await writeArt('items/ore/ore_copper.png', 4, 4, [180, 90, 50]);
    await writeArt('heroes/hm_cook.png', 4, 6);
    await writeArt('enemies/slime/slime.png', 5, 5, [60, 160, 70]);
    await writeArt('g_cape.png', 3, 3);
    await writeArt('ui/ui_coin.png', 3, 3);
    await writeArt('backgrounds/cards/bg_mine.png', 8, 8);
    await writeArt('enemies/slime/waste/old.png', 3, 3);
}

const COVERED = ['enemies/slime/slime.png', 'g_cape.png', 'heroes/hm_cook.png', 'items/ore/ore_copper.png', 'tokens/nature/tree/token_oak.png'];

describe('preview mode', () => {
    beforeEach(scratchTree);
    afterEach(() => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* temp */ } });

    it('lists only the covered art', () => {
        expect(listCovered(root)).toEqual(COVERED);
    });

    it('writes every preset to the bench folder and never touches public/assets', async () => {
        const before = snapshot(path.join(root, 'public', 'assets'));
        const r = await writePreviews({ root, presets: Object.keys(PRESETS) });
        expect(r.files).toBe(COVERED.length);
        expect(snapshot(path.join(root, 'public', 'assets'))).toEqual(before);
        const bench = path.join(root, 'public', BENCH_DIR);
        for (const preset of Object.keys(PRESETS)) {
            for (const rel of COVERED) expect(fs.existsSync(path.join(bench, preset, rel))).toBe(true);
            expect(fs.existsSync(path.join(bench, preset, 'ui/ui_coin.png'))).toBe(false);
            expect(fs.existsSync(path.join(bench, preset, 'backgrounds/cards/bg_mine.png'))).toBe(false);
        }
        // The shape the bench page reads (scripts/artBench.mjs).
        const list = JSON.parse(fs.readFileSync(path.join(bench, 'presets.json'), 'utf8'));
        expect(list.map(p => p.id)).toEqual(['unchanged', 'gentle', 'drag', 'bold']);
        expect(list[2]).toEqual({ id: 'drag', label: 'Drag', brightness: 1.15, saturation: 1.25, threshold: DEFAULT_OUTLINE });
    });

    it('unchanged writes byte-identical files', async () => {
        await writePreviews({ root, presets: ['unchanged'] });
        for (const rel of COVERED) {
            const out = path.join(root, 'public', BENCH_DIR, 'unchanged', rel);
            expect(fs.readFileSync(out).equals(fs.readFileSync(assets(rel)))).toBe(true);
        }
    });

    it('keeps the size, the transparent corner and the dark outline; brightens the fill', async () => {
        await writePreviews({ root, presets: ['bold'] });
        const src = await read(assets('tokens/nature/tree/token_oak.png'));
        const out = await read(path.join(root, 'public', BENCH_DIR, 'bold', 'tokens/nature/tree/token_oak.png'));
        expect([out.w, out.h]).toEqual([src.w, src.h]);
        expect(out.data[3]).toBe(0);
        // (1, 0) is outline, (2, 2) is fill.
        const at = (img, x, y) => [...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)];
        expect(at(out, 1, 0)).toEqual(at(src, 1, 0));
        expect(at(out, 2, 2)).not.toEqual(at(src, 2, 2));
    });

    it('a custom setting gets its own folder named after its numbers', async () => {
        const r = await writePreviews({ root, settings: { brightness: 1.1, saturation: 1.3, outline: 30 } });
        expect(r.folders).toEqual(['custom_b1.1_s1.3_o30']);
        expect(fs.existsSync(path.join(root, 'public', BENCH_DIR, 'custom_b1.1_s1.3_o30', COVERED[0]))).toBe(true);
        // A later run keeps the earlier entries.
        await writePreviews({ root, presets: ['gentle'] });
        const list = JSON.parse(fs.readFileSync(path.join(root, 'public', BENCH_DIR, 'presets.json'), 'utf8'));
        // The four presets are always listed (the page shows exactly this list).
        expect(list.map(p => p.id)).toEqual(['unchanged', 'gentle', 'drag', 'bold', 'custom_b1.1_s1.3_o30']);
        expect(list[4]).toMatchObject({ brightness: 1.1, saturation: 1.3, threshold: 30 });
    });

    it('refuses to write a preview anywhere under public/assets', () => {
        expect(() => assertNotUnderAssets(assets('tokens/x.png'), root)).toThrow(/public\/assets/);
        expect(() => assertNotUnderAssets(path.join(root, 'public', BENCH_DIR, 'drag', 'tokens/x.png'), root)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Bake mode, on a scratch git repo
// ---------------------------------------------------------------------------

const TODAY = '2026-10-17';
const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' }).toString();

describe('bake mode', () => {
    let outside, zip;

    beforeEach(async () => {
        await scratchTree();
        git('init', '-q');
        git('config', 'user.email', 'test@example.com');
        git('config', 'user.name', 'test');
        fs.writeFileSync(path.join(root, '.gitignore'), 'public/assets/**/waste/\n');
        git('add', '.');
        git('commit', '-q', '-m', 'art');
        git('tag', 'art-before-vibrancy');
        outside = fs.mkdtempSync(path.join(os.tmpdir(), 'art-backup-'));
        zip = path.join(outside, `assets_${TODAY}.zip`);
        fs.writeFileSync(zip, Buffer.from('PK\x03\x04 a zip'));
    });
    afterEach(() => {
        for (const d of [root, outside]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
    });

    const settings = { ...PRESETS.drag, outline: 40 };

    it('with all three backups in place, bakes the covered art and nothing else', async () => {
        expect(bakeRefusals({ root, backup: zip, today: TODAY })).toEqual([]);
        const ui = fs.readFileSync(assets('ui/ui_coin.png'));
        const before = await read(assets('items/ore/ore_copper.png'));
        const r = await bake({ root, settings, backup: zip, today: TODAY });
        expect(r.changed).toBe(COVERED.length);
        const after = await read(assets('items/ore/ore_copper.png'));
        expect(after.data.equals(brightenRgba(before.data, settings))).toBe(true);
        expect(fs.readFileSync(assets('ui/ui_coin.png')).equals(ui)).toBe(true);
    });

    const expectRefused = async (pattern) => {
        const before = snapshot(path.join(root, 'public', 'assets'));
        await expect(bake({ root, settings, backup: zip, today: TODAY })).rejects.toThrow(pattern);
        expect(snapshot(path.join(root, 'public', 'assets'))).toEqual(before);
    };

    it('refuses when a covered file has uncommitted changes', async () => {
        await writeArt('items/ore/ore_copper.png', 4, 4, [10, 200, 10]);
        await expectRefused(/not committed[\s\S]*items\/ore\/ore_copper\.png/);
    });

    it('refuses when a covered file is new and not committed', async () => {
        await writeArt('tokens/new_token.png', 3, 3);
        await expectRefused(/not committed[\s\S]*tokens\/new_token\.png/);
    });

    it('does not mind uncommitted files outside what it bakes', async () => {
        await writeArt('ui/ui_new.png', 3, 3);
        await writeArt('enemies/slime/waste/newer.png', 3, 3);
        expect(bakeRefusals({ root, backup: zip, today: TODAY })).toEqual([]);
    });

    it('refuses without the art-before-vibrancy tag', async () => {
        git('tag', '-d', 'art-before-vibrancy');
        await expectRefused(/art-before-vibrancy/);
    });

    it('refuses without a backup zip', async () => {
        await expect(bake({ root, settings, today: TODAY })).rejects.toThrow(/--backup/);
        fs.rmSync(zip);
        await expectRefused(/does not exist/);
    });

    it('refuses a backup zip that is not dated today', async () => {
        const old = path.join(outside, 'assets_2026-10-16.zip');
        fs.renameSync(zip, old);
        zip = old;
        await expectRefused(/2026-10-17/);
    });

    it('refuses a backup zip inside the project', async () => {
        const inside = path.join(root, `assets_${TODAY}.zip`);
        fs.copyFileSync(zip, inside);
        zip = inside;
        await expectRefused(/outside the project/);
    });

    it('refuses a backup that is not a zip', async () => {
        fs.writeFileSync(zip, 'not a zip');
        await expectRefused(/not a zip/);
    });
});
