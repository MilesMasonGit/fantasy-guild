// Fantasy Guild — Token definitions (7×7 Playmat rework, Phase 9: authored content)

/**
 * The Token registry — the *type* half of "a Token is a definition plus board
 * state" (D-79). Board state lives on the instance (see `BoardState.js`); this
 * holds everything true of every copy.
 *
 * ## Two authored kits (Phase 9)
 * **Woodland** (Map 1, the starting theme) and **Riverlands** (Map 2, thin by
 * design). A Map's pool is a **complete kit** (D-139): producers, their context
 * Tokens, their buffs, **their Manager**, a Market and the enemies that belong
 * there. A Map's loot pool is the only meaning "biome" has — there are no biome
 * systems, bonuses or mechanics anywhere. Names are flavour.
 *
 * ## Every number here is hand-authored (D-161)
 * Yield, cycle time, uses and input costs are set **individually per Token**.
 * There is no tier formula and no curve. This is the expensive option, chosen
 * knowingly: every Token gets its own character, at the cost of hand-tuning
 * roughly 60 of them eventually, in hand-edited JS until the CMS is rebuilt.
 *
 * ⚠️ **Never run the CMS's "Sync to Game" against this file** (D-109). It
 * destroys unmodelled content.
 *
 * ## The four authoring rules
 *
 * 1. ⚠️ **Every material must have at least one TOOL-FREE source** (D-213).
 *    Tool-gating downgraded D-51's promise that supply deadlock is
 *    *structurally* impossible to merely *authored*: a player who burns their
 *    last axe with no logs banked could otherwise hard-lock. A barehanded route
 *    back must always exist. `ContentRules.test.js` asserts this mechanically
 *    rather than trusting the eye — it is the only thing preventing the lock.
 * 2. ⚠️ **Every Passive Generator is strictly worse than its staffed
 *    equivalent** (D-116, risk 11) — worse output per tile, checked explicitly.
 *    If an unstaffed Token ever beat a staffed one, the optimal board would
 *    become mostly unstaffed and heroes would stop being the ceiling, which
 *    unpicks D-115, D-181 and §6.2 at once.
 * 3. **Creates-from-nothing is free; transforms cost** (D-97, risk 10). No rule
 *    enforces this — inputs are a per-Token property with no category rule — so
 *    consistency is the only kindness available to a player who has no
 *    principle to reason from and must learn each Token individually.
 * 4. **Cycle times stay in D-164's 10–30s band.** With eight heroes working
 *    this is roughly one completion every two or three seconds across the
 *    board: an unhurried rhythm where every drop still registers.
 *
 * ## Tiers are not versions of each other (D-178)
 * There is no Oakwood Grove → Uncommon Grove → Rare Grove ladder. There is a
 * Grove, and separately a Yew Stand, and separately a Heartwood — related
 * things with their own behaviour and reasons to exist. A per-Token ladder
 * would have tripled the authoring load under D-161, and it is exactly the
 * "same thing with a bigger number" that D-175 removed rarity's power to say.
 *
 * ## The three independent axes (D-175, D-176, D-95)
 * ```
 * RARITY  →  how often you find it   (drop frequency, nothing more)
 * CHARGES →  how long it lasts       (per-Token, independent of rarity)
 * THEME   →  how strong it is        (Woodland < Riverlands)
 * ```
 * Rarity is **not** a power tier and must never become one. A Common Riverlands
 * producer far outproduces a Rare Woodland one — that is the design working.
 *
 * ## Use counts are a statement about unattended runtime
 * `5000 uses × 12s ≈ 16 hours`; `2200 × 25s ≈ 15 hours`. That is the number
 * that matters for the AFK story, and it is why support Tokens wear so much
 * faster than producers: a Mould at 60 uses is the thing that runs out first
 * and sends you back to the Cartographer.
 *
 * ## The execution config
 * ```jsonc
 * config: {
 *   skill: 'nature',          // which skill gates and gains from it
 *   skillRequired: 1,         // ACCESS (D-67) — the only hero property that
 *                             // reaches the board; Speed and Efficiency are
 *                             // deferred (roadmap G-1)
 *   cycleTimeMs: 12000,
 *   xp: 4,
 *   inputs:  [{ itemId, quantity }],   // pulled from the Bank automatically (D-24)
 *   outputs: [{ itemId, quantity, chance }]   // or { currency: 'gold', ... }
 * }
 * ```
 *
 * **`requiresHero` defaults to true** (D-53). A Token with **no `config`** is
 * inert by design: Context, Buff and Manager Tokens work by being adjacent to
 * something (Phase 5), not by running.
 *
 * ⚠️ **`isTool: true` marks a context Token as a GATE rather than a recipe.**
 * The distinction is D-18 versus D-213: a Mould defines *what* a station makes,
 * a tool decides *whether* a resource can be worked at all. Rule 1 only counts
 * tools, which is why a Mould-gated ingot is fine and an axe-gated log is not.
 */

