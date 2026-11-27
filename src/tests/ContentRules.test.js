import { describe, it, expect } from 'vitest';
import {
    getAllTokenTypes, getProvidedTagsWithTiers, productionRoutes, toolContextTags, tokenName,
    expectedOutputQuantity
} from '../config/registries/tokenRegistry.js';
import { enemyProfileOf, isEnemyDef } from '../config/registries/enemyProfile.js';
import { RPS_RULES } from '../config/FormulaRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { STARTING_SKILL_IDS, getAllSkillIds } from '../config/registries/skillRegistry.js';
import { isTokenType, isTokenRarity } from '../config/registries/tokenConstants.js';
import { isTempo, bandFor, isInBand } from '../../cms/src/engine/ledger/tempoBands.js';
import { openingMat } from '../systems/core/EngineBootstrap.js';
import { stationSkillOf } from '../systems/effects/statements.js';
import { toolMaterialGaps } from '../systems/core/toolRule.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import {
    migrateLegacyIntent, applyItemResults, RETIRED_ITEM_FIELDS,
} from '../../cms/src/engine/sim/writeBack.js';
import { workspaceDials } from '../../cms/src/engine/sim/dials.js';
import { hasUse, usedItemOfSource } from '../config/registries/itemUse.js';
import { createRequire } from 'module';
import path from 'path';

// The balance solver, for the action time rule (BALANCE_RULES section 2) a number pack pins.
const solver = createRequire(import.meta.url)(path.resolve(__dirname, '../../.claude/skills/balancer/balance_solver.cjs'));
const BALANCE = solver.make({});
/** How far the solver may trim an action's time to pay whole XP, either way (BALANCE_RULES section 1). */
const WHOLE_XP_TRIM = 0.15;

// ⚠️ Read from `data/` directly rather than through the item registry. The
// registry is the merge of shipped content and the test fixtures, and the rules
// below are about what shipped — a fixture cannot be required to carry
// provenance it was never given.
import shippedItems from '../../data/items.json';
import shippedTokens from '../../data/tokens.json';
import shippedRecipes from '../../data/tokenRecipes.json';

/**
 * Re-derive the shipped corpus's item values from its authored intent, the same
 * way `recalculateEconomy` does, with the dials a Sync runs (`workspaceDials`: the
 * balance rules on). Cached: the passes are pure and the corpus is a module
 * constant, so one solve serves every assertion.
 */
let solvedCorpus = null;
function solveShippedCorpus() {
    if (solvedCorpus) return solvedCorpus;

    const recipePools = {};
    for (const recipe of shippedRecipes) (recipePools[recipe.skill] ||= []).push(recipe);
    const migrated = migrateLegacyIntent({ tokens: shippedTokens, recipePools });

    const recipes = {};
    for (const [skillId, pool] of Object.entries(migrated.recipePools)) {
        pool.forEach((r, i) => {
            const id = r.id || `pooled_${skillId}_${i}`;
            recipes[id] = { ...r, id, skill: r.skill || skillId };
        });
    }

    const sim = runSim({ items: shippedItems, tokens: migrated.tokens, recipes }, workspaceDials());
    solvedCorpus = {
        items: applyItemResults(shippedItems, sim),
        recipeIds: new Set(Object.keys(recipes)),
    };
    return solvedCorpus;
}

/**
 * Content validation — the authoring rules, asserted mechanically.
 *
 * ⚠️ **These are not style checks.** Each one prevents a specific failure the
 * design has already identified, and each is the kind of thing the eye stops
 * catching somewhere around the thirtieth Token.
 *
 * ## ⚠️ Why 2 cases below are skipped
 *
 * Resources having an input-free route fails today on a Resource with no recipe
 * yet (unfinished content). The Market rule assumes Markets pay in currency, which
 * is retired; what Markets become is an open owner question.
 */

/**
 * ⚠️ **Shipped content only.** Engine suites register `fixture_*` Tokens with
 * deliberately unbalanced instrument numbers; those are not content and must
 * never be judged by these rules.
 */
