// Fantasy Guild — one-off: inline statements → the named effect library (P1)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrateBearers } from '../src/systems/effects/effectMigration.js';

/**
 * Rewrites `data/tokens.json` to carry `effects` references, and writes the
 * library those references point at into `data/effects.json`.
 *
 *     node scripts/migrate-effects-library.mjs [--dry]
 *
 * ## ⚠️ This is not a licence to hand-edit `data/`
 * CMS-53 makes the CMS the exclusive authoring surface, and its sync is a
 * one-way full-file write: anything authored outside it is destroyed on the next
 * sync. That rule is intact. This script exists because a **migration** is the
 * one thing the CMS cannot do to the game's files alone — the CMS's own copy of
 * the content lives in the author's browser localStorage, so the two have to be
 * moved separately.
 *
 * They are moved by the *same function*. `migrateBearers` is imported here and
 * by `useEntityStore`, so the library this writes and the library the CMS builds
 * on its next load are identical, and the first sync afterwards is a no-op
 * rather than a silent unwind.
 *
 * Idempotent: a bearer that already carries `effects` is passed through
 * untouched, so running it twice does nothing the second time.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const tokensPath = join(dataDir, 'tokens.json');
const itemsPath = join(dataDir, 'items.json');
const effectsPath = join(dataDir, 'effects.json');

const dry = process.argv.includes('--dry');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Two spaces and a trailing newline — how every other file in `data/` is written. */
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const tokens = readJson(tokensPath);
const items = existsSync(itemsPath) ? readJson(itemsPath) : {};

/**
 * Item and Token ids resolve to their names so a generated name reads
 * "Bonus Copper Ore" rather than "Bonus item_copper_ore".
 */
const nameOf = (id) =>
    items[id]?.name ||
    tokens[id]?.name ||
    String(id || '')
        .replace(/^(item|token)_/, '')
        .split('_')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

/**
 * ⚠️ The existing `data/effects.json` is NOT read as a starting library.
 *
 * It is the card-era orphan: 56 entries keyed "0"–"55", each a name, a
 * `targetEntityTypes` list and a description, read by nothing since CMS-36
 * deleted the editor that wrote it. Seeding from it would carry 56 named
 * effects with no statements behind them straight into the new library —
 * every one of them a UE-10 violation, which is the precise failure the new
 * library exists not to repeat. So it is overwritten, not merged.
 */
const { effects, bearers, moved } = migrateBearers(tokens, { nameOf });

const entries = Object.keys(effects).length;
const users = Object.values(bearers).filter((t) => (t.effects || []).length).length;

console.log(`Tokens read:        ${Object.keys(tokens).length}`);
console.log(`Statements moved:   ${moved}`);
console.log(`Library entries:    ${entries}  (${moved - entries} were duplicates, now shared)`);
console.log(`Tokens referencing: ${users}`);
console.log('');

for (const [id, entry] of Object.entries(effects)) {
    const used = Object.entries(bearers)
        .filter(([, t]) => (t.effects || []).some((r) => r.effectId === id))
        .map(([tokenId]) => tokens[tokenId]?.name || tokenId);
    console.log(`  ${entry.name.padEnd(24)} ${String(used.length).padStart(2)} × — ${used.join(', ')}`);
}

if (dry) {
    console.log('\n--dry: nothing written.');
} else {
    writeJson(effectsPath, effects);
    writeJson(tokensPath, bearers);
    console.log('\nWrote data/effects.json and data/tokens.json.');
}
