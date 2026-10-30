import { getPaletteEntry } from '../../config/registries/modifierPalette.js';

/**
 * Rewrites a renamed library effect wherever content names it. A shared module because it must
 * run over two copies of the same content, like `skillIdMigration.js`: the game's `data/` (the JSON
 * loaders in `effectRegistry`, `tokenRegistry`, `itemRegistry`, and `perkTable.perkRowsOf`) and the
 * CMS workspace in the author's browser (`useEntityStore`, on every load path). If only the game
 * converted, the next "Sync to Game" would write the old id straight back into `data/`.
 *
 * ⚠️ Pure, because the CMS imports it.
 *
 * ⚠️ Never called from `registerEffects`, `registerTokenTypes` or the other test-fixture seams: a
 * fixture naming the old id would then pass while the game's code names the new one. It can go once
 * `data/` and the CMS workspace say the new id.
 *
 * ⚠️ No save needs it: the only renamed effect is a status, and every status ends with its fight
 * and is taken off on load (`BoardCombat`'s GAME_LOADED), so no save carries one past loading.
 *
 * Rules:
 * - The library entry moves to the new id, keeping its place; its name follows only while it is
 *   still the old name (an author's own name stays).
 * - Every reference moves with it: a bearer's `effects` list, a statement's `payload.effectId`
 *   (Applies, Removes), a status row's narrowing (Status Immunity, Status Stack Limit), a perk row,
 *   an enemy move's effect.
 * - ⚠️ A library already holding the new id keeps both entries as they are, and references still
 *   move to the new one: content that made its own Venom meant that one.
 * - Idempotent, and returns the SAME object when nothing changed, so a loader can call it on
 *   everything without copying content.
 */

/** Old effect id → its new id, and the name that moves with it while the author has not renamed it. */
export const EFFECT_ID_RENAMES = Object.freeze({
    // The Poison status is Venom (brief 280 V2): Poison is a damage type now.
    effect_poison: Object.freeze({ id: 'effect_venom', name: 'Venom', oldName: 'Poison' })
});

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** The id an effect id is read as: its new id when it was renamed, else itself. */
export function renamedEffectId(id) {
    return typeof id === 'string' && has(EFFECT_ID_RENAMES, id) ? EFFECT_ID_RENAMES[id].id : id;
}

/** A statement with every effect it names renamed; the same object when there is nothing to rename. */
function migrateStatement(statement) {
    const payload = statement?.payload;
    if (!payload || typeof payload !== 'object') return statement;
    let next = payload;
    const effectId = renamedEffectId(payload.effectId);
    if (effectId !== payload.effectId) next = { ...next, effectId };
    if (getPaletteEntry(payload.type)?.categories === 'status') {
        const category = renamedEffectId(payload.category);
        if (category !== payload.category) next = { ...next, category };
    }
    return next === payload ? statement : { ...statement, payload: next };
}

/** A list of statements migrated, or the same list when nothing changed. */
function migrateStatements(list) {
    if (!Array.isArray(list)) return list;
    const next = list.map(migrateStatement);
    return next.some((s, i) => s !== list[i]) ? next : list;
}

/** A bearer's `effects` list with renamed ids, or the same list. Tolerates bare string ids. */
function migrateRefs(list) {
    if (!Array.isArray(list)) return list;
    const next = list.map((ref) => {
        if (typeof ref === 'string') return renamedEffectId(ref);
        const effectId = renamedEffectId(ref?.effectId);
        return effectId !== ref?.effectId ? { ...ref, effectId } : ref;
    });
    return next.some((r, i) => r !== list[i]) ? next : list;
}

/** An enemy block with its moves' effects renamed, or the same block. */
function migrateEnemy(enemy) {
    if (!enemy || typeof enemy !== 'object' || !Array.isArray(enemy.moves)) return enemy;
    const moves = enemy.moves.map((move) => {
        const effectId = renamedEffectId(move?.effectId);
        return move && effectId !== move.effectId ? { ...move, effectId } : move;
    });
    return moves.some((m, i) => m !== enemy.moves[i]) ? { ...enemy, moves } : enemy;
}

/**
 * Every effect a definition names: a bearer's `effects` list and its inline `statements`, an enemy's
 * moves, and for a library entry its own statements. A library entry's own id and name move in
 * {@link migrateEffectLibrary}, which knows whether the new id is taken.
 * @param {object} def a Token, an item or a library entry
 * @returns {object} the same object when nothing changed
 */
export function migrateEffectIds(def) {
    if (!def || typeof def !== 'object') return def;
    const effects = migrateRefs(def.effects);
    const statements = migrateStatements(def.statements);
    const enemy = migrateEnemy(def.enemy);
    if (effects === def.effects && statements === def.statements && enemy === def.enemy) return def;
    const next = { ...def };
    if (effects !== def.effects) next.effects = effects;
    if (statements !== def.statements) next.statements = statements;
    if (enemy !== def.enemy) next.enemy = enemy;
    return next;
}

/**
 * The effect library with renamed entries under their new ids (each in the place the old one held)
 * and every reference inside it renamed.
 * @param {Record<string, object>} library
 * @returns {Record<string, object>} the same object when nothing changed
 */
export function migrateEffectLibrary(library) {
    if (!library || typeof library !== 'object') return library;
    let changed = false;
    const out = {};
    for (const [id, entry] of Object.entries(library)) {
        let key = id;
        let next = migrateEffectIds(entry);
        const rename = has(EFFECT_ID_RENAMES, id) ? EFFECT_ID_RENAMES[id] : null;
        if (rename && !has(library, rename.id)) {
            key = rename.id;
            next = {
                ...next,
                id: rename.id,
                ...(next?.name === rename.oldName ? { name: rename.name } : {})
            };
        }
        if (key !== id || next !== entry) changed = true;
        out[key] = next;
    }
    return changed ? out : library;
}

/** {@link migrateEffectIds} over a keyed collection (Tokens, items), or the same collection. */
export function migrateEffectIdsIn(collection) {
    if (!collection || typeof collection !== 'object') return collection;
    let changed = false;
    const out = {};
    for (const [id, def] of Object.entries(collection)) {
        const next = migrateEffectIds(def);
        if (next !== def) changed = true;
        out[id] = next;
    }
    return changed ? out : collection;
}

/** A perk collection (`{ skillId: { perks: [{ effectId }] } }`) with renamed effects, or the same one. */
export function migratePerkEffectIds(collection) {
    if (!collection || typeof collection !== 'object') return collection;
    let changed = false;
    const out = {};
    for (const [skillId, record] of Object.entries(collection)) {
        const perks = Array.isArray(record?.perks) ? migrateRefs(record.perks) : record?.perks;
        if (perks !== record?.perks) {
            changed = true;
            out[skillId] = { ...record, perks };
        } else {
            out[skillId] = record;
        }
    }
    return changed ? out : collection;
}