const TOKENS = Object.fromEntries(
    Object.entries(getAllTokenTypes()).filter(([id]) => !id.startsWith('fixture_'))
);
const ALL_IDS = Object.keys(TOKENS);

/** Tokens that actually run a cycle (as opposed to working by adjacency). */
/**
 * Tokens that run a WORK CYCLE.
 *
 * ⚠️ Enemies are excluded. An enemy Token carries a `config` — that is where
 * its drops live, since a kill is a cycle — but nothing ever reads its
 * `cycleTimeMs`: a fight is paced by the enemy's attack interval and the
 * hero's, both derived from the level. Leaving enemies in here made the
 * cycle-time band rule assert against a number with no effect on anything,
 * which is worse than not asserting: it would have had authors tune a dead
 * field to keep the suite quiet.
 */
const RUNNING = ALL_IDS.filter(
    id => (TOKENS[id].config || stationSkillOf(TOKENS[id])) && !isEnemyDef(TOKENS[id])
);

describe('⚠️ Rule 1 — every material a tool is made from has a source that needs no tool (D-213)', () => {
    /**
     * A hero who loses or breaks a tool must be able to make it again without one: every material a
     * tool's recipe needs, and every material those materials are made from, has at least one source
     * that needs no tool in hand (an enemy's drop, a Token worked barehanded, a Token's trickle). A
     * Token whose work needs a held tool, and every catch, needs a tool. Materials no tool is made
     * from (fish, food) are outside the rule: losing a rod never stops a pickaxe being made.
     *
     * **This test is the only thing preventing the lock.** The rule is `toolRule.toolMaterialGaps`.
     */
    const TOOL_TAGS = toolContextTags();
    const gapsIn = (content) => toolMaterialGaps(content).map(g => `${g.itemId}: only from ${
        g.sources.map(s => (s.needsTool ? `${s.by} (needs a tool)` : s.by)).join(', ') || 'nothing'}`);

    // Tool materials for the owner to fix in the CMS, as `{ itemId: why }`. `it.fails` passes while
    // the gap is there and fails the day it closes, so the entry is deleted with the fix.
    const KNOWN_TOOL_MATERIAL_GAPS = {};

    it('gives every material a tool is made from a source that needs no tool', () => {
        const gaps = gapsIn({ tokens: TOKENS, items: shippedItems, routesOf: (def) => productionRoutes(def.id), toolTags: TOOL_TAGS })
            .filter(line => !KNOWN_TOOL_MATERIAL_GAPS[line.split(':')[0]]);
        expect(gaps).toEqual([]);
    });

    for (const [item, why] of Object.entries(KNOWN_TOOL_MATERIAL_GAPS)) {
        it.fails(`${item} has a source that needs no tool (known gap: ${why})`, () => {
            const gaps = toolMaterialGaps({ tokens: TOKENS, items: shippedItems, routesOf: (def) => productionRoutes(def.id), toolTags: TOOL_TAGS });
            expect(gaps.map(g => g.itemId)).not.toContain(item);
        });
    }

    describe('the rule on a fixture world', () => {
        const material = (id) => ({ id, name: id, type: 'material' });
        const ITEMS = {
            fx_ore: material('fx_ore'), fx_ingot: material('fx_ingot'), fx_wood: material('fx_wood'),
            fx_fish: material('fx_fish'), fx_bait: material('fx_bait'),
            fx_pick: { id: 'fx_pick', name: 'Pick', type: 'tool', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1 } }
        };
        const line = (itemId) => ({ itemId, quantity: 1, chance: 100 });
        const work = (outputs, inputs = []) => ({ skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs, outputs });
        const TOKENS_FX = {
            // The ore needs a pickaxe in hand; the wood is cut barehanded.
            fx_vein: { id: 'fx_vein', config: work([line('fx_ore')]), needsTool: { kind: 'pickaxe', minTier: 1 } },
            fx_tree: { id: 'fx_tree', config: work([line('fx_wood')]) },
            // The pickaxe is made from an ingot, smelted from the ore: the ore is a tool material through its chain.
            fx_forge: { id: 'fx_forge', recipes: [
                { id: 'r_ingot', inputs: [line('fx_ore')], outputs: [line('fx_ingot')] },
                { id: 'r_pick', inputs: [line('fx_ingot'), line('fx_wood')], outputs: [line('fx_pick')] }
            ] },
            // The fish is only ever caught, and only Bait is made from it.
            fx_water: { id: 'fx_water', config: work([]), catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: 'fx_fish', weight: 1 }] }] },
            fx_shed: { id: 'fx_shed', recipes: [{ id: 'r_bait', inputs: [line('fx_fish')], outputs: [line('fx_bait')] }] }
        };
        const routesOf = (def) => (def.recipes
            ? def.recipes.map(r => ({ id: r.id, inputs: r.inputs, outputs: r.outputs, requiresContext: [] }))
            : def.config?.outputs?.length ? [{ id: null, inputs: def.config.inputs, outputs: def.config.outputs, requiresContext: [] }] : []);

        it('flags a tool material whose only source needs a tool, through the chain the tool is made by', () => {
            expect(gapsIn({ tokens: TOKENS_FX, items: ITEMS, routesOf })).toEqual(['fx_ore: only from fx_vein (needs a tool)']);
        });

        it('leaves out a fish that only a catch lands, as no tool is made from it', () => {
            expect(toolMaterialGaps({ tokens: TOKENS_FX, items: ITEMS, routesOf }).map(g => g.itemId)).not.toContain('fx_fish');
        });

        it('an enemy that drops the ore is a source that needs no tool, and the gap closes', () => {
            const goblin = { id: 'fx_goblin', tokenType: 'enemy', config: work([line('fx_ore')]) };
            expect(gapsIn({ tokens: { ...TOKENS_FX, fx_goblin: goblin }, items: ITEMS, routesOf })).toEqual([]);
        });

        it('a steal table on an enemy is a source that needs no tool, a rare find too; on a Planned enemy it is not', () => {
            const robbed = (extra = {}) => ({ id: 'fx_bandit', tokenType: 'enemy', enemy: { level: 5 }, config: work([]), steal: { outputs: [line('fx_ore')] }, ...extra });
            expect(gapsIn({ tokens: { ...TOKENS_FX, fx_bandit: robbed() }, items: ITEMS, routesOf })).toEqual([]);
            const rare = robbed({ steal: { outputs: [], rareTable: { entries: [{ itemId: 'fx_ore', chance: 1 }] } } });
            expect(gapsIn({ tokens: { ...TOKENS_FX, fx_bandit: rare }, items: ITEMS, routesOf })).toEqual([]);
            const planned = robbed({ plan: { status: 'planned' } });
            expect(gapsIn({ tokens: { ...TOKENS_FX, fx_bandit: planned }, items: ITEMS, routesOf })).toEqual(['fx_ore: only from fx_vein (needs a tool)']);
        });

        it('a recipe asking for a tool nearby needs a tool too', () => {
            const tokens = { ...TOKENS_FX, fx_tree: { id: 'fx_tree', recipes: [{ id: 'r_wood', inputs: [], outputs: [line('fx_wood')], ctx: ['axe'] }] } };
            const withContext = (def) => routesOf(def).map(r => ({ ...r, requiresContext: def.recipes?.find(x => x.id === r.id)?.ctx || [] }));
            expect(gapsIn({ tokens, items: ITEMS, routesOf: withContext, toolTags: new Set(['axe']) }))
                .toEqual(['fx_ore: only from fx_vein (needs a tool)', 'fx_wood: only from fx_tree (r_wood) (needs a tool)']);
        });
    });
});

