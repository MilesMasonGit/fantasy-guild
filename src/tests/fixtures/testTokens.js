// Fantasy Guild — Token fixtures for the engine test suites

import { registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../../config/registries/recipePoolRegistry.js';
import { registerItems } from '../../config/registries/itemRegistry.js';
import './fixtureItems.js';
import { KEYWORD } from '../../systems/effects/statements.js';

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
 * * Item ids are registered through `registerItems` below rather than borrowed
 *   from content. `InventoryManager` and the sprite layer key off item ids, so
 *   the ids have to *resolve* — they do not have to be real. (Until 2026-08-26
 *   three of them were real, and renaming one in the CMS broke 24 assertions
 *   across 10 suites. See CR2-004.)
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
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
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
            outputs: [{ itemId: 'fixture_copper_ore', quantity: 2, chance: 100 }]
        }
    },

    /** Shallow consumer: needs 2. Pairs with the deep one for risk 13. */
    fixture_consumer: {
        id: 'fixture_consumer', name: 'Fixture Consumer', tokenType: 'station',
        rarity: 'uncommon', theme: 'fixture', uses: 600, sprite: 'skill_flask',
        config: {
            skill: 'alchemy', skillRequired: 1, cycleTimeMs: 18000, xp: 8,
            inputs: [{ itemId: 'fixture_oak_wood', quantity: 2 }],
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
            inputs: [{ itemId: 'fixture_oak_wood', quantity: 5 }],
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
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
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
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
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
                requiresContext: [{ tag: 'ctx_fixture_a', minTier: 1, chargeCost: 0 }],
                inputs: [{ itemId: 'item_coal', quantity: 1 }],
                outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
            },
            {
                id: 'recipe_b',
                requiresContext: [{ tag: 'ctx_fixture_b', minTier: 1, chargeCost: 0 }],
                inputs: [{ itemId: 'fixture_oak_wood', quantity: 1 }],
                outputs: [{ itemId: 'item_glowcap', quantity: 2, chance: 100 }]
            }
        ]
    },

    // --- Skill-pooled stations (CMS-39/76/77) -------------------------------
    // Two stations of the same skill, both drawing the SHARED pool below rather
    // than carrying recipes of their own. Authoring a recipe into the pool makes
    // it available to both at once, which is the whole point.

    fixture_kitchen: {
        id: 'fixture_kitchen', name: 'Fixture Kitchen', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 900, sprite: 'skill_flask',
        config: { skill: 'cooking', skillRequired: 1, cycleTimeMs: 16000, xp: 3 },
        recipePool: 'cooking'
    },
    fixture_camp_stove: {
        id: 'fixture_camp_stove', name: 'Fixture Camp Stove', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_flask',
        config: { skill: 'cooking', skillRequired: 1, cycleTimeMs: 16000, xp: 3 },
        recipePool: 'cooking'
    },

    /** The Kitchen mechanic's two axes (CMS-7): a Tool and a Cookbook. */
    fixture_pie_tin: {
        id: 'fixture_pie_tin', name: 'Fixture Pie Tin', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 60, sprite: 'skill_flask',
        provides: [{ tag: 'ctx_pie_tin', minTier: 1, chargeCost: 0 }]
    },
    fixture_cookbook: {
        id: 'fixture_cookbook', name: 'Fixture Cookbook', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 60, sprite: 'skill_flask',
        provides: [{ tag: 'ctx_berry_cookbook', minTier: 1, chargeCost: 0 }]
    },

    fixture_context_a: {
        id: 'fixture_context_a', name: 'Fixture Context A', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 40, sprite: 'skill_crime',
        provides: [{ tag: 'ctx_fixture_a', minTier: 1, chargeCost: 0 }]
    },
    fixture_context_b: {
        id: 'fixture_context_b', name: 'Fixture Context B', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 40, sprite: 'skill_flask',
        provides: [{ tag: 'ctx_fixture_b', minTier: 1, chargeCost: 0 }]
    },

    /** A TOOL context (D-213): gates whether, not what. */
    fixture_tool: {
        id: 'fixture_tool', name: 'Fixture Tool', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 80, sprite: 'skill_industry',
        isTool: true,
        provides: [{ tag: 'ctx_fixture_tool', minTier: 1, chargeCost: 0 }]
    },
    /** A resource that does nothing without the tool beside it. */
    fixture_tool_gated: {
        id: 'fixture_tool_gated', name: 'Fixture Tool-Gated', tokenType: 'resource',
        rarity: 'uncommon', theme: 'fixture', uses: 2600, sprite: 'skill_nature',
        config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 18000, xp: 12 },
        recipes: [{
            id: 'gated',
            requiresContext: [{ tag: 'ctx_fixture_tool', minTier: 1, chargeCost: 0 }],
            inputs: [],
            outputs: [{ itemId: 'item_yew_log', quantity: 3, chance: 100 }]
        }]
    },

    // --- Buffs. Values chosen so the arithmetic is checkable by hand: +5% and
    //     +10% must resolve to ×1.15 in ONE bucket, never ×1.05 × ×1.10.
    fixture_buff_yield: {
        id: 'fixture_buff_yield', name: 'Fixture Yield Buff', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: 800, sprite: 'skill_occult',
        statements: [
            { id: 'stm_buff_yield', keyword: 'provides', to: { mode: 'all' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 0.05 } }
        ]
    },
    fixture_buff_speed: {
        id: 'fixture_buff_speed', name: 'Fixture Speed Buff', tokenType: 'buff',
        rarity: 'common', theme: 'fixture', uses: 60, sprite: 'skill_industry',
        statements: [
            { id: 'stm_buff_speed', keyword: 'provides', to: { mode: 'all' },
              payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.10 } }
        ]
    },
    /** Unlimited use, and duplicates deliberately do not stack (D-82). */
    fixture_buff_unique: {
        id: 'fixture_buff_unique', name: 'Fixture Unique Buff', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social',
        noStackDuplicates: true,
        statements: [
            { id: 'stm_buff_unique', keyword: 'provides', to: { mode: 'all' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 0.10 } }
        ]
    },
    // --- Targeted buffs (CMS-17/18/23) --------------------------------------
    // Narrow target, large effect. A buff that only reaches one kind of Token
    // cannot be stacked onto everything indiscriminately, so it can afford real
    // weight — unlike the deliberately tiny untargeted buffs above.

    /** "Double all adjacent seafood" — targets by TAG. */
    fixture_buff_tag: {
        id: 'fixture_buff_tag', name: 'Fixture Tag Buff', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        statements: [
            { id: 'stm_buff_tag', keyword: 'provides', to: { mode: 'tag', value: 'seafood' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 1.0 } }
        ]
    },
    /** "Boost specifically the range producer" — targets by exact ID. */
    fixture_buff_id: {
        id: 'fixture_buff_id', name: 'Fixture Id Buff', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        statements: [
            { id: 'stm_buff_id', keyword: 'provides', to: { mode: 'id', value: 'fixture_producer' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 1.0 } }
        ]
    },
    /**
     * "Boost all adjacent stations" — the RETIRED `tokenType` mode.
     *
     * Not offered in the editor any more (owner decision Q2 replaced it with an
     * `all` tag), but still understood by `matchesTokenTarget` so that nothing
     * already authored quietly changes what it reaches.
     */
    fixture_buff_type: {
        id: 'fixture_buff_type', name: 'Fixture Type Buff', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        statements: [
            { id: 'stm_buff_type', keyword: 'provides', to: { mode: 'tokenType', value: 'station' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 1.0 } }
        ]
    },
    /** ⚠️ A typo'd mode must make the buff inert, never universal. */
    fixture_buff_bad_target: {
        id: 'fixture_buff_bad_target', name: 'Fixture Bad Target', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        statements: [
            { id: 'stm_buff_bad', keyword: 'provides', to: { mode: 'taggg', value: 'seafood' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 1.0 } }
        ]
    },
    /** A producer carrying a Token TAG, for tag-mode targeting. */
    fixture_seafood_producer: {
        id: 'fixture_seafood_producer', name: 'Fixture Seafood', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 3000, sprite: 'skill_nautical',
        tags: ['seafood'],
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [],
            outputs: [{ itemId: 'item_fish', quantity: 2, chance: 100 }]
        }
    },

    // --- Support axes (CMS-20). Probability axes use 100 so the roll is
    //     deterministic and the test asserts behaviour, not luck.
    fixture_buff_xp: {
        id: 'fixture_buff_xp', name: 'Fixture XP Buff', tokenType: 'buff',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_occult',
        statements: [
            { id: 'stm_buff_xp', keyword: 'provides', to: { mode: 'all' },
              payload: { type: 'XP_BONUS', bucket: 'percentage', value: 1.0 } }
        ]
    },
    fixture_buff_always_fails: {
        id: 'fixture_buff_always_fails', name: 'Fixture Always Fails', tokenType: 'buff',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_crime',
        statements: [
            { id: 'stm_buff_fails', keyword: 'provides', to: { mode: 'all' },
              payload: { type: 'FAIL_CHANCE', bucket: 'flat', value: 100 } }
        ]
    },
    fixture_buff_always_doubles: {
        id: 'fixture_buff_always_doubles', name: 'Fixture Always Doubles', tokenType: 'buff',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_social',
        statements: [
            { id: 'stm_always_doubles', keyword: 'provides', to: { mode: 'all' },
              payload: { type: 'LOOT_MULT', bucket: 'flat', value: 100 } }
        ]
    },

    // --- Statements (the effect-authoring grammar) ---------------------------

    /** TWO statements on one Token, aimed at different targets (CMS-58/65). */
    fixture_two_blocks: {
        id: 'fixture_two_blocks', name: 'Fixture Two Blocks', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
        statements: [
            { id: 'stm_two_a', keyword: 'provides', to: { mode: 'tag', value: 'seafood' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 1.0 } },
            { id: 'stm_two_b', keyword: 'provides', to: { mode: 'id', value: 'fixture_producer' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 0.5 } }
        ]
    },

    /** A statement with upkeep on its own clock (CMS-60): 1 Coal every 5s. */
    fixture_upkeep_aura: {
        id: 'fixture_upkeep_aura', name: 'Fixture Upkeep Aura', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_flask',
        statements: [
            {
                id: 'stm_upkeep_aura', keyword: 'provides', to: { mode: 'all' },
                upkeep: { items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 5000 },
                payload: { type: 'YIELD', bucket: 'percentage', value: 1.0 }
            }
        ]
    },

    /** Grants an item the neighbour does not make itself (CMS-27/72). */
    fixture_bonus_drop: {
        id: 'fixture_bonus_drop', name: 'Fixture Bonus Drop', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
        statements: [
            { id: 'stm_bonus_drop', keyword: 'grants', to: { mode: 'all' },
              payload: { type: 'BONUS_DROP', itemId: 'fixture_charcoal', chance: 100, quantity: 1 } }
        ]
    },

    // --- Triggered Tokens (CMS-29/30/33/35) ---------------------------------
    // The two worked examples the category was designed against.

    /**
     * **Masonry Wheelbarrow.** Reacts to a NEIGHBOUR completing a cycle and
     * grants an item — scoped to one specific neighbour type, so it does not
     * fire off just anything adjacent.
     */
    fixture_wheelbarrow: {
        id: 'fixture_wheelbarrow', name: 'Fixture Wheelbarrow', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
        statements: [{
            id: 'stm_wheelbarrow', keyword: 'grants',
            when: {
                event: 'CYCLE_COMPLETE',
                scope: 'adjacent',
                source: { mode: 'id', value: 'fixture_producer' },
                cooldownMs: 0
            },
            payload: { type: 'BONUS_DROP', itemId: 'item_bones', chance: 100, quantity: 1 }
        }]
    },

    /** Same, but reacting to ANY neighbour rather than a named one. */
    fixture_trigger_any: {
        id: 'fixture_trigger_any', name: 'Fixture Trigger Any', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
        statements: [{
            id: 'stm_trigger_any', keyword: 'grants',
            when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
            payload: { type: 'BONUS_DROP', itemId: 'item_bones', chance: 100, quantity: 1 }
        }]
    },

    /** Reacts to a neighbour running out of charges. */
    fixture_trigger_depleted: {
        id: 'fixture_trigger_depleted', name: 'Fixture Depletion Watcher', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
        statements: [{
            id: 'stm_depleted', keyword: 'grants',
            when: { event: 'TOKEN_DEPLETED', scope: 'adjacent', cooldownMs: 0 },
            payload: { type: 'BONUS_DROP', itemId: 'item_bones', chance: 100, quantity: 1 }
        }]
    },

    /**
     * **Stoneshaper Sigil.** No config and no hero — it does not cycle at all.
     * Watches the Bank globally (CMS-35) and converts on a cooldown.
     */
    fixture_sigil: {
        id: 'fixture_sigil', name: 'Fixture Sigil', tokenType: 'buff',
        rarity: 'mythic', theme: 'fixture', uses: null, sprite: 'skill_occult',
        statements: [{
            id: 'stm_sigil', keyword: 'converts',
            when: {
                event: 'ITEM_THRESHOLD', scope: 'global',
                watchItemId: 'item_coal', threshold: 2, cooldownMs: 10000
            },
            payload: {
                type: 'CONVERT',
                consumes: [{ itemId: 'item_coal', quantity: 2 }],
                produces: [{ itemId: 'fixture_charcoal', quantity: 1 }],
                chance: 100
            }
        }]
    },

    /** A triggered Token with finite charges, for CMS-26's wear rule. */
    fixture_trigger_wearing: {
        id: 'fixture_trigger_wearing', name: 'Fixture Wearing Trigger', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: 3, sprite: 'skill_industry',
        statements: [{
            id: 'stm_wearing', keyword: 'grants',
            when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
            // 0% chance: it serves but never hits, which is exactly the case
            // CMS-26 pins — the charge burns on service, not on luck.
            payload: { type: 'BONUS_DROP', itemId: 'item_bones', chance: 0, quantity: 1 }
        }]
    },

    /**
     * Carries the RETIRED `buff` shape, and therefore does nothing.
     *
     * Kept deliberately: `ContentAudit` must be able to see old-shape effect
     * data and say so, and `TileModifiers` must contribute nothing from it
     * rather than half-reading it.
     */
    fixture_buff_hero: {
        id: 'fixture_buff_hero', name: 'Fixture Hero Buff', tokenType: 'buff',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_culinary',
        buff: {
            target: 'hero',
            modifiers: [{ type: 'HP_REGEN', bucket: 'flat', value: 1 }]
        }
    },

    /** Manager over the fixture producer, for D-151 — the legacy `manages` field. */
    fixture_manager: {
        id: 'fixture_manager', name: 'Fixture Manager', tokenType: 'manager',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social',
        manages: ['fixture_producer']
    },

    /** The same Manager, authored as a **Restocks** statement (owner Q6). */
    fixture_restocker: {
        id: 'fixture_restocker', name: 'Fixture Restocker', tokenType: 'manager',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_social',
        statements: [
            { id: 'stm_restock', keyword: 'restocks', payload: { tokenIds: ['fixture_producer'] } }
        ]
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
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 8, chance: 100 }]
        }
    },

    /**
     * A Market, for the currency-output path (D-141).
     *
     * ⚠️ **Its numbers encode the owner's rule** (2026-08-20): *a Market pays
     * roughly a 20% premium over the Bank's sell price.* `item_market_goods`
     * has a `baseValue` of 10, so 10 of them sell raw for 100 and this Market
     * pays 120 — exactly `MARKET_PREMIUM`.
     *
     * It used to consume `item_oak_wood`, a **live content** item, and pay 34
     * against a raw value of 10. That 3.4× came from a comment claiming a
     * "3× / limit of 30" rule the owner never set. Both the fabricated ratio
     * and the dependence on shipped content are gone: the input is a fixture
     * with a fixed price, so retuning real content cannot move this instrument.
     */
    fixture_market: {
        id: 'fixture_market', name: 'Fixture Market', tokenType: 'market',
        rarity: 'uncommon', theme: 'fixture', uses: null, sprite: 'skill_social',
        config: {
            skill: 'commerce', skillRequired: 1, cycleTimeMs: 15000, xp: 6,
            inputs: [{ itemId: 'item_market_goods', quantity: 10 }],
            outputs: [{ currency: 'gold', quantity: 120, chance: 100 }]
        }
    },

    // --- Accepted Tokens & Tool Tier Fixtures ---
    fixture_pickaxe_t1: {
        id: 'fixture_pickaxe_t1', name: 'Fixture Copper Pickaxe', tokenType: 'support',
        rarity: 'common', tier: 1, uses: 10, provides: ['pickaxe'], sprite: 'skill_mining',
        isTool: true, requiresHero: false
    },
    fixture_pickaxe_t2: {
        id: 'fixture_pickaxe_t2', name: 'Fixture Iron Pickaxe', tokenType: 'support',
        rarity: 'common', tier: 2, uses: 10, provides: ['pickaxe'], sprite: 'skill_mining',
        isTool: true, requiresHero: false
    },
    fixture_copper_vein: {
        id: 'fixture_copper_vein', name: 'Fixture Copper Vein', tokenType: 'resource',
        rarity: 'common', uses: 100, sprite: 'skill_mining',
        acceptedTokens: [{ tag: 'pickaxe', minTier: 1 }],
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 5,
            inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
        }
    },
    fixture_iron_vein: {
        id: 'fixture_iron_vein', name: 'Fixture Iron Vein', tokenType: 'resource',
        rarity: 'common', uses: 100, sprite: 'skill_mining',
        acceptedTokens: [{ tag: 'pickaxe', minTier: 2 }],
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 10,
            inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
        }
    },
    fixture_coast: {
        id: 'fixture_coast', name: 'Fixture Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature',
        tags: ['Coast'],
        statements: [
            {
                id: 'stm_fixture_coast_limit',
                keyword: KEYWORD.CANNOT,
                payload: { kind: 'adjacency_limit', max: 2 },
                to: { mode: 'tag', value: 'Coast' },
                when: null,
                upkeep: null
            }
        ],
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 2,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    },
    fixture_plain_coast: {
        id: 'fixture_plain_coast', name: 'Fixture Plain Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 500, sprite: 'skill_nature',
        tags: ['Coast'],
        config: {
            skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 2,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    }
};

