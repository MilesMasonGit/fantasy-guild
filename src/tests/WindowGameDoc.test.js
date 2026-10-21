// @vitest-environment node
// docs/reference/WINDOW_GAME.md lists every `window.Game` entry: agents read it
// instead of the code, so it must match `EngineBootstrap.getEngine()`.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';

describe('WINDOW_GAME.md', () => {
    it('has one row per window.Game entry, no more, no fewer', () => {
        const doc = fs.readFileSync(new URL('../../docs/reference/WINDOW_GAME.md', import.meta.url), 'utf8');
        const rows = [...doc.matchAll(/^\| `(\w+)` \|/gm)].map(m => m[1]).sort();
        const entries = Object.keys(EngineBootstrap.getEngine()).sort();
        expect(rows).toEqual(entries);
        expect(doc).toContain(`## The entries (${entries.length})`);
    });
});
