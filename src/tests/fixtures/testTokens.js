// Fantasy Guild — Token fixtures for the engine test suites

import { registerTokenTypes } from '../../config/registries/tokenRegistry.js';

/**
 * Stable Tokens with known numbers, for testing **engine behaviour**.
 *
 * ## Why these exist
 * Engine tests need to assert things like "a Token produces exactly 2 of its
 * output after exactly one cycle" and "the deep consumer starves while the
 * shallow one runs". Those assertions need *fixed* numbers.
 *
 * Before Phase 10 they used shipped content for that, and the result was that
 * **retuning a Token broke tests that were not about that Token** — changing
 * the Oakwood Grove's yield failed assertions in `TokenCycle`, `Managers` and
 * `AdjacencyEffects` alike. Phase 9 reported that as the real shape of risk 17:
 * hand-authored numbers do not scale, and they scale far worse when touching
 * one breaks twenty tests across three files.
 *
 * The split is now:
 *
 * | Suite | Runs against | Asks |
 * | :-- | :-- | :-- |
 * | Engine suites | **these fixtures** | does the machinery work? |
 * | `ContentRules.test.js` | **shipped content** | is the content well-formed? |
 *
 * So the balance pass can retune every number in `tokenRegistry.js` freely, and
 * the only suite that should react is the one whose job is to react.
 *
 * ## Conventions
 * * Every id is prefixed **`fixture_`** — it can never collide with content,
 *   and content validation filters the prefix defensively.
 * * Numbers here are chosen to be *legible in an assertion*, not balanced.
 *   A 12s cycle and a 2-unit yield exist so `run(13000)` means "one cycle" at
 *   a glance. **Do not tune these for game feel; they are instruments.**
 * * They use real item ids, because `InventoryManager` and the sprite layer
 *   both key off them.
 *
 * ⚠️ **Changing a number here changes what the engine tests mean.** If a test
 * starts failing after an edit to this file, the fixture is the suspect, not
 * the engine.
 */

