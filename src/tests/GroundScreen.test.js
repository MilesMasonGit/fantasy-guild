import { describe, it, expect } from 'vitest';
import { screenGrid, buildScreenPass, MAT_EDGE } from '../ui/components/board/groundScreen.js';
import { boardScaleAt, boardArtSteps } from '../ui/components/base/TokenSprite.jsx';
import { SHEET_PX, PROP_PX, PROP_SHEET_CELLS } from '../config/registries/terrainRegistry.js';

/**
 * The screen pass (terrain roadmap decisions 6 and 8): the ground plan, 2 mat units a pixel,
 * resampled onto the screen's ground-pixel grid, one ground pixel being exactly one Token art
 * pixel on screen at every fit; the sheets sampled one sheet pixel per ground pixel; the props one
 * prop pixel per ground pixel; the mat's rounded corners, faint edge and inset shadow drawn into
 * the same picture, because the picture covers the surface that used to draw them.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const PLAN_U = 2;

/** Every fit the mat takes between 0.5 and 1.6 (`fitScale` rounds to whole percent). */
const FITS = Array.from({ length: 111 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100);

/** A 64 × 64 sheet of one colour. */
function solid(r, g, b) {
    const out = new Uint8ClampedArray(SHEET_PX * SHEET_PX * 4);
    for (let i = 0; i < out.length; i += 4) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; }
    return out;
}

/** A 64 × 64 sheet whose texel (x, y) reads red x, green y: where a sample came from is legible. */
function coords() {
    const out = new Uint8ClampedArray(SHEET_PX * SHEET_PX * 4);
    for (let y = 0; y < SHEET_PX; y++) {
        for (let x = 0; x < SHEET_PX; x++) {
            const i = (y * SHEET_PX + x) * 4;
            out[i] = x; out[i + 1] = y; out[i + 2] = 7; out[i + 3] = 255;
        }
    }
    return out;
}

/** A plan in the shape `buildGroundPlan` returns, drawn with the sheets and props given. */
function planOf({ sheets = ['flat'], sheetAt = null, tints = [], tintAt = null, props = [] } = {}) {
    const width = Math.ceil(MAT.w / PLAN_U);
    const height = Math.ceil(MAT.h / PLAN_U);
    const n = width * height;
    return {
        width, height, unit: PLAN_U, seed: 1,
        sheets, sheetAt: sheetAt || new Uint8Array(n),
        tints, tintAt: tintAt || new Int8Array(n).fill(-1),
        props
    };
}

const fromTable = (table) => (id) => table[id] || null;

/** Whether a mat point is inside the mat's rounded rectangle, worked out afresh here. */
function insideMat(x, y) {
    const R = MAT_EDGE.radius;
    if (x < 0 || y < 0 || x > MAT.w || y > MAT.h) return false;
    const cx = x < R ? R : x > MAT.w - R ? MAT.w - R : x;
    const cy = y < R ? R : y > MAT.h - R ? MAT.h - R : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}

/** How far a mat point is from the rounded rectangle's edge (negative outside). */
function depthIn(x, y) {
    const R = MAT_EDGE.radius;
    const qx = Math.abs(x - MAT.w / 2) - (MAT.w / 2 - R);
    const qy = Math.abs(y - MAT.h / 2) - (MAT.h / 2 - R);
    return -(Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - R);
}

const px = (pass, gx, gy) => {
    const i = (gy * pass.cols + gx) * 4;
    return [pass.data[i], pass.data[i + 1], pass.data[i + 2], pass.data[i + 3]];
};

