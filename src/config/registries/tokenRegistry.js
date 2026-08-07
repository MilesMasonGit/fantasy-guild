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
 * They exist to make the engine testable. **Phase 9 replaces the contents
 * entirely** with the authored Woodland kit, so do not tune these numbers —
 * every one of them is thrown away. The art is skill icons standing in for
 * Token sprites, for the same reason.
 *
 * ## The execution config (Phase 4)
 * Adapted from the card schema, which was already a good fit (D-79):
 *
 * ```jsonc
 * config: {
 *   skill: 'nature',          // which skill gates and gains from it
 *   skillRequired: 1,         // ACCESS (D-67) — the only hero property that
 *                             // reaches the board this pass; Speed and
 *                             // Efficiency are deferred (roadmap G-1)
 *   cycleTimeMs: 20000,       // D-164's 10-30s band
 *   xp: 4,
 *   inputs:  [{ itemId, quantity }],   // pulled from the Bank automatically (D-24)
 *   outputs: [{ itemId, quantity, chance }]
 * }
 * ```
 *
 * **`requiresHero` defaults to true** (D-53). Passive Generators set it false
 * and must be **strictly worse** than the same job staffed (D-116, risk 11):
 * worse output *and* higher input cost. If an unstaffed Token ever beats a
 * staffed one per tile, the optimal board becomes mostly unstaffed and heroes
 * stop being the ceiling — which unpicks D-115, D-181 and §6.2 at once.
 *
 * A Token with **no `config`** is inert by design: Context, Buff and Structure
 * Tokens do their work by being adjacent to something (Phase 5), not by running.
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
    // --- Resource producers: create from nothing (D-51's authoring convention) ---
    token_forest: {
        id: 'token_forest', name: 'Forest', tokenType: 'resource',
        rarity: 'common', theme: 'woodland', uses: 5000, sprite: 'skill_nature',
        config: {
            skill: 'nature', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }]
        }
    },
    token_ore_vein: {
        id: 'token_ore_vein', name: 'Ore Vein', tokenType: 'resource',
        rarity: 'common', theme: 'woodland', uses: 4000, sprite: 'skill_industry',
        config: {
            skill: 'labor', skillRequired: 1, cycleTimeMs: 15000, xp: 5,
            inputs: [],
            outputs: [{ itemId: 'item_coal', quantity: 1, chance: 100 }]
        }
    },
    token_fishing_hole: {
        id: 'token_fishing_hole', name: 'Fishing Hole', tokenType: 'resource',
        rarity: 'common', theme: 'river', uses: 3000, sprite: 'skill_nautical',
        config: {
            skill: 'aquatic', skillRequired: 1, cycleTimeMs: 10000, xp: 3,
            inputs: [],
            outputs: [{ itemId: 'item_water', quantity: 3, chance: 100 }]
        }
    },

    // --- A transform: consumes, so it can starve. Exercises D-127. ---
    token_still: {
        id: 'token_still', name: 'Still', tokenType: 'station',
        rarity: 'uncommon', theme: 'woodland', uses: 600, sprite: 'skill_flask',
        config: {
            skill: 'alchemy', skillRequired: 1, cycleTimeMs: 18000, xp: 8,
            inputs: [{ itemId: 'item_oak_wood', quantity: 2 }],
            outputs: [{ itemId: 'item_glowcap', quantity: 1, chance: 100 }]
        }
    },

    // --- A deep consumer: needs FIVE where the Still needs two. This pair is
    //     what makes risk 13 measurable (D-127 starves expensive steps first). ---
    token_deep_kiln: {
        id: 'token_deep_kiln', name: 'Deep Kiln', tokenType: 'station',
        rarity: 'rare', theme: 'woodland', uses: 400, sprite: 'skill_culinary',
        config: {
            skill: 'forge', skillRequired: 1, cycleTimeMs: 18000, xp: 20,
            inputs: [{ itemId: 'item_oak_wood', quantity: 5 }],
            outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
        }
    },

    // --- Gated: exists to prove Access refuses (D-67). ---
    token_deep_mine: {
        id: 'token_deep_mine', name: 'Deep Mine', tokenType: 'resource',
        rarity: 'rare', theme: 'mountain', uses: 2000, sprite: 'skill_crime',
        config: {
            skill: 'labor', skillRequired: 25, cycleTimeMs: 20000, xp: 30,
            inputs: [],
            outputs: [{ itemId: 'item_coal', quantity: 6, chance: 100 }]
        }
    },

    // --- Passive Generator (D-116): NO hero, and deliberately worse than the
    //     staffed Forest above — half the output for 2.5x the time. Risk 11
    //     says an unstaffed Token must never beat a staffed one per tile. ---
    token_wind_trap: {
        id: 'token_wind_trap', name: 'Wind Trap', tokenType: 'passive',
        rarity: 'uncommon', theme: 'woodland', uses: 900, sprite: 'skill_social',
        requiresHero: false,
        config: {
            skill: 'nature', skillRequired: 0, cycleTimeMs: 30000, xp: 0,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 1, chance: 100 }]
        }
    },

    // --- A context-driven STATION: makes nothing on its own (D-18) ---
    // Its output is decided entirely by which schematic sits beside it. With no
    // context adjacent it makes nothing at all; with two, it is in conflict.
    token_forge: {
        id: 'token_forge', name: 'Forge', tokenType: 'station',
        rarity: 'uncommon', theme: 'woodland', uses: 700, sprite: 'skill_industry',
        config: { skill: 'forge', skillRequired: 1, cycleTimeMs: 16000, xp: 10 },
        recipes: [
            {
                id: 'helmet',
                requiresContext: ['ctx_helmet_schematic'],
                inputs: [{ itemId: 'item_coal', quantity: 1 }],
                outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
            },
            {
                id: 'plank',
                requiresContext: ['ctx_plank_schematic'],
                inputs: [{ itemId: 'item_oak_wood', quantity: 1 }],
                outputs: [{ itemId: 'item_glowcap', quantity: 2, chance: 100 }]
            }
        ]
    },
    token_helmet_schematic: {
        id: 'token_helmet_schematic', name: 'Helmet Schematic', tokenType: 'context',
        rarity: 'common', theme: 'woodland', uses: 40, sprite: 'skill_crime',
        provides: ['ctx_helmet_schematic']
    },
    token_plank_schematic: {
        id: 'token_plank_schematic', name: 'Plank Schematic', tokenType: 'context',
        rarity: 'common', theme: 'woodland', uses: 40, sprite: 'skill_flask',
        provides: ['ctx_plank_schematic']
    },

    // --- Inert by design: these work by ADJACENCY, not by running. ---
    //
    // ⚠️ Buff numbers here are deliberately TINY (D-119/D-120). A typical buff
    // nudges output a few percent. Real power comes from acquiring a better
    // Token, never from stacking modifiers — "eight Sawmills give eight times a
    // very small number, which is still a small number" (D-23).
    token_sawmill: {
        id: 'token_sawmill', name: 'Sawmill', tokenType: 'buff',
        rarity: 'common', theme: 'woodland', uses: 800, sprite: 'skill_occult',
        buff: {
            target: 'token',
            modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 0.05 }]
        }
    },
    token_tool_rack: {
        id: 'token_tool_rack', name: 'Tool Rack', tokenType: 'buff',
        rarity: 'common', theme: 'woodland', uses: 60, sprite: 'skill_industry',
        buff: {
            target: 'token',
            modifiers: [{ type: 'WORK_TIME', bucket: 'percentage', value: -0.10 }]
        }
    },
    token_shrine: {
        id: 'token_shrine', name: 'Shrine', tokenType: 'buff',
        rarity: 'rare', theme: 'woodland', uses: null, sprite: 'skill_social',
        // D-82: repetition would be degenerate here, so duplicates do not stack.
        noStackDuplicates: true,
        buff: {
            target: 'token',
            modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 0.10 }]
        }
    },
    token_campfire: {
        id: 'token_campfire', name: 'Campfire', tokenType: 'buff',
        rarity: 'uncommon', theme: 'woodland',
        // Unlimited use (D-176) — charges are per Token, independent of rarity.
        uses: null, sprite: 'skill_culinary',
        // Targets the HERO, not the Token (D-112). Hero buffs keep working
        // while that hero is idle (D-152) — "a Campfire helping a resting hero
        // is exactly when healing matters most", and it is what makes
        // retreat-and-recover a real tactic rather than just a way to stop
        // losing. Applied to the person in Phase 6, with combat.
        buff: {
            target: 'hero',
            modifiers: [{ type: 'HP_REGEN', bucket: 'flat', value: 1 }]
        }
    },
    token_lumber_camp: {
        id: 'token_lumber_camp', name: 'Lumber Camp', tokenType: 'structure',
        rarity: 'rare', theme: 'woodland',
        // Managers never deplete (D-140): a restocker needing restocking would
        // be exactly the chore it exists to remove.
        uses: null, sprite: 'skill_social'
    },
    token_bear: {
        id: 'token_bear', name: 'Bear', tokenType: 'enemy',
        rarity: 'common', theme: 'woodland', uses: 20, sprite: 'skill_occult'
        // Enemies run on the combat engine, not a work cycle (Phase 6).
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