/** The canonical simple producer: 2 output every 12s, consumes nothing. */
export const FIXTURE_TOKENS = {
    fixture_producer: {
        id: 'fixture_producer', name: 'Fixture Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 5000, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }]
        }
    },

    /**
     * Yields a RANGE rather than a fixed amount (CMS-41).
     *
     * 1–5 is deliberately wide: a narrow range would let a broken roll (always
     * min, always max, off-by-one bounds) pass by luck across a few cycles.
     */
    fixture_range_producer: {
        id: 'fixture_range_producer', name: 'Fixture Range Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 5000, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [],
            outputs: [{ itemId: 'item_yew_log', minQty: 1, maxQty: 5, chance: 100 }]
        }
    },

    /** A second producer of a DIFFERENT item, for per-item shortfall tests. */
    fixture_producer_alt: {
        id: 'fixture_producer_alt', name: 'Fixture Alt Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 4000, sprite: 'skill_industry',
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 15000, xp: 5,
            inputs: [],
            outputs: [{ itemId: 'item_copper_ore', quantity: 2, chance: 100 }]
        }
    },

    /** Shallow consumer: needs 2. Pairs with the deep one for risk 13. */
    fixture_consumer: {
        id: 'fixture_consumer', name: 'Fixture Consumer', tokenType: 'station',
        rarity: 'uncommon', theme: 'fixture', uses: 600, sprite: 'skill_flask',
        config: {
            skill: 'alchemy', skillRequired: 1, cycleTimeMs: 18000, xp: 8,
            inputs: [{ itemId: 'item_oak_wood', quantity: 2 }],
            outputs: [{ itemId: 'item_glowcap', quantity: 1, chance: 100 }]
        }
    },

    /**
     * Deep consumer: needs 5 where the shallow one needs 2.
     *
     * ⚠️ This pair is the instrument for **risk 13** — under D-127's first-come
     * allocation the *expensive* chain starves first, which is the opposite of
     * the pressure the design intends. The 2-vs-5 gap is what makes that
     * measurable, so keep it.
     */
    fixture_deep_consumer: {
        id: 'fixture_deep_consumer', name: 'Fixture Deep Consumer', tokenType: 'station',
        rarity: 'rare', theme: 'fixture', uses: 400, sprite: 'skill_culinary',
        config: {
            skill: 'smithing', skillRequired: 1, cycleTimeMs: 18000, xp: 20,
            inputs: [{ itemId: 'item_oak_wood', quantity: 5 }],
            outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
        }
    },

    /** Skill-gated, for Access (D-67). Requires 25; nothing else does. */
    fixture_gated: {
        id: 'fixture_gated', name: 'Fixture Gated', tokenType: 'resource',
        rarity: 'rare', theme: 'fixture', uses: 2000, sprite: 'skill_crime',
        config: {
            skill: 'mining', skillRequired: 25, cycleTimeMs: 20000, xp: 30,
            inputs: [],
            outputs: [{ itemId: 'item_coal', quantity: 6, chance: 100 }]
        }
    },

    /**
     * Needs a hero, but sets **no** skill level (`skillRequired: 0`).
     *
     * Exists for the Skill & Class rework's Phase 0 baseline. `BoardRunner`
     * returns early on `required <= 0` and never consults the hero's skills at
     * all, so today **any** hero works this — including one who does not hold
     * `crafting`. Possession (Phase 1) is what closes that.
     */
    fixture_ungated: {
        id: 'fixture_ungated', name: 'Fixture Ungated', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 2000, sprite: 'skill_industry',
        config: {
            skill: 'crafting', skillRequired: 0, cycleTimeMs: 10000, xp: 3,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 1, chance: 100 }]
        }
    },

    /** Passive Generator: no hero, and deliberately far worse than the producer. */
    fixture_passive: {
        id: 'fixture_passive', name: 'Fixture Passive', tokenType: 'passive',
        rarity: 'uncommon', theme: 'fixture', uses: 900, sprite: 'skill_social',
        requiresHero: false,
        config: {
            skill: 'logging', skillRequired: 0, cycleTimeMs: 30000, xp: 0,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 1, chance: 100 }]
        }
    },

    /** Context-driven station with two recipes, for D-18 and D-20. */
    fixture_station: {
        id: 'fixture_station', name: 'Fixture Station', tokenType: 'station',
        rarity: 'uncommon', theme: 'fixture', uses: 700, sprite: 'skill_industry',
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 16000, xp: 10 },
        recipes: [
            {
                id: 'recipe_a',
                requiresContext: ['ctx_fixture_a'],
                inputs: [{ itemId: 'item_coal', quantity: 1 }],
                outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
            },
            {
                id: 'recipe_b',
                requiresContext: ['ctx_fixture_b'],
                inputs: [{ itemId: 'item_oak_wood', quantity: 1 }],
                outputs: [{ itemId: 'item_glowcap', quantity: 2, chance: 100 }]
            }
        ]
    },

    fixture_context_a: {
        id: 'fixture_context_a', name: 'Fixture Context A', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 40, sprite: 'skill_crime',
        provides: ['ctx_fixture_a']
    },
    fixture_context_b: {
        id: 'fixture_context_b', name: 'Fixture Context B', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 40, sprite: 'skill_flask',
        provides: ['ctx_fixture_b']
    },

    /** A TOOL context (D-213): gates whether, not what. */
    fixture_tool: {
        id: 'fixture_tool', name: 'Fixture Tool', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 80, sprite: 'skill_industry',
        isTool: true,
        provides: ['ctx_fixture_tool']
    },
    /** A resource that does nothing without the tool beside it. */
    fixture_tool_gated: {
        id: 'fixture_tool_gated', name: 'Fixture Tool-Gated', tokenType: 'resource',
        rarity: 'uncommon', theme: 'fixture', uses: 2600, sprite: 'skill_nature',
        config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 18000, xp: 12 },
        recipes: [{
            id: 'gated',
            requiresContext: ['ctx_fixture_tool'],
            inputs: [],
            outputs: [{ itemId: 'item_yew_log', quantity: 3, chance: 100 }]
        }]
    },

    // --- Buffs. Values chosen so the arithmetic is checkable by hand: +5% and
    //     +10% must resolve to ×1.15 in ONE bucket, never ×1.05 × ×1.10.
    fixture_buff_yield: {
        id: 'fixture_buff_yield', name: 'Fixture Yield Buff', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: 800, sprite: 'skill_occult',
        buff: {
            target: 'token',
            modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 0.05 }]
        }
    },
    fixture_buff_speed: {
        id: 'fixture_buff_speed', name: 'Fixture Speed Buff', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: 60, sprite: 'skill_industry',
        buff: {
            target: 'token',
            modifiers: [{ type: 'WORK_TIME', bucket: 'percentage', value: -0.10 }]
        }
    },
    /** Unlimited use, and duplicates deliberately do not stack (D-82). */
    fixture_buff_unique: {
        id: 'fixture_buff_unique', name: 'Fixture Unique Buff', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social',
        noStackDuplicates: true,
        buff: {
            target: 'token',
            modifiers: [{ type: 'YIELD', bucket: 'percentage', value: 0.10 }]
        }
    },
    /** Targets the HERO rather than the Token (D-112). */
    fixture_buff_hero: {
        id: 'fixture_buff_hero', name: 'Fixture Hero Buff', tokenType: 'buff',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_culinary',
        buff: {
            target: 'hero',
            modifiers: [{ type: 'HP_REGEN', bucket: 'flat', value: 1 }]
        }
    },

    /** Manager over the fixture producer, for D-151. */
    fixture_manager: {
        id: 'fixture_manager', name: 'Fixture Manager', tokenType: 'manager',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social',
        manages: ['fixture_producer']
    },
    /** A manager for the enemy fixture, proving D-104's one economic model. */
    fixture_enemy_manager: {
        id: 'fixture_enemy_manager', name: 'Fixture Enemy Manager', tokenType: 'manager',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_crime',
        manages: ['fixture_enemy']
    },

    /**
     * Enemy fixture.
     *
     * ⚠️ Points at `enemy_thorn_elemental` from `data/enemies.json` rather than
     * anything in `enemyRegistry.js`, because only the four dynamic enemies
     * drop real `item_*` ids — the eighteen static ones drop legacy ids that do
     * not exist, so a kill silently yields no loot (found in Phase 9).
     */
    fixture_enemy: {
        id: 'fixture_enemy', name: 'Fixture Enemy', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 20, sprite: 'skill_occult',
        enemyId: 'enemy_thorn_elemental'
    },

    /** Mythic, for D-177's one-placed rule. */
    fixture_mythic: {
        id: 'fixture_mythic', name: 'Fixture Mythic', tokenType: 'resource',
        rarity: 'mythic', theme: 'fixture', uses: 8000, sprite: 'skill_occult',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 10000, xp: 25,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 8, chance: 100 }]
        }
    },

    /** A Market, for the currency-output path (D-141). */
    fixture_market: {
        id: 'fixture_market', name: 'Fixture Market', tokenType: 'market',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_social',
        config: {
            skill: 'commerce', skillRequired: 1, cycleTimeMs: 15000, xp: 6,
            inputs: [{ itemId: 'item_oak_wood', quantity: 10 }],
            outputs: [{ currency: 'gold', quantity: 34, chance: 100 }]
        }
    }
};

// Registered on import. Vitest isolates module registries per test file, so a
// suite that does not import this never sees them.
registerTokenTypes(FIXTURE_TOKENS);

/** Every fixture id, for assertions that need to enumerate them. */
export const FIXTURE_IDS = Object.keys(FIXTURE_TOKENS);