describe('⚠️ Rule 2 — Passive Generators are strictly worse (D-116, risk 11)', () => {
    /**
     * Tiles are abundant.
     */
    const passives = ALL_IDS.filter(id => TOKENS[id].requiresHero === false);

    /** Units of `itemId` per second, at this Token's authored numbers. */
    function ratePerSecond(id, itemId) {
        const def = TOKENS[id];
        const cycle = def.config?.cycleTimeMs;
        if (!cycle) return 0;
        let per = 0;
        for (const route of productionRoutes(id)) {
            for (const out of route.outputs) {
                if (out.itemId === itemId) per += expectedOutputQuantity(out) * ((out.chance ?? 100) / 100);
            }
        }
        return per / (cycle / 1000);
    }

    it('has at least one Passive Generator to check', () => {
        expect(passives.length).toBeGreaterThan(0);
    });

    it.each(passives)('%s is beaten by a staffed producer of the same item', (passiveId) => {
        for (const route of productionRoutes(passiveId)) {
            for (const out of route.outputs) {
                if (!out.itemId) continue;
                const passiveRate = ratePerSecond(passiveId, out.itemId);

                // The best staffed rate anyone achieves for the same material.
                const staffedRates = ALL_IDS
                    .filter(id => TOKENS[id].requiresHero !== false)
                    .map(id => ratePerSecond(id, out.itemId));
                const bestStaffed = Math.max(0, ...staffedRates);

                expect(bestStaffed).toBeGreaterThan(passiveRate);
            }
        }
    });
});