/**
 * The shared Cooking pool both fixture stations draw from (CMS-39).
 *
 * `pie` needs TWO context tags at once — the Tool × Cookbook mechanic CMS-7
 * settled on — so it also exercises CMS-6's combination gating, which no
 * shipped content uses yet.
 *
 * Cycle times differ per recipe (CMS-70): the pie takes longer than the stew,
 * even though both run on the same station.
 */
export const FIXTURE_RECIPE_POOLS = {
    cooking: [
        {
            id: 'pooled_stew',
            requiresContext: [{ tag: 'ctx_fixture_a', minTier: 1, chargeCost: 0 }],
            inputs: [{ itemId: 'item_carrot', quantity: 1 }],
            outputs: [{ itemId: 'item_leek_potato_stew', minQty: 1, maxQty: 1, chance: 100 }],
            durationMs: 10000,
            xp: 5
        },
        {
            id: 'pooled_pie',
            requiresContext: [{ tag: 'ctx_pie_tin', minTier: 1, chargeCost: 0 }, { tag: 'ctx_berry_cookbook', minTier: 1, chargeCost: 0 }],
            inputs: [{ itemId: 'item_blueberry', quantity: 2 }],
            outputs: [{ itemId: 'item_blueberry_pie', minQty: 1, maxQty: 1, chance: 100 }],
            durationMs: 20000,
            xp: 25
        }
    ]
};

