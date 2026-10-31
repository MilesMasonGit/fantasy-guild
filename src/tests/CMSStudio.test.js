// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import TopBar from '../../cms/src/components/layout/TopBar.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';

/**
 * The Studio: Recolor and Animation run in their own small app (`npm run studio`) that loads no
 * game data, and the CMS top bar no longer offers them. The Recolor tab imports palettes from the
 * drop folder (`cms/palettes-inbox/`) into the Material Library. Nothing here touches the real
 * workspace or `data/` (TESTING, "The CMS").
 */

const CMS = path.resolve(__dirname, '../../cms');
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('the CMS top bar', () => {
    it('no longer offers Recolor or Animation', () => {
        const { queryByRole, getByRole } = render(React.createElement(TopBar, {
            onViewChange: () => {}, currentView: 'editor',
            onOpenGenerate: () => {}, onOpenSettings: () => {}, onOpenFileManager: () => {}
        }));
        expect(getByRole('button', { name: 'Editor' })).toBeTruthy();
        expect(queryByRole('button', { name: 'Recolor' })).toBeNull();
        expect(queryByRole('button', { name: 'Animation' })).toBeNull();
    });

    it('App no longer routes to the Recolor or Animation editor', () => {
        const app = fs.readFileSync(path.join(CMS, 'src/App.jsx'), 'utf8');
        expect(app).not.toMatch(/RecolorEditor|AnimationEditor/);
    });
});

/** Every file the module at `file` reaches through relative imports. */
function importGraph(file, seen = new Set()) {
    if (seen.has(file)) return seen;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1] || m[2] || m[3];
        if (!spec.startsWith('.')) continue;
        const base = path.resolve(path.dirname(file), spec);
        const hit = [base, base + '.js', base + '.jsx', path.join(base, 'index.js')]
            .find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!hit) throw new Error(`unresolved import ${spec} in ${file}`);
        if (/\.(js|jsx)$/.test(hit)) importGraph(hit, seen); else seen.add(hit);
    }
    return seen;
}

describe('the Studio entry', () => {
    const entry = path.join(CMS, 'src/studio/main.jsx');

    it('has its own page that loads the Studio entry', () => {
        const html = fs.readFileSync(path.join(CMS, 'studio.html'), 'utf8');
        expect(html).toMatch(/src="\/src\/studio\/main\.jsx"/);
    });

    it('imports no CMS store, game code or game JSON', () => {
        const files = [...importGraph(entry)].map((f) => path.relative(CMS, f).split(path.sep).join('/'));
        expect(files).toContain('src/components/editors/RecolorEditor.jsx');
        expect(files).toContain('src/components/editors/AnimationEditor.jsx');
        for (const f of files) {
            expect(f, f).not.toMatch(/^src\/stores\//);
            expect(f, f).not.toMatch(/^\.\./); // nothing outside cms/: no game src/, no data/
            expect(f, f).not.toMatch(/\.json$/);
            expect(fs.readFileSync(path.join(CMS, f), 'utf8'), f).not.toMatch(/useEntityStore|load-game-data|sync-game-data/);
        }
    });

    // Loading and mounting the Studio app took 5 s under full-suite load beside a build.
    it('mounts Recolor and Animation as two tabs', { timeout: 30_000 }, async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
        const studioApp = '../../cms/src/studio/StudioApp.jsx';
        const { default: StudioApp } = await import(/* @vite-ignore */ studioApp);
        const view = render(React.createElement(StudioApp));
        await act(async () => {});
        const recolorTab = view.getByRole('tab', { name: 'Recolor' });
        const animationTab = view.getByRole('tab', { name: 'Animation' });
        expect(recolorTab.getAttribute('aria-selected')).toBe('true');
        expect(view.getByText('Material Library')).toBeTruthy();
        fireEvent.click(animationTab);
        await act(async () => {});
        expect(animationTab.getAttribute('aria-selected')).toBe('true');
        expect(view.queryByText('Material Library')).toBeNull();
    });
});