describe('⭐ one ground pixel is one Token pixel on screen', () => {
    it('⭐ the ground pixel is boardScaleAt(fit) mat units, at every fit from 0.5 to 1.6', () => {
        for (const fit of FITS) {
            const unit = boardScaleAt(fit);
            const grid = screenGrid(MAT, unit);
            expect(grid.unit, `fit ${fit}`).toBe(unit);
            // Through the mat's transform a ground pixel is a whole number of screen pixels, the
            // same as one pixel of a Token's art.
            expect(Math.abs(grid.unit * fit - boardArtSteps(fit)), `fit ${fit}`).toBeLessThan(1e-9);
            // The grid covers the mat in whole ground pixels, and no more than one further.
            expect(grid.cols * unit, `fit ${fit}`).toBeGreaterThanOrEqual(MAT.w - 1e-6);
            expect((grid.cols - 1) * unit, `fit ${fit}`).toBeLessThan(MAT.w);
            expect(grid.rows * unit, `fit ${fit}`).toBeGreaterThanOrEqual(MAT.h - 1e-6);
            expect((grid.rows - 1) * unit, `fit ${fit}`).toBeLessThan(MAT.h);
        }
    });

    it('the plan\'s 2-unit grid and the screen\'s agree at fits 0.5, 1 and 1.5, and the most pixels are just below 0.75', () => {
        for (const fit of [0.5, 1, 1.5]) expect(screenGrid(MAT, boardScaleAt(fit))).toMatchObject({ cols: 880, rows: 563 });
        expect(screenGrid(MAT, boardScaleAt(0.75))).toMatchObject({ cols: 660, rows: 423 });
        const most = screenGrid(MAT, boardScaleAt(0.74));
        expect(most.cols * most.rows).toBeGreaterThan(1_000_000);
    });

    it('samples a sheet one sheet pixel per ground pixel, repeating every sheet width', () => {
        const plan = planOf();
        for (const fit of [0.74, 1, 1.24]) {
            const pass = buildScreenPass(plan, { mat: MAT, unit: boardScaleAt(fit), sheet: fromTable({ flat: coords() }) });
            // Well inside the mat, where the inset shadow has faded to nothing.
            for (const [gx, gy] of [[300, 200], [301, 200], [363, 263], [364, 264]]) {
                const [r, g, b, a] = px(pass, gx, gy);
                expect([r, g, b, a], `fit ${fit} at ${gx},${gy}`).toEqual([gx % SHEET_PX, gy % SHEET_PX, 7, 255]);
            }
        }
    });

    it('draws each ground pixel from the plan pixel under its centre', () => {
        // Two sheets meeting at plan column 440 (mat x 880).
        const base = planOf({ sheets: ['left', 'right'] });
        for (let y = 0; y < base.height; y++) base.sheetAt.fill(1, y * base.width + 440, (y + 1) * base.width);
        for (const fit of [0.74, 1, 1.6]) {
            const unit = boardScaleAt(fit);
            const pass = buildScreenPass(base, {
                mat: MAT, unit, sheet: fromTable({ left: solid(200, 0, 0), right: solid(0, 200, 0) })
            });
            const gy = Math.floor(pass.rows / 2);
            for (let gx = 0; gx < pass.cols; gx++) {
                const centre = (gx + 0.5) * unit;
                if (!insideMat(centre, (gy + 0.5) * unit) || depthIn(centre, (gy + 0.5) * unit) < 400) continue;
                const [r, g] = px(pass, gx, gy);
                expect(centre >= 880 ? g > 0 && r === 0 : r > 0 && g === 0, `fit ${fit} column ${gx}`).toBe(true);
            }
        }
    });

    it('mixes a band\'s colour in by its amount', () => {
        const plan = planOf({ tints: [{ tint: '#ff0000', amount: 0.25 }] });
        plan.tintAt.fill(0);
        const pass = buildScreenPass(plan, { mat: MAT, unit: 2, sheet: fromTable({ flat: solid(0, 100, 200) }) });
        expect(px(pass, 440, 280)).toEqual([64, 75, 150, 255]);
    });
});

describe('⭐ the mat\'s edge is in the picture', () => {
    it('⭐ pixels outside the mat\'s rounded corners are clear, and every pixel inside is drawn', () => {
        const plan = planOf();
        for (const fit of [0.21, 0.5, 0.74, 0.75, 1, 1.37, 1.6]) {
            const unit = boardScaleAt(fit);
            const pass = buildScreenPass(plan, { mat: MAT, unit, sheet: fromTable({ flat: solid(120, 140, 90) }) });
            expect(pass.data.length).toBe(pass.cols * pass.rows * 4);
            let clear = 0;
            const wrong = [];
            for (let gy = 0; gy < pass.rows; gy++) {
                for (let gx = 0; gx < pass.cols; gx++) {
                    const x = (gx + 0.5) * unit;
                    const y = (gy + 0.5) * unit;
                    // A centre within a hair of the edge could fall either way in floating point.
                    if (Math.abs(depthIn(x, y)) < 1e-6) continue;
                    const alpha = pass.data[(gy * pass.cols + gx) * 4 + 3];
                    const inside = insideMat(x, y);
                    if (!inside) clear++;
                    if (alpha !== (inside ? 255 : 0) && wrong.length < 5) wrong.push(`${gx},${gy} alpha ${alpha}`);
                }
            }
            expect(wrong, `fit ${fit}`).toEqual([]);
            // The four corners really are cut.
            expect(clear, `fit ${fit}`).toBeGreaterThan(4);
            expect(px(pass, 0, 0)[3]).toBe(0);
            expect(px(pass, pass.cols - 1, pass.rows - 1)[3]).toBe(0);
        }
    });

    it('darkens towards the edge as the surface\'s inset shadow did, most in the corners', () => {
        const plan = planOf();
        const pass = buildScreenPass(plan, { mat: MAT, unit: 2, sheet: fromTable({ flat: solid(200, 200, 200) }) });
        const red = (gx, gy) => px(pass, gx, gy)[0];
        const midY = 281;
        // Untouched in the middle.
        expect(red(440, midY)).toBe(200);
        // Inward from just inside the faint edge, the ground brightens steadily to its own colour.
        let last = 0;
        for (let gx = 1; gx < 120; gx++) {
            expect(red(gx, midY), `column ${gx}`).toBeGreaterThanOrEqual(last);
            last = red(gx, midY);
        }
        expect(red(1, midY)).toBeLessThan(170);
        expect(last).toBeGreaterThan(195);
        // A pixel as deep in from the corner is darker than one as deep in from the edge's middle.
        expect(red(20, 20)).toBeLessThan(red(20, midY));
    });

    it('lightens the outermost ground pixel all the way round, as the surface\'s faint edge did', () => {
        const plan = planOf();
        const pass = buildScreenPass(plan, { mat: MAT, unit: 2, sheet: fromTable({ flat: solid(100, 100, 100) }) });
        const red = (gx, gy) => px(pass, gx, gy)[0];
        // The edge pixel is lifted by the edge's light; the one inside it is not.
        expect(red(0, 281)).toBeGreaterThan(red(1, 281));
        expect(red(440, 0)).toBeGreaterThan(red(440, 1));
        expect(red(pass.cols - 1, 281)).toBeGreaterThan(red(pass.cols - 2, 281));
        expect(red(440, pass.rows - 1)).toBeGreaterThan(red(440, pass.rows - 2));
    });
});

