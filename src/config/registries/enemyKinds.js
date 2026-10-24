// Fantasy Guild — enemy kinds: the presets an author ticks on an enemy
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the Token
// editor's Kinds checkboxes and the audit read the kinds from here. Pure: no imports.

/**
 * A kind is a twist on an enemy's numbers, discovered by the player in a fight, never shown as an
 * icon. An enemy has none, one or two (`enemy.kinds: ['armoured', 'swift']`).
 *
 * How a kind combines with the level table (`enemyProfile.enemyProfileOf`), in this order:
 *   1. the level fills HP, hit, armour, speed and XP (older content's `budgetScale` scales HP, hit
 *      and XP);
 *   2. each kind, in the order ticked, adds its armour or Dodge, sets its speed and scales its
 *      hit (a hit is rounded halves up and is never below 1);
 *   3. a number the author typed on the enemy replaces the result outright.
 * Kinds never change HP or XP.
 *
 * Swift and Brute keep about the same damage per second as the level's normal swing, by the same
 * rule weapons follow (a fast swing hits about 2/3 as hard, a slow one about 4/3); a Brute always
 * hits at least 1 harder than the level. Armoured gives up a quarter of its damage per second
 * (slow, same hit) for its armour.
 */

/** @type {ReadonlyArray<{id: string, label: string, blurb: string, armor?: number, dodge?: number, speed?: string, hitScale?: number, hitAtLeastMore?: number, statusOnHit?: object}>} */
export const ENEMY_KINDS = Object.freeze([
    Object.freeze({
        id: 'armoured', label: 'Armoured',
        blurb: '+2 armour, and swings slowly (every 4 s) with its usual hit.',
        armor: 2, speed: 'slow'
    }),
    Object.freeze({
        id: 'nimble', label: 'Nimble',
        blurb: '+15 Dodge: heroes miss it 15 points more often.',
        dodge: 15
    }),
    Object.freeze({
        id: 'swift', label: 'Swift',
        blurb: 'Small hits every 2 s: its hit × 2/3 (never below 1).',
        speed: 'fast', hitScale: 2 / 3
    }),
    Object.freeze({
        id: 'brute', label: 'Brute',
        blurb: 'Big hits every 4 s: its hit × 4/3, and at least 1 more than the level gives.',
        speed: 'slow', hitScale: 4 / 3, hitAtLeastMore: 1
    }),
    Object.freeze({
        /**
         * ⚠️ Wired to the old status engine's Poison through the attack processor's `statusOnHit`,
         * the hook that exists today; the real Poison (3 stacks, 1 a tick, ends with the fight) is
         * built in the Rules system later and replaces what this lands.
         */
        id: 'venomous', label: 'Venomous',
        blurb: 'Poisons the hero with every hit it lands.',
        statusOnHit: Object.freeze({ statusId: 'poison', chance: 1, stacks: 1 })
    })
]);

/** How many kinds one enemy may carry. */
export const MAX_ENEMY_KINDS = 2;

/** A kind by id, or null. */
export function getEnemyKind(id) {
    return ENEMY_KINDS.find(k => k.id === id) || null;
}

/**
 * The kinds an enemy block carries, as kind definitions: known ids only, each once, in the order
 * authored, at most {@link MAX_ENEMY_KINDS}.
 */
export function enemyKindsOf(enemy) {
    const raw = Array.isArray(enemy?.kinds) ? enemy.kinds : [];
    const out = [];
    for (const id of raw) {
        const kind = getEnemyKind(id);
        if (kind && !out.includes(kind)) out.push(kind);
        if (out.length >= MAX_ENEMY_KINDS) break;
    }
    return out;
}

/**
 * Whether two kinds cannot be carried together: both set a speed and the speeds differ (Swift with
 * Armoured or Brute). The editor refuses the pair; content that has one anyway lets the later kind's
 * speed win.
 */
export function kindsClash(a, b) {
    const ka = typeof a === 'string' ? getEnemyKind(a) : a;
    const kb = typeof b === 'string' ? getEnemyKind(b) : b;
    return !!(ka?.speed && kb?.speed && ka.speed !== kb.speed);
}
