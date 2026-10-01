// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
    alphaMask, silhouetteRgba, outlineMask, colourRgba, generateSpriteFx, listSprites
} from '../../scripts/spriteFx.mjs';
import {
    SPRITE_FX_DIR, OUTLINE_COLOURS, OUTLINE_VARIANTS, pickOutlineVariant, shadowScreenPx,
    sheetGridOf, isOutlined, HERO_SHEET_GRID, ENEMY_SHEET_GRID
} from '../config/spriteFx.js';

/**
 * ⭐ Wave 5 (CR3-350, owner rulings Z §11): the hard shadow and the coloured
 * outlines are PICTURES made from the art at build and dev time, never live
 * filters. These pin what the generator draws:
 *
 * - the silhouette is the art's alpha mask, in solid black;
 * - an outline is the 1-pixel ring an 8-direction dilation adds, per colour
 *   (on the art enlarged u× for the thin "1 screen pixel" variants);
 * - a sprite sheet's ring stays inside each frame cell.
 */

/** A w×h RGBA buffer with the given [x, y] pixels opaque (an arbitrary colour). */
function art(w, h, pixels) {
    const buf = Buffer.alloc(w * h * 4);
    for (const [x, y] of pixels) {
        const i = (y * w + x) * 4;
        buf[i] = 120; buf[i + 1] = 60; buf[i + 2] = 30; buf[i + 3] = 255;
    }
    return buf;
}

/** Brute force: the set of output pixels a (u, r) ring should contain. */
function bruteRing(mask, w, h, u, r, grid) {
    const pad = grid ? 0 : r;
    const UW = w * u, UH = h * u, W = UW + 2 * pad, H = UH + 2 * pad;
    const inArt = (x, y) => x >= 0 && y >= 0 && x < UW && y < UH && mask[Math.floor(y / u) * w + Math.floor(x / u)] === 1;
    const cell = (x, y) => grid ? `${Math.floor(x / (UW / grid.cols))},${Math.floor(y / (UH / grid.rows))}` : '0';
    const out = new Set();
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const x = X - pad, y = Y - pad;
        if (inArt(x, y)) continue;
        let hit = false;
        for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r && !hit; dx++) {
            if (inArt(x + dx, y + dy) && (!grid || (x >= 0 && y >= 0 && x < UW && y < UH && cell(x, y) === cell(x + dx, y + dy)))) hit = true;
        }
        if (hit) out.add(Y * W + X);
    }
    return { set: out, W, H };
}

const setOf = (mask) => new Set([...mask.keys()].filter(i => mask[i]));

describe('the silhouette is the art’s alpha mask, in black', () => {
    it('is opaque black exactly where the art has alpha, clear elsewhere', () => {
        const rgba = art(4, 3, [[0, 0], [2, 1], [3, 2]]);
        rgba[(1 * 4 + 1) * 4 + 3] = 7;   // a faint pixel still counts
        const mask = alphaMask(rgba, 4, 3);
        const sil = silhouetteRgba(mask, 4, 3);
        for (let i = 0; i < 12; i++) {
            const expected = mask[i] ? [0, 0, 0, 255] : [0, 0, 0, 0];
            expect([...sil.subarray(i * 4, i * 4 + 4)]).toEqual(expected);
        }
        expect([...mask]).toEqual([1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1]);
    });
});

