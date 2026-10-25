import { describe, it, expect } from 'vitest';
import { relative } from 'node:path';
import { SRC, listFiles, readSource, setScanTimeout } from './fixtures/sourceScan.js';

// One table for the screen's layers (`tailwind.css`, `--z-*`); the mat keeps its own (`MAT_Z`).
// ⚠️ The Atlas was on its own branch when the table landed; it adopts `--z-atlas` after it merges.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/];

const uiFiles = (dir) => listFiles(dir, { ext: /\.(jsx?|mjs)$/ });

setScanTimeout();

const css = readSource(`${SRC}/tailwind.css`);
const table = Object.fromEntries([...css.matchAll(/^\s*--z-([a-z-]+):\s*(\d+);/gm)].map(m => [m[1], Number(m[2])]));
const files = uiFiles(`${SRC}/ui`).filter(p => !EXEMPT.some(re => re.test(p)));

describe('the screen layers table', () => {
    it('no UI file writes a screen-level z-index as a literal', () => {
        const hits = [];
        for (const path of files) {
            const text = readSource(path);
            for (const m of text.matchAll(/z-\[\d+\]|\bz-\d{3,}\b|zIndex:\s*\d{3,}/g)) {
                hits.push(`${relative(SRC, path)}: ${m[0]}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('every layer a file names is in the table', () => {
        const unknown = [];
        for (const path of files) {
            const text = readSource(path);
            for (const m of text.matchAll(/(?:z-\(|var\()--z-([a-z-]+)\)/g)) {
                if (!(m[1] in table)) unknown.push(`${relative(SRC, path)}: --z-${m[1]}`);
            }
        }
        expect(unknown).toEqual([]);
    });

    it('is the only place a --z-* layer is defined (a second :root copy would win and reorder them)', () => {
        const others = [];
        for (const path of listFiles(SRC, { ext: /\.css$/, tests: true })) {
            if (path.endsWith('tailwind.css')) continue;
            if (/^\s*--z-[a-z-]+:/m.test(readSource(path))) others.push(relative(SRC, path));
        }
        expect(others).toEqual([]);
    });

    it('keeps the order the screens rely on', () => {
        expect(table.nav).toBeGreaterThan(table.drawer);
        expect(table.nav).toBeGreaterThan(table['hero-panel']);
        expect(table.modal).toBeGreaterThan(table.nav);
        expect(table['modal-inner']).toBeGreaterThan(table.modal);
        expect(table.tooltip).toBe(Math.max(...Object.values(table)));
    });
});
