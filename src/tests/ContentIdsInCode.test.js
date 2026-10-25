import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import { listFiles, readSource, setScanTimeout } from './fixtures/sourceScan.js';

/**
 * Content ids named in code (`item_*`, `token_*`, `map_*` string literals under src/,
 * not tests) must exist in the shipped data. A CMS rename otherwise leaves a dead
 * reference with no test naming the cause.
 */

// Whole files whose ids are not content references.
const SKIPPED_FILES = {
    'config/registries/sprite-manifest.js': 'generated art manifest: keys are image file names, many for art with no data entry yet',
    'config/registries/legacySpriteNames.js': 'generated table of old image file names, not content ids'
};

// Dead references already ticketed in a file another session owns, by file then id. Each must still
// be dead: once it is fixed the last test below fails until its entry is removed.
const KNOWN_DEAD = {
    'ui/dev/terrainDev.js': {
        token_fishing_net: 'the dev Test Boat borrows the look of a Token the tools pack deleted; the terrain director repoints it (T-195)'
    }
};

// Literals that look like content ids but are not. Keep this short; each needs a reason.
const NOT_CONTENT_IDS = {
    map_node: 'Demolition kind constant, not a content id',
    item_assign: 'AudioSystem sound-effect key',
    item_discovered: 'engine event name',
    item_produced: 'quest progress event name',
    item_collected: 'quest progress event name',
    item_equip: 'drag/drop action name and sound key',
    token_placed: 'quest progress / board event name',
    token_purchased: 'quest progress / board event name',
    token_built: 'quest progress event name',
    token_inspected: 'quest progress event name',
    token_exhausted: 'board event name',
    token_restocked: 'board event name',
    token_quest: 'engine Token type (engineTokens.js), defined in code not data/',
    token_cap: 'Guild Hall upgrade track id, not a Token definition',
    token_bank_slots: 'retired Guild Hall upgrade ids (SaveMigration drops them from old saves)',
    token_bank_tabs: 'retired Guild Hall upgrade ids (SaveMigration drops them from old saves)',
    item_coin: 'SpriteLayer legacy alias next to item_coins, kept as a harmless match'
};

const SRC = path.resolve(__dirname, '..');
const DATA = path.resolve(__dirname, '../../data');
const loadIds = (file) => Object.keys(JSON.parse(asLoaded(file, fs.readFileSync(path.join(DATA, file), 'utf8'))));

/** Blank out comments (keeping line breaks and string contents) so only code is scanned. */
export function stripComments(src) {
    let out = '';
    let i = 0;
    let quote = null;
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (quote) {
            out += c;
            if (c === '\\') { out += n ?? ''; i += 2; continue; }
            if (c === quote) quote = null;
            i++;
        } else if (c === '/' && n === '/') {
            while (i < src.length && src[i] !== '\n') i++;
        } else if (c === '/' && n === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
            i += 2;
        } else {
            if (c === '"' || c === "'" || c === '`') quote = c;
            out += c;
            i++;
        }
    }
    return out;
}

/** Whole-literal ids only: a string that is exactly `item_x`, `token_x` or `map_x`. Prefixes (ending in `_`) never match. */
export function findIdLiterals(source) {
    const hits = [];
    const lines = stripComments(source).split('\n');
    lines.forEach((line, idx) => {
        for (const m of line.matchAll(/(['"`])((?:item|token|map)_[a-z0-9_]*[a-z0-9])\1/g)) {
            hits.push({ id: m[2], line: idx + 1 });
        }
    });
    return hits;
}

setScanTimeout();

const walk = (dir) => listFiles(dir, { ext: /\.(jsx?|mjs|css)$/ });

export function deadIdReport(files, known) {
    const dead = [];
    for (const file of files) {
        const rel = path.relative(SRC, file).split(path.sep).join('/');
        if (rel in SKIPPED_FILES) continue;
        for (const { id, line } of findIdLiterals(readSource(file))) {
            if (id in NOT_CONTENT_IDS || known.has(id) || id in (KNOWN_DEAD[rel] || {})) continue;
            dead.push(`${rel}:${line} names ${id}, which is not in data/items.json or data/tokens.json`);
        }
    }
    return dead;
}

describe('Content ids named in code exist in data/ (T-182)', () => {
    const known = new Set([...loadIds('items.json'), ...loadIds('tokens.json')]);

    it('every item_/token_/map_ literal in src/ is a shipped id', () => {
        const dead = deadIdReport(walk(SRC), known);
        expect(dead, `Dead content ids in code (renamed or removed in the CMS?):\n${dead.join('\n')}`).toEqual([]);
    });

    it('the scan sees the ids it should (guards against an empty scan)', () => {
        const hits = walk(SRC).flatMap((f) => findIdLiterals(readSource(f)));
        expect(hits.length).toBeGreaterThan(50);
    });

    it('every known dead reference is still in its file and still dead', () => {
        for (const [rel, ids] of Object.entries(KNOWN_DEAD)) {
            const named = new Set(findIdLiterals(fs.readFileSync(path.join(SRC, rel), 'utf8')).map((h) => h.id));
            for (const id of Object.keys(ids)) {
                expect(named.has(id) && !known.has(id), `${rel} ${id}: fixed, so remove it from KNOWN_DEAD`).toBe(true);
            }
        }
    });

    it('names the file, line and id of a dead reference', () => {
        const tmp = path.join(SRC, '__t182_probe.js');
        fs.writeFileSync(tmp, "// 'item_in_comment'\nconst a = 'item_oak_seed_renamed_probe';\nconst p = `item_${x}`;\n");
        try {
            const dead = deadIdReport([tmp], known);
            expect(dead).toEqual(['__t182_probe.js:2 names item_oak_seed_renamed_probe, which is not in data/items.json or data/tokens.json']);
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});