describe('an outline is the 1-pixel ring a dilation adds', () => {
    it('one art pixel at u1r1: its 8 neighbours, padded by 1', () => {
        const mask = alphaMask(art(1, 1, [[0, 0]]), 1, 1);
        const ring = outlineMask(mask, 1, 1, { u: 1, r: 1 });
        expect(ring.width).toBe(3);
        expect(ring.height).toBe(3);
        expect([...ring.mask]).toEqual([1, 1, 1, 1, 0, 1, 1, 1, 1]);
    });

    it('one art pixel at u2r1 (the "1 screen pixel" image at 2×): a 2×2 block ringed by one pixel', () => {
        const mask = alphaMask(art(1, 1, [[0, 0]]), 1, 1);
        const ring = outlineMask(mask, 1, 1, { u: 2, r: 1 });
        expect([ring.width, ring.height]).toEqual([4, 4]);
        expect([...ring.mask]).toEqual([
            1, 1, 1, 1,
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 1, 1, 1
        ]);
    });

    it('matches a brute-force dilation-minus-art for every variant, on irregular art', () => {
        const pixels = [[1, 1], [2, 1], [5, 2], [3, 4], [3, 5], [0, 6], [6, 6]];
        const mask = alphaMask(art(7, 7, pixels), 7, 7);
        for (const v of OUTLINE_VARIANTS) {
            const ring = outlineMask(mask, 7, 7, v);
            const want = bruteRing(mask, 7, 7, v.u, v.r, null);
            expect([ring.width, ring.height]).toEqual([want.W, want.H]);
            expect(setOf(ring.mask)).toEqual(want.set);
        }
    });

    it('a sprite sheet grows inside each frame cell and is not padded', () => {
        // Two 4-px cells side by side; art touching the shared edge from both sides.
        const pixels = [[3, 1], [4, 2], [0, 0]];
        const mask = alphaMask(art(8, 4, pixels), 8, 4);
        const grid = { cols: 2, rows: 1 };
        for (const v of [{ u: 1, r: 1 }, { u: 2, r: 1 }]) {
            const ring = outlineMask(mask, 8, 4, { ...v, grid });
            expect([ring.width, ring.height]).toEqual([8 * v.u, 4 * v.u]);
            expect(setOf(ring.mask)).toEqual(bruteRing(mask, 8, 4, v.u, v.r, grid).set);
        }
        // At u1r1, the pixel at (3, 1) — the left cell's last column — rings
        // (2, 0) in its own cell but never (4, 0) across the frame edge.
        const r1 = outlineMask(mask, 8, 4, { u: 1, r: 1, grid });
        expect(r1.mask[0 * 8 + 2]).toBe(1);
        expect(r1.mask[0 * 8 + 4]).toBe(0);
    });

    it('is filled with one solid colour per state', () => {
        const ring = outlineMask(alphaMask(art(1, 1, [[0, 0]]), 1, 1), 1, 1, { u: 1, r: 1 });
        for (const [name, rgb] of Object.entries(OUTLINE_COLOURS)) {
            const px = colourRgba(ring.mask, 3, 3, rgb);
            expect([...px.subarray(0, 4)], name).toEqual([...rgb, 255]);
            expect([...px.subarray(16, 20)], name).toEqual([0, 0, 0, 0]);   // the art's own pixel
        }
        expect(OUTLINE_COLOURS.work).toEqual([9, 181, 84]);
        expect(OUTLINE_COLOURS.hover).toEqual([255, 255, 255]);
        expect(OUTLINE_COLOURS.alert).toEqual([239, 68, 68]);
    });
});

describe('which outline image is drawn: the thickness setting', () => {
    it('"1 screen pixel" picks the image that lands on exactly one screen pixel', () => {
        expect(pickOutlineVariant(1, 'screen')).toEqual({ u: 1, r: 1 });
        expect(pickOutlineVariant(2, 'screen')).toEqual({ u: 2, r: 1 });
        expect(pickOutlineVariant(3, 'screen')).toEqual({ u: 3, r: 1 });
        expect(pickOutlineVariant(4, 'screen')).toEqual({ u: 4, r: 1 });
        expect(pickOutlineVariant(0.5, 'screen')).toEqual({ u: 1, r: 2 });
    });

    it('"1 art pixel" draws one pixel of the art, never thinner than a screen pixel', () => {
        expect(pickOutlineVariant(1, 'art')).toEqual({ u: 1, r: 1 });
        expect(pickOutlineVariant(2, 'art')).toEqual({ u: 1, r: 1 });
        expect(pickOutlineVariant(3, 'art')).toEqual({ u: 1, r: 1 });
        expect(pickOutlineVariant(0.5, 'art')).toEqual({ u: 1, r: 2 });
    });

    it('the shadow sits 2 art pixels away, in whole screen pixels', () => {
        expect(shadowScreenPx(2)).toBe(4);
        expect(shadowScreenPx(1)).toBe(2);
        expect(shadowScreenPx(3)).toBe(6);
        expect(shadowScreenPx(0.5)).toBe(1);
    });
});

describe('what gets outlines, and the sheet grids the game draws with', () => {
    it('anything a Token can wear is outlined; the UI’s own icons get a silhouette only; flags are outlined', () => {
        expect(isOutlined('assets/tokens/nature/token_tree_oak.png')).toBe(true);
        expect(isOutlined('assets/heroes/animations/ani_fighter_0.png')).toBe(true);
        expect(isOutlined('assets/enemies/animal/anim/ani_cow.png')).toBe(true);
        expect(isOutlined('assets/ui/flag/hero_flag_base.png')).toBe(true);
        expect(isOutlined('assets/playmat/props/prop_tree_oak.png')).toBe(true);
        expect(isOutlined('assets/items/ore/item_copper_ore.png')).toBe(true);
        expect(isOutlined('assets/skills/skill_mining.png')).toBe(true);
        expect(isOutlined('assets/ui/ui_alert_red.png')).toBe(false);
    });

    it('hero sheets are 8 × 3 and enemy sheets 4 × 4, matching the animation code', () => {
        expect(sheetGridOf('assets/heroes/animations/ani_fighter_0.png')).toEqual(HERO_SHEET_GRID);
        expect(sheetGridOf('assets/enemies/animal/anim/ani_cow.png')).toEqual(ENEMY_SHEET_GRID);
        expect(sheetGridOf('assets/tokens/token_quarry_2.png')).toBeNull();
        expect(HERO_SHEET_GRID).toEqual({ cols: 8, rows: 3 });
        expect(ENEMY_SHEET_GRID).toEqual({ cols: 4, rows: 4 });
    });
});

