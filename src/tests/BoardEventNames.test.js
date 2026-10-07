import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';

/**
 * board events are named by their constants, never by raw strings.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..');

function sourceFiles(dir = SRC) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(full);
        return /\.(js|jsx|mjs)$/.test(entry.name) ? [full] : [];
    });
}

/** Strip block and line comments, so only real code is scanned (as FreeMatGuards does). */
function codeOf(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const FILES = sourceFiles()
    .filter(f => !f.endsWith(path.join('board', 'boardEvents.js')))
    .map(f => ({ rel: path.relative(SRC, f).split(path.sep).join('/'), code: codeOf(fs.readFileSync(f, 'utf8')) }));

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('board events are named by constant (CR3-106)', () => {
    it('scans the source', () => {
        expect(FILES.length).toBeGreaterThan(200);
    });

    it("no raw 'board:…' string outside boardEvents.js", () => {
        const hits = [];
        for (const { rel, code } of FILES) {
            for (const m of code.matchAll(/(['"`])board:[a-z_]*/g)) hits.push(`${rel}: ${m[0]}`);
        }
        expect(hits).toEqual([]);
    });

    it('no board event without the prefix is subscribed, published or listed by raw string', () => {
        const bare = Object.values(BOARD_EVENTS).filter(v => !v.startsWith('board:'));
        expect(bare).toContain('token_placed');
        const hits = [];
        for (const name of bare) {
            const q = `['"\`]${escape(name)}['"\`]`;
            const patterns = [
                new RegExp(`\\.(subscribe|publish|unsubscribe)\\(\\s*${q}`),
                new RegExp(`\\[[^\\]]*${q}[^\\]]*\\]`)
            ];
            for (const { rel, code } of FILES) {
                if (patterns.some(p => p.test(code))) hits.push(`${rel}: ${name}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('TILE_PUSHED is gone: it never had a publisher', () => {
        expect(BOARD_EVENTS.TILE_PUSHED).toBeUndefined();
    });
});
