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
    SPRITE_FX_DIR, OUTLINE_COLOURS, shadowScreenPx,
    sheetGridOf, isOutlined, HERO_SHEET_GRID, ENEMY_SHEET_GRID
} from '../config/spriteFx.js';

/**
 * ⭐ Wave 5 (owner rulings Z §11): the hard shadow and the coloured outlines
 * are PICTURES made from the art at build and dev time, never live filters.
 * These pin what the generator draws:
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

const CARDINAL = [[0, -1], [-1, 0], [1, 0], [0, 1]];
const DIAGONAL = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** Brute force: every clear pixel with an art pixel edge to edge (same frame cell for a sheet). */
function bruteRing(mask, w, h, grid) {
    const pad = grid ? 0 : 1;
    const W = w + 2 * pad, H = h + 2 * pad;
    const inArt = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    const cell = (x, y) => grid ? `${Math.floor(x / (w / grid.cols))},${Math.floor(y / (h / grid.rows))}` : '0';
    const out = new Set();
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const x = X - pad, y = Y - pad;
        if (inArt(x, y)) continue;
        if (CARDINAL.some(([dx, dy]) => inArt(x + dx, y + dy) && (!grid || cell(x, y) === cell(x + dx, y + dy)))) out.add(Y * W + X);
    }
    return { set: out, W, H };
}

const setOf = (mask) => new Set([...mask.keys()].filter(i => mask[i]));

/**
 * The owner's rule, checked pixel by pixel: every ring pixel touches the art
 * edge to edge, no ring pixel touches it ONLY corner to corner, and no clear
 * pixel that touches the art edge to edge was left out.
 */
function expectCardinalOnly(mask, w, h, ring, grid = null) {
    const pad = grid ? 0 : 1;
    const inArt = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    for (let Y = 0; Y < ring.height; Y++) for (let X = 0; X < ring.width; X++) {
        const x = X - pad, y = Y - pad;
        const on = ring.mask[Y * ring.width + X] === 1;
        const edge = CARDINAL.some(([dx, dy]) => inArt(x + dx, y + dy));
        const corner = DIAGONAL.some(([dx, dy]) => inArt(x + dx, y + dy));
        if (on) {
            expect(inArt(x, y), `ring pixel ${x},${y} is on the art`).toBe(false);
            expect(edge, `ring pixel ${x},${y} only touches the art diagonally`).toBe(true);
        } else if (!grid && !inArt(x, y)) {
            expect(edge, `clear pixel ${x},${y} touches the art edge to edge but has no outline`).toBe(false);
        }
        void corner;
    }
}

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

