import { KEYWORD, statementsOf, makeStatement } from './statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { EFFECT_ID_PREFIX } from './effectLibrary.js';
import { ROLE } from '../../config/registries/roleRegistry.js';

/**
 * Moves every inline statement into a named library entry. A shared module because it must run over two copies of the same content:
 * the game's `data/` and the CMS workspace (`cms/src/stores/useEntityStore.js`) in the
 * author's browser localStorage. If the two produced different libraries, the next
 * "Sync to Game" would silently unwind the migration.
 *
 * ⚠️ Pure, because the CMS imports it.
 *
 * Identical statements (everything but `id`) become ONE entry, so shared capability grants
 * become one named effect many Tokens share. One entry per distinct statement: grouping is
 * left to the owner, since a wrong grouping silently changes a rule's meaning.
 *
 * Generated names describe the mechanism and are provisional; renaming one in the CMS
 * updates every bearer.
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
 * A provisional name for one statement. Deliberately describes the mechanism, not the
 * fiction: a generated name that guessed at flavour would be a hand-written description.
 *
 * @param {object} statement
 * @param {(id: string) => string} nameOf resolves an item/token id to its name
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
            // `inverted` axes (Work Time) run backwards (a negative value is the buff), so the
            // direction word is read off the palette rather than the sign.
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
 * Migrate a set of bearers. Bearers that already carry `effects` refs are passed through
 * untouched, so running this twice is a no-op rather than a second library.
 *
 * @param {Record<string, object>} bearers tokens or items
 * @param {object} options
 * @param {Record<string, object>} options.existing a library to add to
 * @param {(id: string) => string} options.nameOf id to display name
 * @returns {{ effects: Record<string, object>, bearers: Record<string, object>, moved: number }}
 */
export function migrateBearers(bearers = {}, { existing = {}, nameOf = titleCase } = {}) {
    const effects = { ...existing };
    const out = {};
    let moved = 0;

    // fingerprint -> entry id, so an identical statement on a second Token reuses the entry.
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

/**
 * A Token's `promotion` field becomes a library effect holding a Promotes rule, so nothing
 * already authored under the old field is lost.
 *
 * ⚠️ Run on the CMS workspace by `useEntityStore` like `migrateBearers`; if the CMS and `data/`
 * disagreed, the next "Sync to Game" would overwrite one with the other.
 *
 * ⚠️ Deterministic ids, not random ones: both copies run this independently, so anything
 * random (`newStatementId`) would give the same rule two ids and churn every sync. The
 * statement id comes from the job; the effect id from its name, made unique against the
 * library it is added to.
 *
 * Rules:
 * - A Token whose `promotion` names a job loses the field and gains a reference.
 * - Every Token promoting to the same job shares one effect; an existing effect holding
 *   exactly one Promotes rule for that job is reused.
 * - A Token whose field names no job is left exactly as it is.
 * - An unknown job still converts (the rule then reads loudly on screen).
 * - Idempotent: a Token with no `promotion` field passes through untouched.
 *
 * @param {Record<string, object>} tokens
 * @param {object} [options]
 * @param {Record<string, object>} [options.existing] the library to add to
 * @returns {{ effects: Record<string, object>, tokens: Record<string, object>, moved: number }}
 */
export function migratePromotionFields(tokens = {}, { existing = {} } = {}) {
    const effects = { ...existing };
    const out = {};
    let moved = 0;

    const effectFor = (jobId) => Object.keys(effects).find((id) => {
        const statements = statementsOf(effects[id]);
        return statements.length === 1
            && statements[0]?.keyword === KEYWORD.PROMOTES
            && statements[0]?.payload?.jobId === jobId;
    });

    const uniqueId = (base) => {
        let candidate = base;
        let n = 2;
        while (effects[candidate]) candidate = `${base}_${n++}`;
        return candidate;
    };

    for (const [tokenId, def] of Object.entries(tokens)) {
        const jobId = def?.promotion?.jobId;
        if (!def || !Object.prototype.hasOwnProperty.call(def, 'promotion') || typeof jobId !== 'string' || !jobId) {
            out[tokenId] = def;
            continue;
        }

        let effectId = effectFor(jobId);
        if (!effectId) {
            const statement = makeStatement(KEYWORD.PROMOTES, {
                id: `stm_promotes_${slug(jobId)}`,
                payload: { jobId }
            });
            const name = provisionalName(statement);
            effectId = uniqueId(`${EFFECT_ID_PREFIX}_${slug(name)}`);
            effects[effectId] = { id: effectId, name, statements: [statement], autoSyncId: true };
        }

        const refs = Array.isArray(def.effects) ? def.effects : [];
        const already = refs.some((ref) => (typeof ref === 'string' ? ref : ref?.effectId) === effectId);
        const next = { ...def, effects: already ? refs : [...refs, { effectId, scale: 1 }] };
        delete next.promotion;
        out[tokenId] = next;
        moved += 1;
    }

    return { effects, tokens: out, moved };
}

/**
 * The retired `payload.target` flag on `Applies` becomes the enemy role.
 *
 * - `target === 'enemy'` becomes `target: { role: 'opponent' }`, flag removed.
 * - `target === 'hero'` flag removed (with no role the rule already means the hero).
 * - No flag, another keyword, or any other value: returned as is. An unknown value is left
 *   in place on purpose; `ContentAudit` names it, which is louder than a guess.
 * - A statement that already names a role keeps it; only the flag goes.
 * - Idempotent, and returns the SAME object when there is nothing to change.
 *
 * ⚠️ On a Token rule the old flag preferred the enemy on the filtered tiles; migrated, it
 * means what the role means everywhere: the creature the hero in this moment is fighting.
 *
 * ⚠️ Called from two places like `migrateBearers`: the game registries on load
 * (`effectRegistry`, `tokenRegistry`) and the CMS store on every load path. If only the game
 * converted, the next "Sync to Game" would write the old flag back into `data/`.
 *
 * @param {object} statement
 * @returns {object}
 */
export function migrateAppliesTarget(statement) {
    if (statement?.keyword !== KEYWORD.APPLIES) return statement;
    const payload = statement.payload;
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'target')) return statement;
    if (payload.target !== 'enemy' && payload.target !== 'hero') return statement;

    const { target: flag, ...rest } = payload;
    const next = { ...statement, payload: rest };
    if (flag === 'enemy' && !statement.target?.role) {
        next.target = { ...(statement.target || {}), role: ROLE.OPPONENT };
    }
    return next;
}

/**
 * `migrateAppliesTarget` over one bearer or library entry's `statements`.
 * Returns the same object when no statement changed, so a loader can call it on
 * everything without copying content that never had the flag.
 */
export function migrateAppliesTargets(def) {
    const statements = statementsOf(def);
    if (!statements.length) return def;
    let changed = false;
    const next = statements.map((statement) => {
        const migrated = migrateAppliesTarget(statement);
        if (migrated !== statement) changed = true;
        return migrated;
    });
    return changed ? { ...def, statements: next } : def;
}

/** `migrateAppliesTargets` over a keyed collection (effects, tokens, items). */
export function migrateAppliesTargetsIn(collection = {}) {
    let changed = false;
    const out = {};
    for (const [id, def] of Object.entries(collection || {})) {
        out[id] = migrateAppliesTargets(def);
        if (out[id] !== def) changed = true;
    }
    return changed ? out : collection;
}
