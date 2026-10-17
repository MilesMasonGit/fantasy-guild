// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { PRESETS, DEFAULT_OUTLINE, brightenRgba } from '../../scripts/artBrighten.mjs';
import { brightenColor, brightenHex, makeColorBrightener } from '../../cms/artBrightenColor.js';
import { ART_BAKE, BAKE_KEY, planBrighten, splitLibrary, joinLibrary } from '../../cms/paletteBrighten.js';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { importDropFile } from '../../cms/paletteInbox.js';
import PaletteBrighten from '../../cms/src/components/editors/PaletteBrighten.jsx';

/**
 * The Studio's palette brightening: the Material Library gets the same colour maths the sprite
 * art was baked with, once. Only fixtures and temp folders here, never `data/palettes/`.
 */

const settings = { brightness: ART_BAKE.brightness, saturation: ART_BAKE.saturation, outline: ART_BAKE.threshold };
const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

describe('the shared colour function', () => {
    it('is the setting baked into the art', () => {
        expect({ brightness: ART_BAKE.brightness, saturation: ART_BAKE.saturation }).toEqual(PRESETS.gentle);
        expect(ART_BAKE.threshold).toBe(DEFAULT_OUTLINE);
    });

    it('matches the art script gentle preset and its outline threshold, so the two cannot drift', () => {
        expect(ART_BAKE.brightness).toBe(PRESETS.gentle.brightness);
        expect(ART_BAKE.saturation).toBe(PRESETS.gentle.saturation);
        expect(PRESETS.gentle).toEqual({ brightness: 1.08, saturation: 1.12 });
        expect(DEFAULT_OUTLINE).toBe(40);
    });

    it('gives exactly the script’s per-pixel result on sample colours, every preset', () => {
        const samples = [[0, 0, 0], [40, 40, 40], [40, 10, 0], [41, 30, 20], [120, 100, 80], [200, 60, 40], [255, 255, 255], [250, 10, 240]];
        let x = 7;
        for (let i = 0; i < 2000; i++) {
            const c = [];
            for (let k = 0; k < 3; k++) { x = (x * 1103515245 + 12345) & 0x7fffffff; c.push((x >> 16) & 255); }
            samples.push(c);
        }
        for (const preset of [...Object.values(PRESETS), { brightness: 1.3, saturation: 0.7 }]) {
            for (const outline of [0, 40, 90]) {
                const s = { ...preset, outline };
                const buf = Buffer.from(samples.flatMap((c) => [...c, 255]));
                const out = brightenRgba(buf, s);
                samples.forEach((c, i) => {
                    expect(brightenColor(c, s), `${c} ${JSON.stringify(s)}`).toEqual([...out.subarray(i * 4, i * 4 + 3)]);
                });
            }
        }
    });

    it('keeps a colour at or below the threshold exactly; the unchanged setting has no brightener', () => {
        expect(brightenColor([40, 12, 30], settings)).toEqual([40, 12, 30]);
        expect(brightenColor([41, 12, 30], settings)).not.toEqual([41, 12, 30]);
        expect(makeColorBrightener({ brightness: 1, saturation: 1 })).toBeNull();
    });

    it('brightens hex colours, leaving unchanged and malformed ones as given', () => {
        expect(brightenHex('#7F8C8D', settings)).toBe(hex(brightenColor([0x7f, 0x8c, 0x8d], settings)));
        expect(brightenHex('#1D1D28', settings)).toBe('#1D1D28');
        expect(brightenHex('nope', settings)).toBe('nope');
    });
});

const fixture = () => ({
    Copper: ['#3d1912', '#704214', '#b87333', '#e39a71', '#fdd5c4'],
    'True Black': ['#000000', '#141414', '#282828'],
    Iron: ['#1d1d2b', '#7f8c8d', '#ffffff'],
});

describe('planning the bake on a library', () => {
    it('brightens every colour above the threshold and counts them', () => {
        const plan = planBrighten(fixture());
        expect(plan).toMatchObject({ applied: false, palettes: 3, colors: 11, changedPalettes: 2 });
        // True Black stays, #1d1d2b (brightest channel 43) changes, white stays white.
        expect(plan.next['True Black']).toEqual(fixture()['True Black']);
        expect(plan.next.Iron[2]).toBe('#ffffff');
        expect(plan.next.Copper).toEqual(fixture().Copper.map((c) => brightenHex(c, settings)));
        const changed = Object.keys(fixture()).reduce((n, k) => n + fixture()[k].filter((c, i) => plan.next[k][i] !== c).length, 0);
        expect(plan.changedColors).toBe(changed);
    });

    it('records the marker in the library it saves', () => {
        expect(planBrighten(fixture()).next[BAKE_KEY]).toEqual({ brightness: 1.08, saturation: 1.12, threshold: 40 });
    });

    it('never brightens twice', () => {
        const once = planBrighten(fixture()).next;
        const again = planBrighten(once);
        expect(again).toMatchObject({ applied: true, next: null, changedColors: 0, palettes: 3, colors: 11 });
        expect(again.marker).toEqual(once[BAKE_KEY]);
    });

    it('splits the marker out of the palettes and back in', () => {
        const lib = planBrighten(fixture()).next;
        const { palettes, marker } = splitLibrary(lib);
        expect(Object.keys(palettes)).toEqual(['Copper', 'True Black', 'Iron']);
        expect(joinLibrary(palettes, marker)).toEqual(lib);
        expect(splitLibrary(null)).toEqual({ palettes: {}, marker: null });
    });
});