describe('scatter', () => {
    /** A prop sheet whose cell `index` has a 2-pixel-wide cross; everything else is clear. */
    function propSheet(index) {
        const side = PROP_PX * PROP_SHEET_CELLS;
        const out = new Uint8ClampedArray(side * side * 4);
        const ox = (index % PROP_SHEET_CELLS) * PROP_PX;
        const oy = Math.floor(index / PROP_SHEET_CELLS) * PROP_PX;
        for (let y = 0; y < PROP_PX; y++) {
            for (let x = 0; x < PROP_PX; x++) {
                if (x !== 7 && x !== 8 && y !== 7 && y !== 8) continue;
                const i = ((oy + y) * side + ox + x) * 4;
                out[i] = 10 + x; out[i + 1] = 20 + y; out[i + 2] = 255; out[i + 3] = 255;
            }
        }
        return out;
    }

    it('⭐ draws a prop one prop pixel per ground pixel, its foot on the ground pixel under the plan\'s foot', () => {
        const prop = { sheet: 'prop_test', index: 6, footX: 450, footY: 300, x: 442, y: 285 };
        const plan = planOf({ props: [prop] });
        for (const fit of [0.74, 1, 1.24]) {
            const unit = boardScaleAt(fit);
            const pass = buildScreenPass(plan, {
                mat: MAT, unit, sheet: fromTable({ flat: solid(50, 50, 50) }), prop: fromTable({ prop_test: propSheet(6) })
            });
            const footX = Math.floor((prop.footX + 0.5) * PLAN_U / unit);
            const footY = Math.floor((prop.footY + 0.5) * PLAN_U / unit);
            const left = footX - PROP_PX / 2;
            const top = footY - (PROP_PX - 1);
            for (let y = 0; y < PROP_PX; y++) {
                for (let x = 0; x < PROP_PX; x++) {
                    const cross = x === 7 || x === 8 || y === 7 || y === 8;
                    expect(px(pass, left + x, top + y), `fit ${fit} prop pixel ${x},${y}`)
                        .toEqual(cross ? [10 + x, 20 + y, 255, 255] : [50, 50, 50, 255]);
                }
            }
        }
    });

    it('paints the list in its order, so a prop lower down covers one behind it', () => {
        const behind = { sheet: 'a', index: 6, footX: 450, footY: 300 };
        const front = { sheet: 'b', index: 6, footX: 451, footY: 302 };
        const plan = planOf({ props: [behind, front] });
        const blue = propSheet(6);
        const red = propSheet(6);
        for (let i = 0; i < red.length; i += 4) if (red[i + 3]) red[i + 2] = 0;
        const pass = buildScreenPass(plan, {
            mat: MAT, unit: 2, sheet: fromTable({ flat: solid(50, 50, 50) }), prop: fromTable({ a: blue, b: red })
        });
        // A pixel both crosses paint: the front prop's (7, 7), the one behind's (8, 9).
        expect(px(pass, 450, 294)[2]).toBe(0);
        // One only the prop behind paints: its (7, 5), outside the front cross.
        expect(px(pass, 449, 290)[2]).toBe(255);
    });
});

describe('the pass leaves what it cannot draw clear', () => {
    it('draws nothing where a sheet is missing, and fails no other pixel', () => {
        const plan = planOf({ sheets: ['flat', 'missing'] });
        plan.sheetAt.fill(1, 0, plan.width * 100);
        const pass = buildScreenPass(plan, { mat: MAT, unit: 2, sheet: fromTable({ flat: solid(1, 2, 3) }) });
        expect(px(pass, 440, 50)[3]).toBe(0);
        expect(px(pass, 440, 400)[3]).toBe(255);
    });

    it('writes into the buffer it is handed', () => {
        const unit = boardScaleAt(1);
        const grid = screenGrid(MAT, unit);
        const out = new Uint8ClampedArray(grid.cols * grid.rows * 4);
        const pass = buildScreenPass(planOf(), { mat: MAT, unit, sheet: fromTable({ flat: solid(9, 9, 9) }), out });
        expect(pass.data).toBe(out);
    });
});