/** @type {Record<string, object>} */
export const TOKENS = {

    // =======================================================================
    // WOODLAND — Map 1, the starting theme
    // =======================================================================

    // --- Resource producers. Create from nothing, cost nothing (D-51). ------
    // These are the economy's floor and its recovery guarantee: a chain that
    // runs dry always restarts from the bottom, so no escape-hatch mechanic is
    // needed anywhere in the game.

    token_forest: {
        id: 'token_forest', name: 'Oakwood Grove', tokenType: 'resource',
        rarity: 'common', theme: 'woodland', uses: 5000, sprite: 'skill_nature',
        config: {
            skill: 'nature', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }]
        }
    },

    // ⚠️ **The tool-free route to Yew Log** (rule 1). Slow and thin next to the
    // axe-gated Yew Stand below, and that is the entire point: the barehanded
    // way back is never *good*, it just always exists.
    token_yew_copse: {
        id: 'token_yew_copse', name: 'Yew Copse', tokenType: 'resource',
        rarity: 'common', theme: 'woodland', uses: 2200, sprite: 'skill_nature',
        config: {
            skill: 'nature', skillRequired: 4, cycleTimeMs: 25000, xp: 7,
            inputs: [],
            outputs: [{ itemId: 'item_yew_log', quantity: 1, chance: 100 }]
        }
    },

    token_ore_vein: {
        id: 'token_ore_vein', name: 'Copper Seam', tokenType: 'resource',
        rarity: 'common', theme: 'woodland', uses: 4000, sprite: 'skill_industry',
        config: {
            skill: 'labor', skillRequired: 1, cycleTimeMs: 15000, xp: 5,
            inputs: [],
            outputs: [{ itemId: 'item_copper_ore', quantity: 2, chance: 100 }]
        }
    },

    token_berry_bush: {
        id: 'token_berry_bush', name: 'Bramble Patch', tokenType: 'resource',
        rarity: 'common', theme: 'woodland', uses: 3000, sprite: 'skill_culinary',
        config: {
            skill: 'nature', skillRequired: 2, cycleTimeMs: 10000, xp: 3,
            inputs: [],
            outputs: [{ itemId: 'item_blackberry', quantity: 2, chance: 100 }]
        }
    },

    // --- Tool-gated resources (D-213) --------------------------------------
    // Whether a resource needs a tool is a **per-Token property**, deliberately
    // not a category rule — the same register D-97 sets for input costs. Some
    // seams yield barehanded; some stands need an axe.

    token_yew_stand: {
        id: 'token_yew_stand', name: 'Yew Stand', tokenType: 'resource',
        rarity: 'uncommon', theme: 'woodland', uses: 2600, sprite: 'skill_nature',
        config: { skill: 'nature', skillRequired: 10, cycleTimeMs: 18000, xp: 12 },
        // Three times the Copse's yield in three-quarters of the time — but it
        // does nothing at all without an axe beside it.
        recipes: [{
            id: 'fell',
            requiresContext: ['ctx_axe'],
            inputs: [],
            outputs: [{ itemId: 'item_yew_log', quantity: 3, chance: 100 }]
        }]
    },

    // Access, and only access (D-67): the one hero property that reaches the
    // board this pass. A level-1 hero is refused outright rather than being
    // slow, because Access is a gate and Speed is deferred (`G-1`).
    token_deep_mine: {
        id: 'token_deep_mine', name: 'Deep Mine', tokenType: 'resource',
        rarity: 'rare', theme: 'woodland', uses: 2000, sprite: 'skill_crime',
        config: {
            skill: 'labor', skillRequired: 25, cycleTimeMs: 20000, xp: 30,
            inputs: [],
            outputs: [{ itemId: 'item_coal', quantity: 6, chance: 100 }]
        }
    },

    // --- Passive Generator (D-116) -----------------------------------------
    // ⚠️ **Strictly worse per tile than the staffed equivalent**, on purpose
    // and by a wide margin: the Grove makes 2 Oak Wood every 12s staffed
    // (0.167/s); this makes 1 every 30s (0.033/s), a fifth of the rate. Tiles
    // are abundant, so anything closer would make the optimal board mostly
    // unstaffed and heroes would stop being the production ceiling.
    token_wind_trap: {
        id: 'token_wind_trap', name: 'Windfall Timber', tokenType: 'passive',
        rarity: 'uncommon', theme: 'woodland', uses: 900, sprite: 'skill_social',
        requiresHero: false,
        config: {
            skill: 'nature', skillRequired: 0, cycleTimeMs: 30000, xp: 0,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 1, chance: 100 }]
        }
    },

    // --- Stations. Transforms, so they cost (rule 3, D-97). ----------------

    token_charcoal_kiln: {
        id: 'token_charcoal_kiln', name: 'Charcoal Kiln', tokenType: 'station',
        rarity: 'uncommon', theme: 'woodland', uses: 700, sprite: 'skill_industry',
        config: {
            skill: 'labor', skillRequired: 6, cycleTimeMs: 20000, xp: 9,
            inputs: [{ itemId: 'item_oak_wood', quantity: 4 }],
            outputs: [{ itemId: 'item_charcoal', quantity: 2, chance: 100 }]
        }
    },

    token_still: {
        id: 'token_still', name: 'Woodland Still', tokenType: 'station',
        rarity: 'uncommon', theme: 'woodland', uses: 600, sprite: 'skill_flask',
        config: {
            skill: 'alchemy', skillRequired: 1, cycleTimeMs: 18000, xp: 8,
            inputs: [{ itemId: 'item_oak_wood', quantity: 2 }],
            outputs: [{ itemId: 'item_glowcap', quantity: 1, chance: 100 }]
        }
    },

    // A deep consumer: needs FIVE where the Still needs two. ⚠️ This pair is
    // what makes **risk 13** measurable — under sustained shortage, D-127's
    // first-come allocation starves the *expensive* chains first, which is the
    // opposite of the pressure §6.2 intends. `InputAllocator.getStarvationStats`
    // counts it so the balance pass has data rather than a hunch.
    token_deep_kiln: {
        id: 'token_deep_kiln', name: 'Deep Kiln', tokenType: 'station',
        rarity: 'rare', theme: 'woodland', uses: 400, sprite: 'skill_culinary',
        config: {
            skill: 'forge', skillRequired: 1, cycleTimeMs: 18000, xp: 20,
            inputs: [{ itemId: 'item_oak_wood', quantity: 5 }],
            outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
        }
    },

    // --- Context-driven stations (D-18) ------------------------------------
    // **Adjacency's real job is definition, not amplification.** A Smelter with
    // a Mould beside it makes ingots; the same Smelter with nothing beside it
    // makes **nothing at all**. That is binary and decisive, and it is what
    // makes placement matter more than any buff number does.

    token_smelter: {
        id: 'token_smelter', name: 'Smelter', tokenType: 'station',
        rarity: 'uncommon', theme: 'woodland', uses: 600, sprite: 'skill_industry',
        config: { skill: 'forge', skillRequired: 8, cycleTimeMs: 22000, xp: 14 },
        recipes: [
            {
                id: 'ingot',
                requiresContext: ['ctx_ingot_mould'],
                inputs: [
                    { itemId: 'item_copper_ore', quantity: 3 },
                    { itemId: 'item_charcoal', quantity: 1 }
                ],
                outputs: [{ itemId: 'item_copper_ingot', quantity: 1, chance: 100 }]
            },
            {
                // The deepest Woodland chain, and the most profitable: ore and
                // wood in at the bottom, a 48g sword out at the top. **Items are
                // worth more used than sold** (D-128) — this is that rule as
                // content rather than as a slogan.
                id: 'blade',
                requiresContext: ['ctx_blade_mould'],
                inputs: [
                    { itemId: 'item_copper_ingot', quantity: 2 },
                    { itemId: 'item_yew_log', quantity: 1 }
                ],
                outputs: [{ itemId: 'item_copper_sword', quantity: 1, chance: 100 }]
            }
        ]
    },

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

    // --- Context Tokens: recipe-defining ------------------------------------
    // Not tools. These decide **what** a station makes, never whether it can
    // run — which is why rule 1 does not count them. They wear once per cycle
    // they SERVE (D-126), so one Mould driving three Smelters wears three times
    // as fast: sharing is a rate trade, not free value (D-157).

    token_ingot_mould: {
        id: 'token_ingot_mould', name: 'Ingot Mould', tokenType: 'context',
        rarity: 'common', theme: 'woodland', uses: 60, sprite: 'skill_industry',
        provides: ['ctx_ingot_mould']
    },
    token_blade_mould: {
        id: 'token_blade_mould', name: 'Blade Mould', tokenType: 'context',
        rarity: 'uncommon', theme: 'woodland', uses: 40, sprite: 'skill_crime',
        provides: ['ctx_blade_mould']
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

    // --- Context Tokens: TOOLS (D-213) --------------------------------------
    // ⚠️ `isTool` is what rule 1 counts. A tool decides **whether** a resource
    // can be worked at all, so a material reachable only through one is a
    // material a player can be locked out of.

    token_copper_axe: {
        id: 'token_copper_axe', name: 'Copper Axe', tokenType: 'context',
        rarity: 'common', theme: 'woodland', uses: 80, sprite: 'skill_industry',
        isTool: true,
        provides: ['ctx_axe']
    },

    // --- Buff Tokens (D-119/D-120) ------------------------------------------
    // ⚠️ Numbers here are deliberately **tiny**. A typical buff nudges output a
    // few percent; real power comes from acquiring a better Token, never from
    // stacking modifiers. Stacking stays uncapped precisely *because* the
    // effects are small — eight Sawmills give +40%, not +400%. If that ever
    // reads as large, the numbers have drifted, not the rule.
    //
    // Token buffs are inert while their target is idle; hero buffs always apply
    // (D-152) — a Campfire helping a resting hero is exactly when healing
    // matters most, and it is what makes retreat-and-recover a real tactic.

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
        id: 'token_shrine', name: 'Greenwood Shrine', tokenType: 'buff',
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
        rarity: 'uncommon', theme: 'woodland', uses: null, sprite: 'skill_culinary',
        buff: {
            target: 'hero',
            modifiers: [{ type: 'HP_REGEN', bucket: 'flat', value: 1 }]
        }
    },

    // --- Managers (D-35, D-104, D-140) --------------------------------------
    // Type-specific, covering the 8 adjacent tiles, and **never depleting** — a
    // restocker needing restocking would be exactly the chore it exists to
    // remove. Managers are rare finds, which is what makes automation something
    // bought cluster by cluster rather than all at once.

    token_lumber_camp: {
        id: 'token_lumber_camp', name: 'Lumber Camp', tokenType: 'manager',
        rarity: 'rare', theme: 'woodland', uses: null, sprite: 'skill_social',
        manages: ['token_forest', 'token_yew_copse', 'token_yew_stand']
    },
    // Enemies are NOT a special case (D-104): they deplete like resources,
    // restock like resources and automate like resources. One economic model
    // covers the whole board.
    token_hunters_blind: {
        id: 'token_hunters_blind', name: "Hunter's Blind", tokenType: 'manager',
        rarity: 'rare', theme: 'woodland', uses: null, sprite: 'skill_crime',
        manages: ['token_bear', 'token_cow_pasture']
    },

    // --- Market (D-141) ------------------------------------------------------
    // A Token whose **output is currency**, goods-specific with an input list
    // like anything else. 10 Oak Wood sells for 20g raw; the Market pays 34.
    // The premium buys the tile and the hero, and is deliberately modest — a
    // Market that beat crafting would make every chain pointless.
    token_lumber_market: {
        id: 'token_lumber_market', name: 'Lumber Market', tokenType: 'market',
        rarity: 'uncommon', theme: 'woodland', uses: null, sprite: 'skill_social',
        config: {
            skill: 'social', skillRequired: 1, cycleTimeMs: 15000, xp: 6,
            inputs: [{ itemId: 'item_oak_wood', quantity: 10 }],
            outputs: [{ currency: 'gold', quantity: 34, chance: 100 }]
        }
    },

    // --- Enemies -------------------------------------------------------------
    // These run on the 7-stat combat engine, not a work cycle. **Fighting one
    // is a cycle** for every board system outside combat (D-129), so adjacent
    // support wears per kill exactly as it wears per craft, and enemy Tokens
    // deplete like anything else (D-104).
    //
    // **Inert until targeted** (D-14): they never initiate and never aggro, so
    // an unstaffed enemy tile does nothing at all.

    // ⚠️ **Only four enemies are usable as content**, and it is not the four
    // you would guess. `enemyRegistry.js` defines eighteen, but every one of
    // them drops LEGACY item ids (`thorn_vine`, `boar_tusk`, `leather`) that do
    // not exist in `data/items.json` — so a kill would resolve to nothing at
    // all. The four in `data/enemies.json` are the only ones whose drop tables
    // point at real `item_*` ids. Authoring against the others is a silent
    // no-loot bug, not a compile error.
    token_bear: {
        id: 'token_bear', name: 'Thorn Thicket', tokenType: 'enemy',
        rarity: 'common', theme: 'woodland', uses: 20, sprite: 'skill_occult',
        enemyId: 'enemy_thorn_elemental'
    },
    token_cow_pasture: {
        id: 'token_cow_pasture', name: 'Cow Pasture', tokenType: 'enemy',
        rarity: 'common', theme: 'woodland', uses: 40, sprite: 'skill_culinary',
        enemyId: 'enemy_cow'
    },
    token_skeleton: {
        id: 'token_skeleton', name: 'Barrow Mound', tokenType: 'enemy',
        rarity: 'uncommon', theme: 'woodland', uses: 15, sprite: 'skill_crime',
        enemyId: 'enemy_skeleton_warrior'
    },

    // --- The Woodland Mythic -------------------------------------------------
    // ⚠️ Note the charges: **rarity says nothing about how long a Token lasts**
    // (D-176). A Mythic with a use count is the clearest way to say so. Unique
    // on the *board*, not to own (D-177) — spares are spares.
    token_heartwood: {
        id: 'token_heartwood', name: 'Heartwood', tokenType: 'resource',
        rarity: 'mythic', theme: 'woodland', uses: 8000, sprite: 'skill_occult',
        config: {
            skill: 'nature', skillRequired: 1, cycleTimeMs: 10000, xp: 25,
            inputs: [],
            outputs: [{ itemId: 'item_oak_wood', quantity: 8, chance: 100 }]
        }
    },

    // =======================================================================
    // RIVERLANDS — Map 2, deliberately thin (`G-12`)
    // =======================================================================
    //
    // It exists for one reason: to make the **price step** and the
    // **strength/demand jump** real. Without a second price point, the whole
    // progression model is untested and the 200g → 2,000g curve is a guess.
    //
    // ⚠️ **Later Maps yield Tokens that are stronger AND more demanding**
    // (D-95). Power growth alone would just mean swapping Tokens and having
    // spare tiles; because later content also costs **more board** — deeper
    // chains, more inputs, higher skill floors — the player faces a real choice
    // about what to run. Map 2 must demonstrate that, not merely cost more.
    //
    // Compare: an Oakwood Grove is 4g of wood every 12s at skill 1. A River
    // Delta is 40g of fish every 20s at skill 14 — six times the value per
    // second, behind a skill wall a starting hero cannot clear.

    token_river_delta: {
        id: 'token_river_delta', name: 'River Delta', tokenType: 'resource',
        rarity: 'common', theme: 'riverlands', uses: 3000, sprite: 'skill_nautical',
        config: {
            skill: 'aquatic', skillRequired: 14, cycleTimeMs: 20000, xp: 22,
            inputs: [],
            outputs: [{ itemId: 'item_fish', quantity: 5, chance: 100 }]
        }
    },

    token_glowcap_hollow: {
        id: 'token_glowcap_hollow', name: 'Glowcap Hollow', tokenType: 'resource',
        rarity: 'common', theme: 'riverlands', uses: 2200, sprite: 'skill_flask',
        config: {
            skill: 'nature', skillRequired: 16, cycleTimeMs: 22000, xp: 26,
            inputs: [],
            outputs: [{ itemId: 'item_glowcap', quantity: 4, chance: 100 }]
        }
    },

    // Tool-gated, and the tool is Riverlands-only — but Copper Ore still has
    // its barehanded Woodland source (rule 1 holds across themes, not within
    // them).
    token_silt_bed: {
        id: 'token_silt_bed', name: 'Silt Bed', tokenType: 'resource',
        rarity: 'uncommon', theme: 'riverlands', uses: 2600, sprite: 'skill_industry',
        config: { skill: 'labor', skillRequired: 20, cycleTimeMs: 25000, xp: 30 },
        recipes: [{
            id: 'dredge',
            requiresContext: ['ctx_dredge'],
            inputs: [],
            outputs: [{ itemId: 'item_copper_ore', quantity: 8, chance: 100 }]
        }]
    },
    token_silt_dredge: {
        id: 'token_silt_dredge', name: 'Silt Dredge', tokenType: 'context',
        rarity: 'uncommon', theme: 'riverlands', uses: 50, sprite: 'skill_nautical',
        isTool: true,
        provides: ['ctx_dredge']
    },

    // The demand half of D-95 made concrete: two Riverlands producers feeding
    // one station, at a skill floor no starting hero can reach. Three tiles and
    // three heroes for one output stream — where Woodland's Still is one tile
    // and one hero.
    token_alembic: {
        id: 'token_alembic', name: 'Riverside Alembic', tokenType: 'station',
        rarity: 'uncommon', theme: 'riverlands', uses: 500, sprite: 'skill_flask',
        config: {
            skill: 'alchemy', skillRequired: 18, cycleTimeMs: 28000, xp: 34,
            inputs: [
                { itemId: 'item_glowcap', quantity: 3 },
                { itemId: 'item_fish', quantity: 2 }
            ],
            outputs: [{ itemId: 'item_glowcap_draught', quantity: 2, chance: 100 }]
        }
    },

    token_riverwarden_post: {
        id: 'token_riverwarden_post', name: 'Riverwarden Post', tokenType: 'manager',
        rarity: 'rare', theme: 'riverlands', uses: null, sprite: 'skill_nautical',
        manages: ['token_river_delta', 'token_glowcap_hollow', 'token_silt_bed']
    },

    token_river_market: {
        id: 'token_river_market', name: 'River Market', tokenType: 'market',
        rarity: 'uncommon', theme: 'riverlands', uses: null, sprite: 'skill_social',
        config: {
            skill: 'social', skillRequired: 12, cycleTimeMs: 18000, xp: 20,
            // 4 Draughts sell for 120g raw; the Market pays 150 — the same
            // modest premium the Lumber Market takes, at Riverlands scale.
            inputs: [{ itemId: 'item_glowcap_draught', quantity: 4 }],
            outputs: [{ currency: 'gold', quantity: 150, chance: 100 }]
        }
    },

    // The last of the four usable enemies. Its copper drops sit naturally
    // beside the Silt Bed, which is the other Riverlands source of ore.
    token_drowned_prospector: {
        id: 'token_drowned_prospector', name: 'Drowned Prospector', tokenType: 'enemy',
        rarity: 'common', theme: 'riverlands', uses: 25, sprite: 'skill_occult',
        enemyId: 'enemy_copper_miner'
    },

    // =======================================================================
    // MAPS — outside the rarity system entirely (D-132)
    // =======================================================================
    //
    // Never Common, never Mythic: always consumable, always bought, never
    // placed to produce. A Map is a Token only so it can sit in the Tray and on
    // a tile; `mapId` points at the catalogue in `mapRegistry.js`, mirroring the
    // way enemy Tokens carry `enemyId`.
    //
    // ⚠️ **`uses: 1` is what makes a Map a single burst** (D-155). Multiple
    // charges would make it squat on a tile and read as a dispenser rather than
    // a package, which loses the pack-opening moment entirely.

    token_map_woodland: {
        id: 'token_map_woodland', name: 'Woodland Map', tokenType: 'map',
        theme: 'woodland', uses: 1, sprite: 'skill_social',
        mapId: 'map_woodland'
    },
    token_map_river: {
        id: 'token_map_river', name: 'Riverlands Map', tokenType: 'map',
        theme: 'riverlands', uses: 1, sprite: 'skill_nautical',
        mapId: 'map_river'
    }
};