describe('Rule 3 — creates-from-nothing is free; transforms cost (D-97)', () => {
    /**
     * No rule enforces this — inputs are a per-Token property with no category
     * rule, which is exactly why consistency has to be checked. Players have
     * no principle to reason from and must learn each Token individually, so
     * an inconsistent kit is the cruelty, not the variety.
     */
    it.skip('gives every resource Token an input-free route', () => {
        const resources = ALL_IDS.filter(id => TOKENS[id].tokenType === 'resource');
        expect(resources.length).toBeGreaterThan(0);

        for (const id of resources) {
            const routes = productionRoutes(id);
            expect(routes.length).toBeGreaterThan(0);
            for (const route of routes) {
                expect(route.inputs, `${tokenName(id)} should consume nothing`).toEqual([]);
            }
        }
    });

    it('makes every station pay for what it produces', () => {
        const stations = ALL_IDS.filter(id => TOKENS[id].tokenType === 'station');
        expect(stations.length).toBeGreaterThan(0);

        for (const id of stations) {
            // ⚠️ A route with no outputs is unfinished authoring, not a broken
            // transform — the owner creates a recipe and fills it in over
            // several sittings, and a half-written one turned this rule red on.
            // The rule is about what a station charges for what it *produces*;
            // with nothing produced there is nothing to charge for. The
            // simulator files its own row for an outputless recipe.
            for (const route of productionRoutes(id).filter(r => r.outputs?.length)) {
                expect(route.inputs.length, `${tokenName(id)} (${route.id}) should cost something`)
                    .toBeGreaterThan(0);
            }
        }
    });

    it.skip('makes every Market pay in goods and produce only currency (D-141)', () => {
        const markets = ALL_IDS.filter(id => TOKENS[id].tokenType === 'market');
        expect(markets.length).toBeGreaterThan(0);

        for (const id of markets) {
            for (const route of productionRoutes(id)) {
                expect(route.inputs.length).toBeGreaterThan(0);
                for (const out of route.outputs) expect(out.currency).toBeTruthy();
            }
        }
    });
});

