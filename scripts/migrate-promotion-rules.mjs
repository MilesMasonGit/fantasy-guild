// Fantasy Guild — one-off: a Token's `promotion` field → a Promotes rule (Promotes rule P2)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migratePromotionFields } from '../src/systems/effects/effectMigration.js';

/**
 * Moves every Token carrying the retired `promotion: { jobId }` field onto a
 * library effect holding a Promotes rule, and writes both files.
 *
 *     node scripts/migrate-promotion-rules.mjs [--dry]
 *
 * ## ⚠️ This is not a licence to hand-edit `data/`
 * The CMS is the exclusive authoring surface, and its sync is a one-way
 * full-file write. A **migration** is the one thing it cannot do to the game's
 * files alone, because its own copy of the content lives in the author's
 * browser storage — so the two copies are moved separately, by the SAME
 * function (`migratePromotionFields`), which `useEntityStore` also calls on
 * load. The next sync afterwards is then a no-op rather than an unwind.
 *
 * Unlike `migrate-effects-library.mjs`, this ADDS to the existing library
 * rather than replacing it: `data/effects.json` is the real library now.
 *
 * Idempotent: with no `promotion` field left anywhere, it writes nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const tokensPath = join(dataDir, 'tokens.json');
const effectsPath = join(dataDir, 'effects.json');

const dry = process.argv.includes('--dry');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Two spaces and a trailing newline — how every other file in `data/` is written. */
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const tokens = readJson(tokensPath);
const existing = readJson(effectsPath);

const { effects, tokens: next, moved } = migratePromotionFields(tokens, { existing });

console.log(`Tokens read:          ${Object.keys(tokens).length}`);
console.log(`Promotion fields moved: ${moved}`);
for (const [id, def] of Object.entries(tokens)) {
    if (!Object.prototype.hasOwnProperty.call(def || {}, 'promotion')) continue;
    const after = next[id];
    const refs = (after?.effects || []).map((r) => r.effectId || r);
    const added = refs.filter((r) => !(def.effects || []).some((old) => (old.effectId || old) === r));
    console.log(`  ${def.name || id}: ${JSON.stringify(def.promotion)} → ${added.length ? added.map((r) => `${effects[r]?.name} (${r})`).join(', ') : 'left as it was'}`);
}
const created = Object.keys(effects).filter((id) => !existing[id]);
console.log(`Library entries added: ${created.length}${created.length ? ` — ${created.join(', ')}` : ''}`);

if (moved === 0) {
    console.log('\nNothing to migrate; nothing written.');
} else if (dry) {
    console.log('\n--dry: nothing written.');
} else {
    writeJson(effectsPath, effects);
    writeJson(tokensPath, next);
    console.log('\nWrote data/effects.json and data/tokens.json.');
}
