import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// One table for the screen's layers (`tailwind.css`, `--z-*`); the mat keeps its own (`MAT_Z`).
const SRC = join(process.cwd(), 'src');
// ⚠️ The Atlas was on its own branch when the table landed; it adopts `--z-atlas` after it merges.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/];

function uiFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return uiFiles(path);
        return /\.(jsx?|mjs)$/.test(path) ? [path] : [];
    });
}

const css = readFileSync(join(SRC, 'tailwind.css'), 'utf8');
const table = Object.fromEntries([...css.matchAll(/^\s*--z-([a-z-]+):\s*(\d+);/gm)].map(m => [m[1], Number(m[2])]));
const files = uiFiles(join(SRC, 'ui')).filter(p => !EXEMPT.some(re => re.test(p)));

describe('the screen layers table', () => {
    it('no UI file writes a screen-level z-index as a literal', () => {
        const hits = [];
        for (const path of files) {
            const text = readFileSync(path, 'utf8');
            for (const m of text.matchAll(/z-\[\d+\]|\bz-\d{3,}\b|zIndex:\s*\d{3,}/g)) {
                hits.push(`${relative(SRC, path)}: ${m[0]}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('every layer a file names is in the table', () => {
        const unknown = [];
        for (const path of files) {
            const text = readFileSync(path, 'utf8');
            for (const m of text.matchAll(/(?:z-\(|var\()--z-([a-z-]+)\)/g)) {
                if (!(m[1] in table)) unknown.push(`${relative(SRC, path)}: --z-${m[1]}`);
            }
        }
        expect(unknown).toEqual([]);
    });

    it('is the only place a --z-* layer is defined (a second :root copy would win and reorder them)', () => {
        const others = [];
        const walk = (dir) => readdirSync(dir).forEach(name => {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) return walk(path);
            if (!path.endsWith('.css') || path.endsWith('tailwind.css')) return;
            if (/^\s*--z-[a-z-]+:/m.test(readFileSync(path, 'utf8'))) others.push(relative(SRC, path));
        });
        walk(SRC);
        expect(others).toEqual([]);
    });

    it('keeps the order the screens rely on', () => {
        expect(table.nav).toBeGreaterThan(table.drawer);
        expect(table.nav).toBeGreaterThan(table['hero-panel']);
        expect(table.modal).toBeGreaterThan(table.nav);
        expect(table['nav-over-modal']).toBeGreaterThan(table.modal);
        expect(table['modal-inner']).toBeGreaterThan(table['nav-over-modal']);
        expect(table.tooltip).toBe(Math.max(...Object.values(table)));
    });
});
