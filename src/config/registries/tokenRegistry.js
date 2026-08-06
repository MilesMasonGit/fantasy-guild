// Fantasy Guild — Token definitions (7×7 Playmat rework, Phase 2)

/**
 * The Token registry — the *type* half of "a Token is a definition plus board
 * state" (D-79). Board state lives on the instance (see `BoardState.js`); this
 * holds everything true of every copy.
 *
 * The name is free because the deck loop's card-mutator `TokenRegistry.js` was
 * deleted in Phase 1. It stamped modifiers onto deck slot indices and had
 * nothing to do with board objects.
 *
 * ## ⚠️ These are PLACEHOLDERS
 * Phase 2 builds placement — putting things on tiles and shoving them around —
 * and needs objects to place. It does not need them to *do* anything, and
 * nothing here has cycle timing, inputs, outputs or skill requirements yet.
 *
 * **Phase 4** extends this shape with the execution config (cycle time, inputs,
 * outputs, XP, `skillRequired`). **Phase 9** replaces the contents entirely with
 * the authored Woodland kit. Do not tune these numbers — they exist to make
 * drag-and-drop testable, and every one of them is thrown away.
 *
 * The art is skill icons standing in for Token sprites, for the same reason.
 *
 * ## The shape, and the three independent axes (D-175, D-176, D-95)
 * ```
 * RARITY  →  how often you find it   (a drop-frequency label, nothing more)
 * CHARGES →  how long it lasts       (per-Token, independent of rarity)
 * THEME   →  how strong it is        (Woodland < River < Volcanic)
 * ```
 * Rarity is **not** a power tier and must never become one: it exists so a
 * Mythic landing in a Map burst reads as exciting. A Common Volcanic producer
 * can far outproduce a Rare Woodland one.
 */

/** @type {Record<string, object>} */
const TOKENS = {
    token_forest: {
        id: 'token_forest',
        name: 'Forest',
        tokenType: 'resource',
        rarity: 'common',
        theme: 'woodland',
        uses: 5000,
        sprite: 'skill_nature'
    },
    token_ore_vein: {
        id: 'token_ore_vein',
        name: 'Ore Vein',
        tokenType: 'resource',
        rarity: 'common',
        theme: 'woodland',
        uses: 4000,
        sprite: 'skill_industry'
    },
    token_sawmill: {
        id: 'token_sawmill',
        name: 'Sawmill',
        tokenType: 'context',
        rarity: 'common',
        theme: 'woodland',
        uses: 800,
        sprite: 'skill_crime'
    },
    token_campfire: {
        id: 'token_campfire',
        name: 'Campfire',
        tokenType: 'buff',
        rarity: 'uncommon',
        theme: 'woodland',
        // Unlimited use (D-176) — charges are decided per Token, independently
        // of rarity, and this one exists to prove `null` survives the round trip.
        uses: null,
        sprite: 'skill_culinary'
    },
    token_bear: {
        id: 'token_bear',
        name: 'Bear',
        tokenType: 'enemy',
        rarity: 'common',
        theme: 'woodland',
        uses: 20,
        sprite: 'skill_occult'
    },
    token_lumber_camp: {
        id: 'token_lumber_camp',
        name: 'Lumber Camp',
        tokenType: 'structure',
        rarity: 'rare',
        theme: 'woodland',
        // Managers never deplete (D-140): a restocker that needed restocking
        // would be exactly the chore it exists to remove.
        uses: null,
        sprite: 'skill_social'
    },
    token_still: {
        id: 'token_still',
        name: 'Still',
        tokenType: 'station',
        rarity: 'uncommon',
        theme: 'woodland',
        uses: 600,
        sprite: 'skill_flask'
    },
    token_fishing_hole: {
        id: 'token_fishing_hole',
        name: 'Fishing Hole',
        tokenType: 'resource',
        rarity: 'common',
        theme: 'river',
        uses: 3000,
        sprite: 'skill_nautical'
    }
};

/** A Token definition by id, or null. */
export function getTokenType(typeId) {
    return TOKENS[typeId] || null;
}

/** Every Token definition, keyed by id. */
export function getAllTokenTypes() {
    return TOKENS;
}

/** Every Token id. */
export function listTokenTypeIds() {
    return Object.keys(TOKENS);
}

/** A Token's display name, falling back to its id so the UI never renders blank. */
export function tokenName(typeId) {
    return TOKENS[typeId]?.name || typeId || 'Unknown Token';
}

/**
 * A Token's starting charges — `null` for unlimited use (D-176).
 *
 * Deliberately returns `null` rather than `Infinity` or `0`: `null` and `0` are
 * opposites (never depletes vs spent), and every charge comparison has to check
 * `== null` first.
 */
export function tokenStartingUses(typeId) {
    const def = TOKENS[typeId];
    return def ? (def.uses ?? null) : null;
}

/** The sprite path for a Token's art. */
export function tokenSpritePath(typeId) {
    const sprite = TOKENS[typeId]?.sprite;
    return sprite ? `/assets/skills/${sprite}.png` : null;
}