describe('generateSpriteFx — files on disk, kept current', () => {
    let root;
    const out = () => path.join(root, 'public', SPRITE_FX_DIR);
    const writeArt = async (rel, w, h, pixels) => {
        const file = path.join(root, 'public', rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await sharp(art(w, h, pixels), { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
    };
    const read = async (file) => {
        const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        return { data, w: info.width, h: info.height };
    };

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-fx-'));
        await writeArt('assets/tokens/token_test.png', 4, 4, [[1, 1], [2, 1], [1, 2]]);
        await writeArt('assets/ui/ui_test.png', 2, 2, [[0, 0]]);
        await writeArt('assets/heroes/animations/ani_test_0.png', 16, 6, [[1, 1], [9, 4]]);
        await writeArt('assets/audio/not_a_sprite.png', 2, 2, [[0, 0]]);
    });
    afterAll(() => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* temp */ } });

    it('writes a silhouette for every sprite and outlines for mat sprites, into public/_gen only', async () => {
        const r = await generateSpriteFx({ root });
        expect(r.generated).toBe(3);
        expect(listSprites(root)).toEqual([
            'assets/heroes/animations/ani_test_0.png', 'assets/tokens/token_test.png', 'assets/ui/ui_test.png'
        ]);
        const manifest = JSON.parse(fs.readFileSync(path.join(out(), 'manifest.json'), 'utf8'));
        expect(manifest.sprites['assets/tokens/token_test.png']).toMatchObject({ w: 4, h: 4, outlined: true });
        expect(manifest.sprites['assets/ui/ui_test.png']).toMatchObject({ w: 2, h: 2, outlined: false });
        expect(manifest.sprites['assets/heroes/animations/ani_test_0.png']).toMatchObject({ w: 16, h: 6, cols: 8, rows: 3, outlined: true });
        expect(fs.existsSync(path.join(out(), 'ol-work-u1r1', 'assets/ui/ui_test.png'))).toBe(false);
        expect(fs.existsSync(path.join(out(), 'sil', 'assets/audio/not_a_sprite.png'))).toBe(false);
        // Nothing was written beside the owner's art.
        expect(fs.readdirSync(path.join(root, 'public', 'assets', 'tokens'))).toEqual(['token_test.png']);
    });

    it('the silhouette PNG decodes to the art’s mask in black', async () => {
        const src = await read(path.join(root, 'public', 'assets/tokens/token_test.png'));
        const sil = await read(path.join(out(), 'sil', 'assets/tokens/token_test.png'));
        expect([sil.w, sil.h]).toEqual([4, 4]);
        const mask = alphaMask(src.data, 4, 4);
        for (let i = 0; i < 16; i++) {
            const px = [...sil.data.subarray(i * 4, i * 4 + 4)];
            // A clear pixel's colour is whatever the palette holds; only its alpha matters.
            if (mask[i]) expect(px).toEqual([0, 0, 0, 255]);
            else expect(px[3]).toBe(0);
        }
    });

    it('each outline PNG decodes to the ring, in its colour, for every variant', async () => {
        const src = await read(path.join(root, 'public', 'assets/tokens/token_test.png'));
        const mask = alphaMask(src.data, 4, 4);
        for (const v of OUTLINE_VARIANTS) {
            const want = bruteRing(mask, 4, 4, v.u, v.r, null);
            for (const [colour, rgb] of Object.entries(OUTLINE_COLOURS)) {
                const img = await read(path.join(out(), `ol-${colour}-u${v.u}r${v.r}`, 'assets/tokens/token_test.png'));
                expect([img.w, img.h]).toEqual([want.W, want.H]);
                const got = new Set();
                for (let i = 0; i < img.w * img.h; i++) {
                    const px = [...img.data.subarray(i * 4, i * 4 + 4)];
                    if (px[3]) { expect(px).toEqual([...rgb, 255]); got.add(i); }
                }
                expect(got).toEqual(want.set);
            }
        }
    });

    it('a sheet’s outline keeps the sheet’s size and grid', async () => {
        const img = await read(path.join(out(), 'ol-hover-u2r1', 'assets/heroes/animations/ani_test_0.png'));
        expect([img.w, img.h]).toEqual([32, 12]);
    });

    it('a second run redraws nothing; a changed sprite is redrawn; a deleted one is cleaned up', async () => {
        expect((await generateSpriteFx({ root })).generated).toBe(0);
        await writeArt('assets/tokens/token_test.png', 4, 4, [[0, 0]]);
        expect((await generateSpriteFx({ root })).generated).toBe(1);
        const sil = await read(path.join(out(), 'sil', 'assets/tokens/token_test.png'));
        expect(sil.data[3]).toBe(255);
        expect(sil.data[(1 * 4 + 1) * 4 + 3]).toBe(0);
        fs.rmSync(path.join(root, 'public', 'assets/ui/ui_test.png'));
        const r = await generateSpriteFx({ root });
        expect(r.removed).toBe(1);
        expect(fs.existsSync(path.join(out(), 'sil', 'assets/ui/ui_test.png'))).toBe(false);
        const manifest = JSON.parse(fs.readFileSync(path.join(out(), 'manifest.json'), 'utf8'));
        expect(manifest.sprites['assets/ui/ui_test.png']).toBeUndefined();
    });
});