/**
 * The items the fixture Tokens move around.
 *
 * ## Why this block exists
 * The fixture split (Phase 10) gave Tokens and recipe pools a registration seam
 * so engine suites stop depending on shipped content — but items never got one,
 * so the fixtures above went on naming *real* item ids. When content was
 * re-authored in the CMS the ids emptied out from under them, `getItem` started
 * returning null, and ~25 assertions across six suites broke — the precise
 * coupling the split was built to prevent. `registerItems` closes that gap.
 *
 * ## Scope
 * ⚠️ **Corrected 2026-08-26 (CR2-004).** This used to say only ids the content
 * set does *not* define are registered here, and that `item_oak_wood`,
 * `item_charcoal` and `item_copper_ore` were held back so `Market` and
 * `RosterAndMarkets` could keep measuring real values. Both halves were wrong:
 *
 * - Those three are now insulated as `fixture_oak_wood`, `fixture_charcoal` and
 *   `fixture_copper_ore`. Neither named suite ever referenced them.
 * - The "only ids content does not define" rule is not what this list does.
 *   `item_coal`, `item_blueberry` and `item_blueberry_pie` **are** in
 *   `data/items.json` today and are shadowed here. Content moved under the
 *   comment; the comment did not follow.
 *
 * The remaining `item_*` ids in this list are a pre-existing inconsistency with
 * the `fixture_` convention above — harmless while they are shadowed, but they
 * are the same tripwire in miniature. Not changed here; left as its own job.
 *
 * Numbers are instruments, not balance: `trueCost`/`sellPrice` of 1 keeps any
 * economy assertion that touches them arithmetically obvious.
 */
