// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import viteConfig from '../../vite.config.js';
import {
    artBenchPlugin, listArtBench, stripPreviewsFromBuild, PAGE_FILE, PREVIEW_DIR
} from '../../scripts/artBench.mjs';

/**
 * The art bench (`npm run art:bench`) is a dev tool and must never ship in the
 * game build. These pin the three ways it could leak in.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpDirs = [];
function tmp() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'art-bench-'));
    tmpDirs.push(d);
    return d;
}
function put(file, text = 'x') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}
afterAll(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });

describe('art bench stays out of the game build', () => {
    const config = viteConfig({ mode: 'production', command: 'build' });
    const plugins = config.plugins.flat(Infinity).filter(Boolean);

    it('the build has no extra inputs: only index.html, which never mentions the bench', () => {
        expect(config.build?.rollupOptions?.input).toBeUndefined();
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
        expect(html).not.toMatch(/art-bench/i);
    });

    it('the page lives outside public/ (Vite copies all of public/ into the build)', () => {
        expect(PAGE_FILE[0]).not.toBe('public');
        expect(fs.existsSync(path.join(ROOT, ...PAGE_FILE))).toBe(true);
        expect(fs.existsSync(path.join(ROOT, 'public', 'art-bench'))).toBe(false);
    });

    it('the page server runs on the dev server only', () => {
        const server = plugins.find(p => p.name === 'art-bench');
        expect(server).toBeDefined();
        expect(server.apply).toBe('serve');
        expect(server.generateBundle).toBeUndefined();
    });

    it('the build deletes the brightness previews that public/_gen/ would otherwise copy in', () => {
        const guard = plugins.find(p => p.name === 'art-bench-build-guard');
        expect(guard).toBeDefined();
        expect(guard.apply).toBe('build');

        const root = tmp();
        const out = path.join(root, 'dist');
        put(path.join(out, '_gen', 'art-bench', 'gentle', 'tokens', 'a.png'));
        put(path.join(out, '_gen', 'sprite-fx', 'b.png'));
        put(path.join(out, 'index.html'));
        guard.configResolved({ root, build: { outDir: 'dist' } });
        guard.closeBundle();
        expect(fs.existsSync(path.join(out, '_gen', 'art-bench'))).toBe(false);
        expect(fs.existsSync(path.join(out, '_gen', 'sprite-fx', 'b.png'))).toBe(true);
        expect(fs.existsSync(path.join(out, 'index.html'))).toBe(true);
    });

    const dist = path.join(ROOT, 'dist');
    it.skipIf(!fs.existsSync(dist))('a built dist/ holds nothing of the bench', () => {
        const hits = [];
        const walk = (d) => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (/art-bench/i.test(e.name)) hits.push(full);
                if (e.isDirectory()) walk(full);
                else if (/\.html$/i.test(e.name) && /Art bench|__art-bench/.test(fs.readFileSync(full, 'utf-8'))) hits.push(full);
            }
        };
        walk(dist);
        expect(hits).toEqual([]);
    });
});

describe('art bench listing', () => {
    it('lists the art, the previews and the script presets', () => {
        const root = tmp();
        put(path.join(root, 'public', 'assets', 'tokens', 'oak.png'));
        put(path.join(root, 'public', 'assets', 'notes.txt'));
        put(path.join(root, ...PREVIEW_DIR, 'gentle', 'tokens', 'oak.png'));
        put(path.join(root, ...PREVIEW_DIR, 'presets.json'),
            JSON.stringify([{ id: 'gentle', brightness: 1.08, saturation: 1.12, threshold: 40 }]));
        const l = listArtBench(root);
        expect(l.assets).toEqual(['tokens/oak.png']);
        expect(l.previews).toEqual(['gentle/tokens/oak.png']);
        expect(l.presets[0].id).toBe('gentle');
    });

    it('works before the brightness script has ever run', () => {
        const root = tmp();
        put(path.join(root, 'public', 'assets', 'a.png'));
        expect(listArtBench(root)).toEqual({ assets: ['a.png'], previews: [], presets: null });
    });

    it('strips previews only when present', () => {
        expect(() => stripPreviewsFromBuild(path.join(tmp(), 'nope'))).not.toThrow();
    });

    it('returns two plugins for the Vite config', () => {
        expect(artBenchPlugin().map(p => p.name)).toEqual(['art-bench', 'art-bench-build-guard']);
    });
});