/**
 * Add Token definitions at runtime. **For test fixtures only.**
 *
 * ## Why this exists
 * Engine tests need Tokens with *stable, known* numbers — a producer that makes
 * exactly 2 of something every 12s, a consumer that needs exactly 5. Before
 * this, they used shipped content for that, which quietly made every balance
 * change a test-breaking change: retuning the Oakwood Grove failed assertions
 * in `TokenCycle` that were never about the Grove at all.
 *
 * That coupling was reported at the end of Phase 9 as the real shape of risk
 * 17 — hand-authored numbers do not scale, and they scale even worse when
 * touching one breaks twenty tests in three files. **Content should be free to
 * be retuned without the engine suite noticing.**
 *
 * Fixtures live in `src/tests/fixtures/testTokens.js` and are all prefixed
 * `fixture_`, so they can never collide with content and are trivially
 * filterable. Vitest isolates module registries per test file, so registering
 * them never leaks into the content validation suite.
 *
 * ⚠️ **Nothing in `src/systems` or `src/ui` may call this.** It is a seam for
 * tests, not an extension point — content belongs in this file, where the
 * validation rules can see it.
 */
export function registerTokenTypes(definitions) {
    Object.assign(TOKENS, definitions || {});
}

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

/**
 * Every way a Token can produce, as `[{ inputs, outputs, requiresContext }]`.
 *
 * Flattens "authored on the config" and "decided by a recipe" into one list, so
 * content validation can reason about the economy without re-deriving which
 * kind of Token it is holding. Recipe-less Tokens yield a single entry.
 */
export function productionRoutes(typeId) {
    const def = TOKENS[typeId];
    if (!def) return [];

    if (def.recipes?.length) {
        return def.recipes.map(r => ({
            id: r.id,
            inputs: r.inputs || [],
            outputs: r.outputs || [],
            requiresContext: r.requiresContext || []
        }));
    }
    if (!def.config?.outputs?.length) return [];
    return [{
        id: null,
        inputs: def.config.inputs || [],
        outputs: def.config.outputs,
        requiresContext: []
    }];
}

/** Which context tags are TOOLS (D-213) rather than recipe definitions. */
export function toolContextTags() {
    const tags = new Set();
    for (const def of Object.values(TOKENS)) {
        if (!def.isTool) continue;
        for (const tag of def.provides || []) tags.add(tag);
    }
    return tags;
}