const FIXTURE_ITEM_DEFAULTS = {
    description: '', tags: [], stackable: true, restoreAmount: 0,
    restoreType: '', regen: 0, equipSlot: '', value: null,
    trueCost: 1, sellPrice: 1
};

function fixtureItem(id, name, type, sprite, extra = {}) {
    return { ...FIXTURE_ITEM_DEFAULTS, id, name, type, sprite, ...extra };
}

export const FIXTURE_ITEMS = {
    // Raw materials — the generic "something was produced" markers.
    item_coal: fixtureItem('item_coal', 'Coal', 'material', 'ore_copper'),
    item_bones: fixtureItem('item_bones', 'Bones', 'drop', 'ore_copper'),
    item_yew_log: fixtureItem('item_yew_log', 'Yew Log', 'material', 'wood_oak'),
    item_spider_silk: fixtureItem('item_spider_silk', 'Spider Silk', 'drop', 'ore_copper'),
    item_glowcap: fixtureItem('item_glowcap', 'Glowcap', 'material', 'wood_oak'),

    /**
     * The last three content-coupled ids — `item_oak_wood`, `item_charcoal` and
     * `item_copper_ore` — are insulated as of 2026-08-26 (CR2-004). Their
     * stand-ins live in `fixtureItems.js`, imported above, because five of the
     * affected suites need a resolvable item id without the fixture Tokens.
     *
     * ⚠️ **The stated reason for leaving them real was wrong.** Both this file
     * and CR2-004 said they had to stay pointing at content so `Market` and
     * `RosterAndMarkets` "keep measuring real values". Neither suite mentions
     * any of the three; neither failed when the rename was simulated against
     * the whole suite; and Market's premium rule is already asserted against
     * `item_market_goods` below, precisely because content prices were useless
     * for it. Nothing was lost: all three carry `sellPrice: 1`/`trueCost: 1` in
     * `data/items.json`, which is what the fixture defaults already give.
     */

    // Dropped by enemy_thorn_elemental, which `fixture_enemy` points at. Without
    // it a kill yields a drop entry for an item that does not exist, the sprite
    // layer has nothing to place, and the board-loot guarantee (D-40) cannot be
    // asserted at all.
    item_blackberry: fixtureItem('item_blackberry', 'Blackberry', 'ingredient', 'wood_oak'),

    /**
     * Goods with a **known Bank price**, for the Market premium rule.
     *
     * `CommerceSystem.getItemPrice` returns `baseValue`, and almost nothing in
     * shipped content sets one — so every raw sale in a test priced at 1 by
     * accident, which made a premium ratio impossible to assert honestly.
     */
    item_market_goods: fixtureItem(
        'item_market_goods', 'Market Goods', 'material', 'ore_copper', { baseValue: 10 }
    ),

    // Cooking chain, for the shared recipe pool above.
    item_carrot: fixtureItem('item_carrot', 'Carrot', 'ingredient', 'wood_oak'),
    item_blueberry: fixtureItem('item_blueberry', 'Blueberry', 'ingredient', 'wood_oak'),
    item_fish: fixtureItem('item_fish', 'Fish', 'ingredient', 'd_water'),
    item_leek_potato_stew: fixtureItem(
        'item_leek_potato_stew', 'Leek & Potato Stew', 'food', 'd_water',
        { restoreAmount: 10, restoreType: 'HP' }
    ),
    item_blueberry_pie: fixtureItem(
        'item_blueberry_pie', 'Blueberry Pie', 'food', 'd_water',
        { restoreAmount: 20, restoreType: 'HP' }
    )
};

// Registered on import. Vitest isolates module registries per test file, so a
// suite that does not import this never sees them.
registerTokenTypes(FIXTURE_TOKENS);
registerRecipePools(FIXTURE_RECIPE_POOLS);
registerItems(FIXTURE_ITEMS);

/** Every fixture id, for assertions that need to enumerate them. */
export const FIXTURE_IDS = Object.keys(FIXTURE_TOKENS);

/**
 * **The owner's Market rule, 2026-08-20:** a Market pays roughly a **20%
 * premium** over the Bank's sell price for the same goods.
 *
 * That premium is what buys the tile and the hero — without it a Market is
 * strictly worse than the sell button and nobody would ever place one.
 *
 * ⚠️ A comment in the old fixture claimed a "3× payout, limit of 30" rule.
 * **The owner never set that**; it was invented and then quoted back as if it
 * were policy. This constant is the real number, written down once, and
 * `fixture_market` is built to it.
 */
export const MARKET_PREMIUM = 1.2;