describe('Rule 4 — cycle times stay in their band', () => {
    /**
     * ## Two rules here, not one, and the split is temporary scaffolding
     *
     * ⚠️ **Coverage flipped in P2.5**, when the shipped corpus was tagged: every
     * running Token now carries a tempo, so the *tagged* branch fires on real
     * content and the *untagged* list is empty. The untagged branch is kept
     * rather than deleted — it is the rule any Token added later without a tempo
     * still has to meet — but it now needs the same empty-list guard the tagged
     * branch has always had, because `it.each([])` throws.
     *
     * ⚠️ Those tags are **provisional test substrate**: chosen to give the
     * economic simulator something with a real spread to run against, not
     * settled design, and the owner expects to change them. Nothing here should
     * be read as asserting that a given Token *ought* to be Slow.
     *
     * The level comes from `config.skillRequired`. ⚠️ Tokens and recipes disagree
     * on this field name — a **recipe** carries `levelRequirement` instead
     * (finding B5) — so this must not be copied to recipes unchanged.
     */
    // A pinned time (`sim.timePinned`) is the balance rules', written by a number pack: Recalculate
    // keeps it whatever the Tempo, so it is checked against that rule instead (below).
    const pinned = RUNNING.filter((id) => TOKENS[id]?.sim?.timePinned === true);
    const tagged = RUNNING.filter((id) => isTempo(TOKENS[id]?.sim?.tempo) && !pinned.includes(id));
    // Event Tokens are left out: an event node copies the cycle of the Token it
    // imitates (a Copper Comet works like a Copper Ore Vein), so it is paced by
    // that Token's tempo, not by the flat band.
    const untagged = RUNNING.filter((id) => !isTempo(TOKENS[id]?.sim?.tempo)
        && !(TOKENS[id]?.tags || []).includes('Event') && !pinned.includes(id));

    describe('pinned Tokens run at the gather time of the balance rules', () => {
        // A gather is 6 s a little longer every 20 levels (x1.15), trimmed by up to 15 % either way to
        // pay whole XP, in tenths of a second as the solver writes it.
        const band = (level) => {
            const ms = BALANCE.cycle('gather', level) * 1000;
            return { minMs: Math.round(ms * (1 - WHOLE_XP_TRIM) / 100) * 100, maxMs: Math.round(ms * (1 + WHOLE_XP_TRIM) / 100) * 100 };
        };
        it('has pinned Tokens to check', () => {
            expect(pinned.length).toBeGreaterThan(0);
        });
        it.each(pinned)('%s runs within the gather time', (id) => {
            const cycle = TOKENS[id].config?.cycleTimeMs;
            const level = TOKENS[id].config?.skillRequired ?? 1;
            const { minMs, maxMs } = band(level);
            expect(cycle >= minMs && cycle <= maxMs,
                `${tokenName(id)} is pinned at ${cycle} ms at level ${level}, outside the gather time ${minMs}-${maxMs} ms`).toBe(true);
        });
        it('the gather time rule catches a pinned time a tier out', () => {
            const { minMs, maxMs } = band(1);
            expect(BALANCE.cycle('gather', 1) * 1000).toBeGreaterThan(minMs);
            expect(BALANCE.cycle('gather', 1) * 1000).toBeLessThan(maxMs);
            expect(band(80).minMs).toBeGreaterThan(maxMs);
        });
    });

    /**
     * With eight heroes working this is roughly one completion every two or
     * three seconds across the board: an unhurried rhythm where every drop
     * still registers, rather than a blur.
     */
    describe('untagged Tokens keep D-164\'s flat 10–30s band', () => {
        // Empty since P2.5 tagged the corpus, and `it.each([])` throws. Guarded
        // rather than deleted, so an untagged Token added later is caught
        // without anyone editing this file back.
        if (untagged.length === 0) {
            it('has nothing untagged left — every running Token carries a tempo', () => {
                expect(untagged).toEqual([]);
            });
        } else {
            // `it.fails` passes while the assertion fails and fails the day it
            // passes, so when the content is fixed this goes red: delete the
            // entry.
            const KNOWN_BAND_DRIFT = {};
            for (const id of untagged) {
                const run = KNOWN_BAND_DRIFT[id] ? it.fails : it;
                run(`${id} runs within the band`, () => {
                    const cycle = TOKENS[id].config?.cycleTimeMs;
                    if (cycle == null) return;                 // inert, or a Map
                    expect(cycle).toBeGreaterThanOrEqual(10000);
                    expect(cycle).toBeLessThanOrEqual(30000);
                });
            }
        }
    });

    describe('tagged Tokens sit inside their tempo band', () => {
        // `it.each([])` throws, and an empty list here is the *expected* state
        // until P2.5 tags something. Guard rather than skip, so that the moment
        // a Token gains a tempo it is checked without anyone editing this file.
        if (tagged.length === 0) {
            it('has nothing tagged yet — covered by the fixtures below', () => {
                expect(tagged).toEqual([]);
            });
        } else {
            it.each(tagged)('%s runs within its tempo band', (id) => {
                const def = TOKENS[id];
                const cycle = def.config?.cycleTimeMs;
                if (cycle == null) return;             // inert, or a Map
                const tempo = def.sim.tempo;
                const level = def.config?.skillRequired ?? 1;
                const band = bandFor(tempo, level);
                expect(
                    isInBand(cycle, tempo, level),
                    `${tokenName(id)} is ${tempo} at level ${level} `
                    + `(band ${band.minMs}–${band.topIsSoft ? '∞' : band.maxMs}ms) `
                    + `but runs in ${cycle}ms`
                ).toBe(true);
            });
        }
    });

    /**
     * The tagged branch, exercised against Tokens shaped exactly like the real
     * thing. These are the only cases proving that branch works until content
     * is tagged.
     */
    describe('the tagged branch itself (fixtures)', () => {
        const fixture = (tempo, cycleTimeMs, skillRequired) => ({
            sim: { tempo },
            config: { cycleTimeMs, skillRequired },
        });

        const check = (def) => isInBand(
            def.config.cycleTimeMs, def.sim.tempo, def.config.skillRequired ?? 1
        );

        it('accepts a medium Token at level 1 running 15s', () => {
            expect(check(fixture('medium', 15000, 1))).toBe(true);
        });

        it('rejects the same 15s cycle once the Token is a level-40 medium', () => {
            // The band moved: medium at level 40 is ~18.9–31.4s, so a cycle that
            // was fine at level 1 is now too quick for the work it gates.
            expect(check(fixture('medium', 15000, 40))).toBe(false);
            expect(check(fixture('medium', 25000, 40))).toBe(true);
        });

        it('rejects a fast Token running at a slow Token\'s speed', () => {
            expect(check(fixture('fast', 25000, 1))).toBe(false);
        });

        it('lets a heavy Token run past the printed 120s top', () => {
            // Heavy's ceiling is where the simulator will place a cycle, not a
            // wall the designer may not cross (§13.3).
            expect(check(fixture('heavy', 240000, 1))).toBe(true);
            expect(check(fixture('heavy', 20000, 1))).toBe(false);
        });

        it('accepts a Quick Token at level 1 running 3s (TL-21), where the flat 10–30s rule would not', () => {
            expect(isTempo('quick')).toBe(true);
            expect(check(fixture('quick', 3000, 1))).toBe(true);
            expect(check(fixture('quick', 3000, undefined))).toBe(true);   // no level = level 1
            expect(check(fixture('quick', 6000, 1))).toBe(false);          // too slow for Quick
            expect(check(fixture('quick', 1500, 1))).toBe(false);          // too quick even for Quick
        });

        it('accepts a Fast Token at 6s since TL-21 widened Fast down to 4s', () => {
            expect(check(fixture('fast', 6000, 1))).toBe(true);
            expect(check(fixture('fast', 3000, 1))).toBe(false);
        });

        it('falls back to the untagged rule when the tempo is not a real one', () => {
            expect(isTempo('brisk')).toBe(false);
        });
    });
});