describe('the palette drop folder routes', () => {
    let dropDir, palettesDir, outside, handler, studioHandler;

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
    const request = (...args) => call(handler, ...args);

    beforeAll(() => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-studio-'));
        dropDir = path.join(tmp, 'palettes-inbox');
        palettesDir = path.join(tmp, 'palettes');
        outside = path.join(tmp, 'secret.json');
        fs.mkdirSync(dropDir);
        fs.mkdirSync(path.join(dropDir, 'nested'));
        fs.writeFileSync(path.join(dropDir, 'nested', 'deep.json'), JSON.stringify({ name: 'deep', colors: ['#000000'] }));
        fs.writeFileSync(path.join(dropDir, 'README.md'), '# not a palette');
        fs.writeFileSync(path.join(dropDir, 'notes.txt'), 'nope');
        fs.writeFileSync(path.join(dropDir, 'forest_ground.json'),
            JSON.stringify({ name: 'forest_ground', colors: ['#2A3B1C', '#4f6b2e', '5e8a3a'], group: 'Forest' }));
        fs.writeFileSync(path.join(dropDir, 'swamp.hex'), '1b2a22\n35503f\n');
        fs.writeFileSync(path.join(dropDir, 'broken.json'), '{ nope');
        fs.writeFileSync(outside, JSON.stringify({ name: 'secret', colors: ['#ffffff'] }));
        fs.mkdirSync(palettesDir);
        fs.writeFileSync(path.join(palettesDir, 'custom_palettes.json'), JSON.stringify({ oak: ['#2a1b0a'] }));
        cmsFileApi({ paletteInboxDir: dropDir, palettesDir }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
        cmsFileApi({ paletteInboxDir: dropDir, palettesDir, studio: true }).configureServer({ middlewares: { use: (fn) => { studioHandler = fn; } } });
    });
    afterAll(() => fs.rmSync(path.dirname(dropDir), { recursive: true, force: true }));

    it('lists only the palette files directly in the drop folder', async () => {
        const { status, body } = await request('GET', '/api/palette-inbox');
        expect(status).toBe(200);
        expect(body.map((p) => p.file)).toEqual(['broken.json', 'forest_ground.json', 'swamp.hex']);
        expect(body[1]).toEqual({ file: 'forest_ground.json', name: 'forest_ground', colors: ['#2a3b1c', '#4f6b2e', '#5e8a3a'], group: 'Forest' });
        expect(body[2]).toMatchObject({ name: 'swamp', colors: ['#1b2a22', '#35503f'] });
        expect(body[0].error).toMatch(/JSON/);
    });

    it('refuses any path outside the drop folder', async () => {
        for (const file of ['../secret.json', '..\\secret.json', outside, 'nested/deep.json', 'nested\\deep.json', '', 'notes.txt', null]) {
            const res = await request('POST', '/api/palette-inbox/import', { file });
            expect(res.status, String(file)).toBe(400);
        }
        const palettes = JSON.parse(fs.readFileSync(path.join(palettesDir, 'custom_palettes.json'), 'utf8'));
        expect(palettes).toEqual({ oak: ['#2a1b0a'] });
    });

    it('imports a palette into the Material Library through the existing palette files', async () => {
        const res = await request('POST', '/api/palette-inbox/import', { file: 'forest_ground.json' });
        expect(res).toMatchObject({ status: 200, body: { success: true, name: 'forest_ground' } });
        const library = await request('GET', '/api/custom-palettes');
        expect(library.body).toEqual({ oak: ['#2a1b0a'], forest_ground: ['#2a3b1c', '#4f6b2e', '#5e8a3a'] });
        expect((await request('GET', '/api/palette-groups')).body).toEqual({ forest_ground: 'Forest' });
        expect(fs.existsSync(path.join(dropDir, 'forest_ground.json'))).toBe(true);
    });

    it('asks before replacing a palette of the same name', async () => {
        fs.writeFileSync(path.join(dropDir, 'oak.hex'), 'ffffff\n');
        expect((await request('POST', '/api/palette-inbox/import', { file: 'oak.hex' })).status).toBe(409);
        expect((await request('GET', '/api/custom-palettes')).body.oak).toEqual(['#2a1b0a']);
        expect((await request('POST', '/api/palette-inbox/import', { file: 'oak.hex', overwrite: true })).status).toBe(200);
        expect((await request('GET', '/api/custom-palettes')).body.oak).toEqual(['#ffffff']);
    });

    it('the Studio server answers the palette and asset routes but never the game-data routes', async () => {
        expect((await call(studioHandler, 'GET', '/api/palette-inbox')).status).toBe(200);
        expect((await call(studioHandler, 'GET', '/api/custom-palettes')).status).toBe(200);
        for (const url of ['/api/sync-game-data', '/api/load-game-data', '/api/backups', '/api/register-sprite', '/api/sprite-audit']) {
            const method = url === '/api/load-game-data' || url === '/api/backups' ? 'GET' : 'POST';
            expect((await call(studioHandler, method, url, {})).status, url).toBe(403);
        }
    });
});
