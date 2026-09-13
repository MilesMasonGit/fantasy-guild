// Fantasy Guild — inline statements → the named library (Unified Effects, P1)

import { KEYWORD, statementsOf } from './statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { EFFECT_ID_PREFIX } from './effectLibrary.js';

/**
 * The one-time move of every inline statement into a named library entry.
 *
 * ## Why this is a shared module and not a script
 * It has to run **twice, over two different copies of the same content**:
 *
 * 1. `scripts/migrate-effects-library.mjs` rewrites `data/tokens.json` and
 *    writes `data/effects.json`, so the game loads the new shape.
 * 2. `cms/src/stores/useEntityStore.js` rewrites the CMS's own workspace, which
 *    lives in the author's **browser localStorage** and cannot be reached from
 *    a script at all.
 *
 * If those two produced different libraries, the next "Sync to Game" would
 * overwrite the migrated data files with the CMS's divergent version and the
 * work would silently unwind. One function, called from both, is the only way
 * that cannot happen.
 *
 * ⚠️ Pure, for the same reason `effectLibrary.js` is: the CMS imports it.
 *
 * ## Identical statements become ONE entry
 * This is the migration's whole value beyond bookkeeping. Nine of the twenty-one
 * shipped statements are `Acts as` capability grants and several are
 * character-for-character identical, so deduplicating turns them into one named
 * *Pickaxe* that four Tokens share — which is the state the library exists to
 * make possible, reached without the owner re-authoring anything.
 *
 * Two statements are the same when everything except their `id` matches.
 *
 * ## One statement, one entry
 * UE-4 allows an entry to hold several statements, but nothing here can guess
 * which of a Token's two statements were meant as one named idea. So the
 * migration makes one entry per distinct statement and leaves grouping to the
 * owner, who can merge them in the CMS. A conservative split is undoable; a
 * wrong grouping is a rule that silently means something else.
 *
 * ## The names are provisional and the owner is expected to rename them
 * A generated name is honest about the mechanism and dull about everything else
 * — *Pickaxe*, *Yield Bonus*, *Mining Station*. It is a starting point, not a
 * judgement about what the effect should be called, and renaming one in the CMS
 * updates every bearer at once (UE-5).
 */

/** `Copper Ore` → `copper_ore`. Local and tiny; the CMS's own slug is not pure. */
function slug(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'effect';
}

/** `copper_ore` → `Copper Ore`, for turning an id into words when no name exists. */
function titleCase(text) {
    return String(text || '')
        .replace(/^(item|token|status)_/, '')
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * A provisional name for one statement.
 *
 * Deliberately describes the **mechanism**, not the fiction: this cannot know
 * that a Token's Bonus Drop is "the Shrimp Trawler", and a generated name that
 * guessed at flavour would be a hand-written description by the back door —
 * the exact thing UE-8 exists to prevent. Dull and true, then renamed by a
 * person who knows what it is.
 *
 * @param {object} statement
 * @param {(id: string) => string} nameOf — resolves an item/token id to its name
 */
export function provisionalName(statement, nameOf = titleCase) {
    const payload = statement?.payload || {};

    switch (statement?.keyword) {
        case KEYWORD.ACTS_AS: {
            const tag = titleCase(payload.tag) || 'Capability';
            return Number(payload.tier) > 1 ? `${tag} Tier ${payload.tier}` : tag;
        }
        case KEYWORD.REQUIRES:
            return `Needs ${titleCase(payload.tag) || 'a Capability'}`;
        case KEYWORD.STATION:
            return `${titleCase(payload.skill) || 'Station'} Station`;
        case KEYWORD.PROMOTES:
            return payload.jobId ? `${titleCase(payload.jobId)} Training` : 'Promotion';
        case KEYWORD.PROVIDES: {
            const entry = getPaletteEntry(payload.type);
            const label = entry?.label || titleCase(payload.type) || 'Effect';
            // `inverted` axes (Work Time) run backwards — a negative value is
            // the buff — so the direction word is read off the palette rather
            // than off the sign, which would label half of them wrongly.
            const positive = Number(payload.value) >= 0;
            const good = entry?.inverted ? !positive : positive;
            return `${label} ${good ? 'Bonus' : 'Penalty'}`;
        }
        case KEYWORD.GRANTS:
            return payload.itemId ? `Bonus ${nameOf(payload.itemId)}` : 'Bonus Drop';
        case KEYWORD.CONVERTS:
            return payload.produces?.[0]?.itemId
                ? `${nameOf(payload.produces[0].itemId)} Conversion`
                : 'Conversion';
        case KEYWORD.RESTOCKS:
            return 'Restocks Neighbours';
        case KEYWORD.APPLIES:
            return payload.statusId ? `Applies ${titleCase(payload.statusId)}` : 'Applies a Status';
        case KEYWORD.CANNOT:
            return 'Placement Limit';
        default:
            return 'Effect';
    }
}

/** Everything about a statement except its id — the dedup key. */
function fingerprint(statement) {
    const { id: _id, ...rest } = statement || {};
    return JSON.stringify(rest);
}

/**
 * Migrate a set of bearers.
 *
 * Bearers that already carry `effects` refs are passed through untouched, so
 * running this twice is a no-op rather than a second library.
 *
 * @param {Record<string, object>} bearers — tokens (or, from P4, items)
 * @param {object} options
 * @param {Record<string, object>} options.existing — a library to add to
 * @param {(id: string) => string} options.nameOf — id → display name
 * @returns {{ effects: Record<string, object>, bearers: Record<string, object>, moved: number }}
 */
export function migrateBearers(bearers = {}, { existing = {}, nameOf = titleCase } = {}) {
    const effects = { ...existing };
    const out = {};
    let moved = 0;

    // fingerprint → the entry id already created for it, so an identical
    // statement on a second Token reuses the first entry rather than making a
    // twin with a `_2` suffix.
    const byFingerprint = new Map();
    for (const [id, entry] of Object.entries(effects)) {
        for (const statement of statementsOf(entry)) {
            byFingerprint.set(fingerprint(statement), id);
        }
    }

    const uniqueId = (base) => {
        let candidate = base;
        let n = 2;
        while (effects[candidate]) candidate = `${base}_${n++}`;
        return candidate;
    };

    for (const [bearerId, def] of Object.entries(bearers)) {
        const statements = statementsOf(def);

        // Already migrated, or nothing to move.
        if (!statements.length) {
            out[bearerId] = def;
            continue;
        }

        const refs = [];
        for (const statement of statements) {
            const print = fingerprint(statement);
            let effectId = byFingerprint.get(print);

            if (!effectId) {
                const name = provisionalName(statement, nameOf);
                effectId = uniqueId(`${EFFECT_ID_PREFIX}_${slug(name)}`);
                effects[effectId] = {
                    id: effectId,
                    name,
                    // The statement keeps its original id, so any live save's
                    // per-statement upkeep and cooldown state still matches.
                    statements: [{ ...statement }],
                    autoSyncId: true
                };
                byFingerprint.set(print, effectId);
            }

            // One bearer never names an entry twice (`duplicateRefsOf`): a Token
            // carrying the same statement verbatim in two places collapses to a
            // single ref rather than an unresolvable pair.
            if (!refs.some(ref => ref.effectId === effectId)) {
                refs.push({ effectId, scale: 1 });
            }
            moved += 1;
        }

        const next = { ...def, effects: [...(def.effects || []), ...refs] };
        delete next.statements;
        out[bearerId] = next;
    }

    return { effects, bearers: out, moved };
}