function call(fn, method, url, body) {
    return new Promise((resolve) => {
        const req = new EventEmitter();
        Object.assign(req, { method, url, headers: {} });
        const res = {
            statusCode: 200,
            setHeader: () => {},
            end: (text = '') => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null })
        };
        fn(req, res, () => resolve({ status: 'next' }));
        if (body !== undefined) req.emit('data', JSON.stringify(body));
        req.emit('end');
    });
}

describe('the save route with a temp library', () => {
    let tmp, palettesDir, dropDir, handler;
    const file = () => JSON.parse(fs.readFileSync(path.join(palettesDir, 'custom_palettes.json'), 'utf8'));

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-palbright-'));
        palettesDir = path.join(tmp, 'palettes');
        dropDir = path.join(tmp, 'inbox');
        fs.mkdirSync(palettesDir);
        fs.mkdirSync(dropDir);
        fs.writeFileSync(path.join(palettesDir, 'custom_palettes.json'), JSON.stringify(fixture()));
        cmsFileApi({ studio: true, palettesDir, paletteInboxDir: dropDir }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    });
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('writes the brightened palettes and the marker to the temp file', async () => {
        const plan = planBrighten((await call(handler, 'GET', '/api/custom-palettes')).body);
        expect((await call(handler, 'POST', '/api/custom-palettes', plan.next)).status).toBe(200);
        expect(file()).toEqual(plan.next);
        expect(planBrighten((await call(handler, 'GET', '/api/custom-palettes')).body).applied).toBe(true);
    });

    it('keeps the marker when a later save leaves it out', async () => {
        const plan = planBrighten(fixture());
        await call(handler, 'POST', '/api/custom-palettes', plan.next);
        const { palettes } = splitLibrary(plan.next);
        await call(handler, 'POST', '/api/custom-palettes', { ...palettes, Moss: ['#2a3b1c'] });
        expect(file()[BAKE_KEY]).toEqual(plan.next[BAKE_KEY]);
        expect(file().Moss).toEqual(['#2a3b1c']);
    });

    it('a save before any bake adds no marker', async () => {
        await call(handler, 'POST', '/api/custom-palettes', { Moss: ['#2a3b1c'] });
        expect(file()).toEqual({ Moss: ['#2a3b1c'] });
    });

    it('an import keeps the marker and refuses the reserved name', async () => {
        await call(handler, 'POST', '/api/custom-palettes', planBrighten(fixture()).next);
        fs.writeFileSync(path.join(dropDir, 'moss.hex'), '2a3b1c\n');
        fs.writeFileSync(path.join(dropDir, 'sneaky.json'), JSON.stringify({ name: BAKE_KEY, colors: ['#ffffff'] }));
        expect(importDropFile(dropDir, palettesDir, 'moss.hex').status).toBe(200);
        expect(importDropFile(dropDir, palettesDir, 'sneaky.json').status).toBe(400);
        expect(file()[BAKE_KEY]).toEqual(ART_BAKE);
        expect(file().moss).toEqual(['#2a3b1c']);
    });
});

describe('the Recolor tab’s brighten button', () => {
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    function server(initial) {
        let saved = initial;
        const posts = [];
        vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
            if (opts.method === 'POST') { saved = JSON.parse(opts.body); posts.push(saved); return { ok: true, json: async () => ({ success: true }) }; }
            return { ok: true, json: async () => saved };
        }));
        return posts;
    }

    it('shows the count, asks once, then saves the brightened library with the marker', async () => {
        const posts = server(fixture());
        const plan = planBrighten(fixture());
        const onApplied = vi.fn();
        const view = render(React.createElement(PaletteBrighten, { library: {}, onApplied }));
        await act(async () => {});
        expect(view.getByText(`Would change ${plan.changedColors} of 11 colours in 2 of 3 palettes. Once only; undo with git.`)).toBeTruthy();
        fireEvent.click(view.getByRole('button', { name: /Brighten material palettes \(art bake: 1\.08 \/ 1\.12\)/ }));
        expect(posts).toHaveLength(0);
        await act(async () => { fireEvent.click(view.getByRole('button', { name: `Yes, brighten ${plan.changedColors} colours` })); });
        expect(posts).toEqual([plan.next]);
        expect(onApplied).toHaveBeenCalled();
        expect(view.getByText(/Already applied/)).toBeTruthy();
        expect(view.getByRole('button', { name: /Brighten material palettes/ }).disabled).toBe(true);
    });

    it('is disabled and says already applied when the library has the marker', async () => {
        const posts = server(planBrighten(fixture()).next);
        const view = render(React.createElement(PaletteBrighten, { library: {} }));
        await act(async () => {});
        expect(view.getByText('Already applied (brightness 1.08, saturation 1.12, outlines at or below 40 kept).')).toBeTruthy();
        expect(view.getByRole('button', { name: /Brighten material palettes/ }).disabled).toBe(true);
        expect(posts).toHaveLength(0);
    });
});
