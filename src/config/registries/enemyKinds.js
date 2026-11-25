// Fantasy Guild — enemy kinds: the traits an enemy carries into every fight
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the Token
// editor's kind boxes and the audit read the kinds from here. Pure: no imports; the effect library is
// handed in.

/**
 * A kind is a trait an enemy always carries, discovered by the player in a fight, never shown as an
 * icon: an ordinary library effect (Armoured, Nimble, Swift, Brute) the author picks in the Token
 * editor's kind boxes. An enemy has none, one or two (`enemy.kinds: ['effect_armoured']`). Its
 * numbers go on the enemy's own aggregator for every fight (`systems/effects/enemyKindEffects.js`)
 * and add to the enemy's written lines like any effect's: Armoured's Crush 50 and the Crab's own
 * Crush −100 make Crush −50. A kind's fight-moment rules run as the enemy's passives.
 *
 * ⚠️ Until the content holds the four as library effects, a kind may still name a preset
 * ({@link ENEMY_KINDS}): `'armoured'`, or its effect's id while the library lacks it. A preset is
 * read as before (`enemyProfile.enemyFilledStats`): the level fills HP, hit, speed and XP; each preset
 * kind, in the order ticked, adds its resistances or Dodge, sets its speed and scales its hit (rounded
 * halves up, never below 1, a Brute at least 1 above the level); then a number the author typed
 * replaces the result outright, and a resistance the author wrote replaces the preset's for that type.
 * A preset's id is read as its effect once the library holds that effect.
 */

/**
 * The built-in presets, each with the library effect that replaces it.
 * @type {ReadonlyArray<{id: string, label: string, effectId: string, blurb: string, resistances?: Object<string, number>, dodge?: number, speed?: string, hitScale?: number, hitAtLeastMore?: number}>}
 */
export const ENEMY_KINDS = Object.freeze([
    Object.freeze({
        id: 'armoured', label: 'Armoured', effectId: 'effect_armoured',
        blurb: 'Resists Slash, Crush and Stab 50 %, and attacks every 4 s with its usual hit.',
        resistances: Object.freeze({ slash: 50, crush: 50, stab: 50 }), speed: 'slow'
    }),
    Object.freeze({
        id: 'nimble', label: 'Nimble', effectId: 'effect_nimble',
        blurb: '+15 Dodge: heroes miss it 15 points more often.',
        dodge: 15
    }),
    Object.freeze({
        id: 'swift', label: 'Swift', effectId: 'effect_swift',
        blurb: 'Small hits, attacks every 2 s: its hit × 2/3 (never below 1).',
        speed: 'fast', hitScale: 2 / 3
    }),
    Object.freeze({
        id: 'brute', label: 'Brute', effectId: 'effect_brute',
        blurb: 'Big hits, attacks every 4 s: its hit × 4/3, and at least 1 more than the level gives.',
        speed: 'slow', hitScale: 4 / 3, hitAtLeastMore: 1
    })
]);


/** How many kinds one enemy may carry. */
export const MAX_ENEMY_KINDS = 2;

const has = (library, id) => !!library && typeof id === 'string' && Object.prototype.hasOwnProperty.call(library, id) && !!library[id];

/** A preset by its id or by the id of the effect that replaces it, or null. */
export function getEnemyKind(id) {
    return ENEMY_KINDS.find(k => k.id === id || k.effectId === id) || null;
}

/** The library effect an authored kind is: the id itself when the library holds it, or a preset's effect once it does. */
export function kindEffectIdOf(id, library) {
    if (has(library, id)) return id;
    const preset = getEnemyKind(id);
    return preset && has(library, preset.effectId) ? preset.effectId : null;
}

/**
 * The kinds an enemy block carries, each once, in the order authored, at most
 * {@link MAX_ENEMY_KINDS}: `{ id, effectId, preset }`. A kind the library holds is that effect
 * (`effectId`, its id as `id`); one it does not hold but a preset names is the preset (`preset`, its id
 * as `id`); anything else is skipped (the audit names it).
 * @param {object} enemy a Token's `enemy` block
 * @param {object|null} [library] the effect library by id; without one, presets only
 * @returns {Array<{id: string, effectId: string|null, preset: object|null}>}
 */
export function enemyKindsOf(enemy, library = null) {
    const raw = Array.isArray(enemy?.kinds) ? enemy.kinds : [];
    const out = [];
    const seen = new Set();
    for (const id of raw) {
        const effectId = kindEffectIdOf(id, library);
        const preset = effectId ? null : getEnemyKind(id);
        if (!effectId && !preset) continue;
        const key = effectId || preset.effectId;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(effectId ? { id: effectId, effectId, preset: null } : { id: preset.id, effectId: null, preset });
        if (out.length >= MAX_ENEMY_KINDS) break;
    }
    return out;
}

/**
 * Whether two preset kinds cannot be carried together: both set a speed and the speeds differ
 * (Swift with Armoured or Brute). The editor refuses the pair; content that has one anyway lets the
 * later kind's speed win. Kinds that are effects never clash: their numbers add.
 */
export function kindsClash(a, b) {
    const ka = typeof a === 'string' ? getEnemyKind(a) : a;
    const kb = typeof b === 'string' ? getEnemyKind(b) : b;
    return !!(ka?.speed && kb?.speed && ka.speed !== kb.speed);
}