describe('Registry integrity', () => {
    /**
     * ⚠️ Guards the CMS's dropdowns.
     *
     * `tokenType`, `rarity` and `theme` used to be free strings. The CMS offers
     * them as closed dropdowns sourced from `tokenConstants.js`, so a value in
     * content that the constants do not list is a value the CMS can neither
     * display nor round-trip — a sync would quietly rewrite it. This catches
     * that drift in either direction: content inventing a value, or the
     * constants dropping one that content still uses.
     */
    it('classifies every Token with vocabulary the game declares', () => {
        for (const id of ALL_IDS) {
            const def = TOKENS[id];
            expect(isTokenType(def.tokenType), `${id} has unknown tokenType "${def.tokenType}"`).toBe(true);

            expect(isTokenRarity(def.rarity), `${id} has unknown rarity "${def.rarity}"`).toBe(true);

            // The `isTokenTheme(def.theme)` assertion that used to close this
            // loop was removed. It was the source of the "unknown theme \"\""
            // failures: `theme` was never a feature (`concept_audit.md` §A),
            // the game no longer declares a vocabulary for it, and nothing
            // reads the field.
        }
    });

    /**
     * ⚠️ The private `recipes[]` fork is retired (rework P2.5).
     *
     * A station's pool is the skill named in its `Works as` statement and
     * nothing else, so a leftover `recipes[]` array is content that looks
     * authored and can never run. A station-exclusive recipe belongs *in* the
     * pool, gated by a context tag only that station satisfies.
     */
    it('never declares a private recipes array', () => {
        for (const id of ALL_IDS) {
            expect(
                TOKENS[id].recipes?.length ?? 0,
                `${id} declares private recipes, which nothing reads any more`
            ).toBe(0);
        }
    });

    it('never declares the retired recipePool field', () => {
        for (const id of ALL_IDS) {
            const def = TOKENS[id];
            expect(
                def.recipePool ?? def.config?.recipePool ?? null,
                `${id} still carries recipePool — say it with a Works as statement instead`
            ).toBe(null);
        }
    });

    it('points every Works as statement at a skill the game knows', () => {
        const skillIds = new Set(getAllSkillIds());
        for (const id of ALL_IDS) {
            const skill = stationSkillOf(TOKENS[id]);
            if (!skill) continue;
            expect(skillIds.has(skill), `${id} works as unknown skill "${skill}"`).toBe(true);
        }
    });

    /**
     * `Fuel` and `tag_allium` used to be excused here: they arrived with the 23
     * migrated card-era recipes and nothing provided them. P2.6 pruned those
     * recipes, so the allowance is gone and this is a plain assertion again —
     * every context tag a recipe names has a Token that provides it.
     *
     * Providers are read through `getProvidedTagsWithTiers`, the reader the
     * engine itself uses: an `Acts as` statement (the only channel the CMS
     * writes; it deletes a top-level `provides`) plus the legacy `provides`
     * list. Reading `provides` alone could never see a CMS-authored provider,
     * which the first one, the Copper Anvil (Token Lifecycle 7.5), exposed.
     */
    it('points every recipe at a context Token that actually exists', () => {
        const provided = new Set();
        for (const def of Object.values(TOKENS)) {
            for (const tag of Object.keys(getProvidedTagsWithTiers(def))) provided.add(tag);
        }

        for (const id of ALL_IDS) {
            for (const route of productionRoutes(id)) {
                // A bare-string requirement is what the CMS writes before the
                // author picks a tier, so `tag` is undefined and there is
                // nothing to look up yet. Skipped as unfinished rather than
                // reported as pointing at a missing provider — the schema test
                // is where the shape itself is asserted.
                for (const tag of route.requiresContext.filter(Boolean)) {
                    expect(provided.has(tag), `${id} needs ${tag}, which nothing provides`).toBe(true);
                }
            }
        }
    });

    it('never depletes a Manager (D-140)', () => {
        // A restocker needing restocking would be exactly the chore it exists
        // to remove, so permanence is a rule rather than a large number.
        for (const id of ALL_IDS.filter(x => TOKENS[x].manages?.length)) {
            expect(TOKENS[id].uses, `${tokenName(id)} must never deplete`).toBeNull();
        }
    });

    /**
     * ⚠️ **Un-skipped**, and rewritten, because the thing it guarded against
     * cannot happen any more.
     */
    it('gives every enemy Token a usable level, style and drop table', () => {
        const enemies = ALL_IDS.filter(id => isEnemyDef(TOKENS[id]));
        expect(enemies.length, 'no enemy Tokens are authored at all').toBeGreaterThan(0);

        for (const id of enemies) {
            const profile = enemyProfileOf(TOKENS[id]);
            expect(profile, `${tokenName(id)} has no combat profile`).toBeTruthy();
            expect(profile.level, `${tokenName(id)} has a level below 1`).toBeGreaterThan(0);
            expect(profile.hp, `${tokenName(id)} has no hit points`).toBeGreaterThan(0);
            // The engine has heard of a style when the matchup cycle has a row for it
            // (melee > ranged > magic > stealth > melee). An authored style it does not
            // know would fall back to melee in the profile, so that is caught too.
            expect(
                Object.keys(RPS_RULES),
                `${tokenName(id)} fights in a style the engine has never heard of`
            ).toContain(profile.combatType);
            if (TOKENS[id].enemy?.style != null) {
                expect(profile.combatType, `${tokenName(id)}'s authored style was not kept`)
                    .toBe(TOKENS[id].enemy.style);
            }

            // A kill is a cycle, so a kill's loot is the cycle's output.
            for (const out of TOKENS[id].config?.outputs || []) {
                expect(getItem(out.itemId), `${tokenName(id)} drops ${out.itemId}, which does not exist`).toBeTruthy();
            }
        }
    });

});