describe('an outline is one art pixel, edge to edge only (4-connected)', () => {
    it('one art pixel: a plus — its 4 edge neighbours, never its corners; padded by 1', () => {
        const mask = alphaMask(art(1, 1, [[0, 0]]), 1, 1);
        const ring = outlineMask(mask, 1, 1);
        expect([ring.width, ring.height]).toEqual([3, 3]);
        expect([...ring.mask]).toEqual([
            0, 1, 0,
            1, 0, 1,
            0, 1, 0
        ]);
    });

    it('a square keeps square sides and empty corners (no corner pixel, no doubles)', () => {
        const px = [];
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) px.push([x, y]);
        const ring = outlineMask(alphaMask(art(3, 3, px), 3, 3), 3, 3);
        expect([...ring.mask]).toEqual([
            0, 1, 1, 1, 0,
            1, 0, 0, 0, 1,
            1, 0, 0, 0, 1,
            1, 0, 0, 0, 1,
            0, 1, 1, 1, 0
        ]);
    });

    it('a diagonal staircase gets a single-pixel staircase, not a thick band', () => {
        const mask = alphaMask(art(3, 3, [[0, 0], [1, 1], [2, 2]]), 3, 3);
        const ring = outlineMask(mask, 3, 3);
        // Above-right of the stair: (1,0) and (2,1) — and NOT (2,0), which only touches it diagonally.
        const at = (x, y) => ring.mask[(y + 1) * ring.width + (x + 1)];
        expect([at(1, 0), at(2, 1), at(2, 0)]).toEqual([1, 1, 0]);
        expectCardinalOnly(mask, 3, 3, ring);
    });

    it('matches a brute-force cardinal dilation on irregular art, and no ring pixel is only diagonal', () => {
        const pixels = [[1, 1], [2, 1], [5, 2], [3, 4], [3, 5], [0, 6], [6, 6], [4, 4], [5, 5]];
        const mask = alphaMask(art(7, 7, pixels), 7, 7);
        const ring = outlineMask(mask, 7, 7);
        const want = bruteRing(mask, 7, 7, null);
        expect([ring.width, ring.height]).toEqual([want.W, want.H]);
        expect(setOf(ring.mask)).toEqual(want.set);
        expectCardinalOnly(mask, 7, 7, ring);
    });

    it('the art’s own black border counts as art: the ring sits outside it', () => {
        // A 3×3 sprite: black border pixels round one coloured middle.
        const rgba = Buffer.alloc(3 * 3 * 4);
        for (let i = 0; i < 9; i++) rgba[i * 4 + 3] = 255;   // all opaque; border is black (0,0,0)
        rgba[4 * 4] = 200;                                    // the middle is coloured
        const ring = outlineMask(alphaMask(rgba, 3, 3), 3, 3);
        // Nothing inside the 3×3 art box is ring.
        for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) expect(ring.mask[y * 5 + x]).toBe(0);
    });

    it('a sprite sheet grows inside each frame cell, cardinal only, and is not padded', () => {
        // Two 4-px cells side by side; art on both sides of the shared edge.
        const pixels = [[3, 1], [4, 3], [0, 0]];
        const mask = alphaMask(art(8, 4, pixels), 8, 4);
        const grid = { cols: 2, rows: 1 };
        const ring = outlineMask(mask, 8, 4, { grid });
        expect([ring.width, ring.height]).toEqual([8, 4]);
        expect(setOf(ring.mask)).toEqual(bruteRing(mask, 8, 4, grid).set);
        expectCardinalOnly(mask, 8, 4, ring, grid);
        // (3, 1) — the left cell's last column — rings (2, 1) in its own cell,
        // never (4, 1) across the frame edge, and never its diagonal (2, 0).
        expect(ring.mask[1 * 8 + 2]).toBe(1);
        expect(ring.mask[1 * 8 + 4]).toBe(0);
        expect(ring.mask[0 * 8 + 2]).toBe(0);
    });

    it('is filled with one solid colour per state', () => {
        const ring = outlineMask(alphaMask(art(1, 1, [[0, 0]]), 1, 1), 1, 1);
        for (const [name, rgb] of Object.entries(OUTLINE_COLOURS)) {
            const px = colourRgba(ring.mask, 3, 3, rgb);
            expect([...px.subarray(4, 8)], name).toEqual([...rgb, 255]);    // (1,0): edge neighbour
            expect([...px.subarray(0, 4)], name).toEqual([0, 0, 0, 0]);     // (0,0): corner, clear
            expect([...px.subarray(16, 20)], name).toEqual([0, 0, 0, 0]);   // the art's own pixel
        }
        expect(OUTLINE_COLOURS.work).toEqual([9, 181, 84]);
        expect(OUTLINE_COLOURS.hover).toEqual([255, 255, 255]);
        expect(OUTLINE_COLOURS.alert).toEqual([239, 68, 68]);
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
        expect(fs.existsSync(path.join(out(), 'ol-work', 'assets/ui/ui_test.png'))).toBe(false);
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

    it('each outline PNG decodes to the cardinal ring, at the art’s own pixel size plus 1, in its colour', async () => {
        const src = await read(path.join(root, 'public', 'assets/tokens/token_test.png'));
        const mask = alphaMask(src.data, 4, 4);
        const want = bruteRing(mask, 4, 4, null);
        for (const [colour, rgb] of Object.entries(OUTLINE_COLOURS)) {
            const img = await read(path.join(out(), `ol-${colour}`, 'assets/tokens/token_test.png'));
            // One image pixel per art pixel: whole art pixels once scaled with the sprite.
            expect([img.w, img.h]).toEqual([6, 6]);
            const got = new Set();
            for (let i = 0; i < img.w * img.h; i++) {
                const px = [...img.data.subarray(i * 4, i * 4 + 4)];
                if (px[3]) { expect(px).toEqual([...rgb, 255]); got.add(i); }
            }
            expect(got).toEqual(want.set);
            expectCardinalOnly(mask, 4, 4, { mask: Uint8Array.from({ length: 36 }, (_, i) => (got.has(i) ? 1 : 0)), width: 6, height: 6 });
        }
        // The old thin-line images are not made any more.
        expect(fs.readdirSync(out()).filter(d => /-u\d+r\d+$/.test(d))).toEqual([]);
    });

    it('a sheet’s outline keeps the sheet’s size and grid, cardinal only per frame', async () => {
        const src = await read(path.join(root, 'public', 'assets/heroes/animations/ani_test_0.png'));
        const img = await read(path.join(out(), 'ol-hover', 'assets/heroes/animations/ani_test_0.png'));
        expect([img.w, img.h]).toEqual([16, 6]);
        const mask = alphaMask(src.data, 16, 6);
        const grid = { cols: 8, rows: 3 };
        const got = new Set();
        for (let i = 0; i < 96; i++) if (img.data[i * 4 + 3]) got.add(i);
        expect(got).toEqual(bruteRing(mask, 16, 6, grid).set);
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