describe('The opening', () => {
    it('the opening Tray is workable by the one hero the player starts with', () => {
        // A Token in that tray demanding a skill that does not exist would be the first thing
        // a new player tried and the first thing that refused them.
        const starting = new Set(STARTING_SKILL_IDS);

        for (const { typeId } of openingMat()) {
            const skill = TOKENS[typeId]?.config?.skill;
            if (!skill) continue;
            expect(starting.has(skill),
                `opening Tray Token ${typeId} demands "${skill}"`
            ).toBe(true);
        }
    });
});

/**
 * ⚠️ Rule — the derived economy in `data/` is what the simulator derives
 * (plan §16).
 *
 * ⚠️ **Deviation from the plan, deliberate and recorded.** §16 asks for "every
 * item has a `valueSource`" without qualification. Six of the eighteen shipped
 * items have **no producer at all** — the simulator files each as a Critical
 * orphan row — so no source exists to name and `valueSource` is null. The
 * unconditional form of the rule would fail on content that is behaving exactly
 * as the design says it should. Asserted here as: the field is present on every
 */
describe('⚠️ Rule 6 — items carry their derived value and its provenance', () => {
    const items = shippedItems;

    it('gives every item a valueSource field', () => {
        for (const [id, item] of Object.entries(items)) {
            expect('valueSource' in item, `${id} has no valueSource field`).toBe(true);
        }
    });

    it('names a real producer wherever a value was derived', () => {
        const solved = solveShippedCorpus();
        for (const [id, item] of Object.entries(items)) {
            if (item.value == null) {
                expect(item.valueSource, `${id} has no value but names a source`).toBe(null);
                continue;
            }
            expect(Number.isInteger(item.value), `${id}'s value ${item.value} is not an integer`).toBe(true);
            const source = item.valueSource;
            expect(source, `${id} has a value but no source`).toBeTruthy();
            const used = usedItemOfSource(source);
            expect(
                used ? hasUse(items[used]) : shippedTokens[source] != null || solved.recipeIds.has(source),
                `${id}'s valueSource "${source}" is not a Token, a recipe or an item's Use`
            ).toBe(true);
        }
    });

    it('⚠️ matches a fresh solve — the drift alarm', () => {
        const solved = solveShippedCorpus();
        for (const [id, item] of Object.entries(items)) {
            expect(item.value, `${id}'s stored value drifted from the solve`)
                .toBe(solved.items[id].value);
            expect(item.valueSource, `${id}'s stored valueSource drifted from the solve`)
                .toBe(solved.items[id].valueSource);
        }
    });

    it('carries no field from the retired balance engine', () => {
        for (const [id, item] of Object.entries(items)) {
            for (const field of RETIRED_ITEM_FIELDS) {
                expect(field in item, `${id} still carries ${field}`).toBe(false);
            }
        }
    });
});
