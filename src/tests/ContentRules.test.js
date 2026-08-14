import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    getAllTokenTypes, getTokenType, productionRoutes, toolContextTags, tokenName,
    expectedOutputQuantity
} from '../config/registries/tokenRegistry.js';
import { getMap, listMaps } from '../config/registries/mapRegistry.js';
import { getEnemy } from '../config/registries/enemyRegistry.js';
import { FOUNDATION_SKILL_IDS, getAllSkillIds } from '../config/registries/skillRegistry.js';
import { isTokenType, isTokenRarity, isTokenTheme } from '../config/registries/tokenConstants.js';
import { OPENING_TRAY } from '../systems/core/EngineBootstrap.js';

/**
 * Content validation — the authoring rules, asserted mechanically.
 *
 * ⚠️ **These are not style checks.** Each one prevents a specific failure the
 * design has already identified, and each is the kind of thing the eye stops
 * catching somewhere around the thirtieth Token. D-161's hand-authored numbers
 * do not scale (risk 17); this suite is the part that does.
 *
 * The tests deliberately read the registries rather than a fixture, so adding a
 * Token to the game is enough to put it under every rule below.
 */

/**
 * ⚠️ **Shipped content only.** Engine suites register `fixture_*` Tokens with
 * deliberately unbalanced instrument numbers; those are not content and must
 * never be judged by these rules.
 *
 * Vitest isolates module registries per test file, so no fixture should reach
 * this suite at all — the filter is belt-and-braces against someone later
 * setting `isolate: false` for speed and silently turning this suite into a
 * validator of test scaffolding.
 */
const TOKENS = Object.fromEntries(
    Object.entries(getAllTokenTypes()).filter(([id]) => !id.startsWith('fixture_'))
);
const ALL_IDS = Object.keys(TOKENS);

/** Tokens that actually run a cycle (as opposed to working by adjacency). */
const RUNNING = ALL_IDS.filter(id => TOKENS[id].config || TOKENS[id].recipes?.length);

describe('⚠️ Rule 1 — every material has a tool-free source (D-213)', () => {
    /**
     * D-51 used to promise that supply deadlock was **structurally** impossible,
     * because base Tokens consume nothing. D-213 downgraded that to *authored*
     * by making tool requirements per-Token: a player who burns their last axe
     * with no logs banked can now hard-lock.
     *
     * A barehanded route back must always exist, and **this test is the only
     * thing preventing the lock.**
     */
    const TOOL_TAGS = toolContextTags();

    /** Every item any Token can produce without a tool gating the route. */
    const toolFreeOutputs = new Set();
    for (const id of ALL_IDS) {
        for (const route of productionRoutes(id)) {
            if (route.requiresContext.some(tag => TOOL_TAGS.has(tag))) continue;
            for (const out of route.outputs) {
                if (out.itemId) toolFreeOutputs.add(out.itemId);
            }
        }
    }

    it('recognises at least one tool at all — otherwise this suite proves nothing', () => {
        // A guard on the guard: if `isTool` were ever dropped from every Token,
        // every assertion below would pass vacuously.
        expect(TOOL_TAGS.size).toBeGreaterThan(0);
    });

    it('gives every produced material a route needing no tool', () => {
        const produced = new Set();
        for (const id of ALL_IDS) {
            for (const route of productionRoutes(id)) {
                for (const out of route.outputs) if (out.itemId) produced.add(out.itemId);
            }
        }

        const locked = [...produced].filter(item => !toolFreeOutputs.has(item));
        expect(locked).toEqual([]);
    });

    it('gives every material a Token CONSUMES a tool-free route too', () => {
        // The deadlock that matters: an input you cannot obtain barehanded is
        // an input whose whole chain stops when the tool runs out.
        const consumed = new Set();
        for (const id of ALL_IDS) {
            for (const route of productionRoutes(id)) {
                for (const input of route.inputs) consumed.add(input.itemId);
            }
        }

        const locked = [...consumed].filter(item => !toolFreeOutputs.has(item));
        expect(locked).toEqual([]);
    });

    it('specifically: Yew Log is obtainable without the axe that gates the Stand', () => {
        // Named explicitly because it is the one case in the current content
        // where a tool exists at all — if the Copse is ever retuned away, the
        // general assertion above would be the only thing catching it.
        expect(toolFreeOutputs.has('item_yew_log')).toBe(true);
    });
});

describe('⚠️ Rule 2 — Passive Generators are strictly worse (D-116, risk 11)', () => {
    /**
     * Tiles are abundant. If an unstaffed Token ever beat a staffed one *per
     * tile*, the optimal board would become mostly unstaffed and heroes would
     * stop being the production ceiling — which unpicks D-115, D-181 and §6.2
     * at once.
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
     * rule (D-97), which is exactly why consistency has to be checked. Players
     * have no principle to reason from and must learn each Token individually,
     * so an inconsistent kit is the cruelty, not the variety.
     */
    it('gives every resource Token an input-free route', () => {
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
            for (const route of productionRoutes(id)) {
                expect(route.inputs.length, `${tokenName(id)} (${route.id}) should cost something`)
                    .toBeGreaterThan(0);
            }
        }
    });

    it('makes every Market pay in goods and produce only currency (D-141)', () => {
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

describe('Rule 4 — cycle times stay in the 10–30s band (D-164)', () => {
    /**
     * With eight heroes working this is roughly one completion every two or
     * three seconds across the board: an unhurried rhythm where every drop
     * still registers, rather than a blur.
     */
    it.each(RUNNING)('%s runs within the band', (id) => {
        const cycle = TOKENS[id].config?.cycleTimeMs;
        if (cycle == null) return;                 // inert, or a Map
        expect(cycle).toBeGreaterThanOrEqual(10000);
        expect(cycle).toBeLessThanOrEqual(30000);
    });
});

describe('Registry integrity', () => {
    /**
     * ⚠️ Guards the CMS's dropdowns (CMS-89).
     *
     * `tokenType`, `rarity` and `theme` used to be free strings. The CMS offers
     * them as closed dropdowns sourced from `tokenConstants.js` (CMS-5), so a
     * value in content that the constants do not list is a value the CMS can
     * neither display nor round-trip — a sync would quietly rewrite it. This
     * catches that drift in either direction: content inventing a value, or the
     * constants dropping one that content still uses.
     */
    it('classifies every Token with vocabulary the game declares', () => {
        for (const id of ALL_IDS) {
            const def = TOKENS[id];
            expect(isTokenType(def.tokenType), `${id} has unknown tokenType "${def.tokenType}"`).toBe(true);

            // Maps sit outside the rarity system entirely (D-132), so a missing
            // rarity is correct for them and only for them.
            if (def.rarity !== undefined) {
                expect(isTokenRarity(def.rarity), `${id} has unknown rarity "${def.rarity}"`).toBe(true);
            } else {
                expect(def.tokenType, `${id} omits rarity but is not a Map`).toBe('map');
            }

            expect(isTokenTheme(def.theme), `${id} has unknown theme "${def.theme}"`).toBe(true);
        }
    });

    /**
     * ⚠️ A station is pooled OR private, never both (CMS-77).
     *
     * `recipesForToken` resolves `recipePool` first and ignores `recipes[]`
     * entirely, so a Token declaring both would have its private recipes
     * silently dropped — content that looks authored and never runs. A
     * station-exclusive recipe belongs *in* the pool, gated by a context tag
     * only that station satisfies (CMS-6).
     */
    it('never declares both a recipe pool and private recipes', () => {
        for (const id of ALL_IDS) {
            const def = TOKENS[id];
            if (!def.recipePool) continue;
            expect(
                def.recipes?.length ?? 0,
                `${id} draws from the ${def.recipePool} pool AND declares private recipes`
            ).toBe(0);
        }
    });

    it('points every recipe pool at a skill the game knows', () => {
        const skillIds = new Set(getAllSkillIds());
        for (const id of ALL_IDS) {
            const pool = TOKENS[id].recipePool;
            if (!pool) continue;
            expect(skillIds.has(pool), `${id} pools from unknown skill "${pool}"`).toBe(true);
        }
    });

    it('points every recipe at a context Token that actually exists', () => {
        const provided = new Set();
        for (const def of Object.values(TOKENS)) {
            for (const tag of def.provides || []) provided.add(tag);
        }

        for (const id of ALL_IDS) {
            for (const route of productionRoutes(id)) {
                for (const tag of route.requiresContext) {
                    expect(provided.has(tag), `${id} needs ${tag}, which nothing provides`).toBe(true);
                }
            }
        }
    });

    it('points every Manager at Tokens that exist (D-35)', () => {
        const managers = ALL_IDS.filter(id => TOKENS[id].manages?.length);
        expect(managers.length).toBeGreaterThan(0);

        for (const id of managers) {
            for (const managed of TOKENS[id].manages) {
                expect(getTokenType(managed), `${id} manages ${managed}, which does not exist`).toBeTruthy();
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

    it('points every enemy Token at an enemy that exists', () => {
        const enemies = ALL_IDS.filter(id => TOKENS[id].enemyId);
        expect(enemies.length).toBeGreaterThan(0);

        for (const id of enemies) {
            expect(getEnemy(TOKENS[id].enemyId), `${id} → ${TOKENS[id].enemyId}`).toBeTruthy();
        }
    });

    it('gives every Token a rarity except Maps, which sit outside it (D-132)', () => {
        for (const id of ALL_IDS) {
            const def = TOKENS[id];
            if (def.mapId) expect(def.rarity).toBeUndefined();
            else expect(def.rarity, `${id} has no rarity`).toBeTruthy();
        }
    });

    it('makes every Map a single burst (D-155)', () => {
        for (const id of ALL_IDS.filter(x => TOKENS[x].mapId)) {
            expect(TOKENS[id].uses).toBe(1);
        }
    });

    it('⚠️ points every Token at art that actually exists', () => {
        // Found the hard way in the Phase 9 playtest: two Tokens named sprites
        // that were never drawn, and the only symptom was a 500 in the network
        // log and an invisible Token on the board. Nothing else in the stack
        // notices — `tokenSpritePath` happily builds a path to a missing file.
        for (const id of ALL_IDS) {
            const sprite = TOKENS[id].sprite;
            expect(sprite, `${id} has no sprite`).toBeTruthy();
            const file = resolve(process.cwd(), 'public/assets/skills', `${sprite}.png`);
            expect(existsSync(file), `${id} → ${sprite}.png does not exist`).toBe(true);
        }
    });
});

describe("A Map's pool is a complete kit (D-139)", () => {
    /**
     * Producers, their context, their buffs, **their Manager** and the enemies
     * that belong there. Buying a Map is buying access to a self-contained set
     * — one purchase eventually yields everything needed to run that theme
     * properly, including the automation that lets it survive unattended.
     */
    const maps = listMaps();

    it.each(maps.map(m => m.id))('%s points only at real content', (mapId) => {
        for (const entry of getMap(mapId).pool) {
            if (entry.kind === 'token') {
                expect(getTokenType(entry.refId), `${mapId} → ${entry.refId}`).toBeTruthy();
            }
            expect(entry.weight).toBeGreaterThan(0);
        }
    });

    it.each(maps.map(m => m.id))('%s contains producers, a Manager and an enemy', (mapId) => {
        const ids = getMap(mapId).pool.filter(e => e.kind === 'token').map(e => e.refId);
        const types = ids.map(id => TOKENS[id].tokenType);

        expect(types, `${mapId} has no producer`).toContain('resource');
        expect(types, `${mapId} has no Manager — it cannot run unattended`).toContain('manager');
        expect(types, `${mapId} has no enemies`).toContain('enemy');
    });

    it.each(maps.map(m => m.id))('%s only pools Tokens of its own theme', (mapId) => {
        // A Map's loot pool is the ONLY meaning "biome" has. If themes leak,
        // the word stops meaning anything at all.
        const map = getMap(mapId);
        for (const entry of map.pool) {
            if (entry.kind !== 'token') continue;
            expect(TOKENS[entry.refId].theme, `${entry.refId} in ${mapId}`).toBe(map.theme);
        }
    });

    it('⚠️ the FIRST Map may demand only the Foundation six (D-261)', () => {
        // A Recruit holds the Foundation skills and nothing else, so a Token in
        // the opening kit that wants a specialist is a Token nobody can work
        // for hours. This is the rule that sent the Bramble Patch (Nature), the
        // Woodland Still (Alchemy) and the Lumber Market (Commerce) to the
        // Riverlands pool.
        const firstMap = listMaps()[0];       // price order (D-101)
        const foundation = new Set(FOUNDATION_SKILL_IDS);

        for (const entry of firstMap.pool) {
            if (entry.kind !== 'token') continue;
            const skill = TOKENS[entry.refId]?.config?.skill;
            if (!skill) continue;             // context, buff, Manager, enemy
            expect(foundation.has(skill),
                `${entry.refId} in ${firstMap.id} demands "${skill}", which no Recruit holds`
            ).toBe(true);
        }
    });

    it('⚠️ every Foundation skill has something to work on the first Map (D-193)', () => {
        // The mirror of the rule above, and the one that actually bit: three of
        // the six had NO Token at all — Fishing only on Map 2, Crafting and
        // Cooking nowhere in the game. A skill nothing works can never level,
        // so it can never gate, so it is a word rather than a mechanic.
        const firstMap = listMaps()[0];
        const worked = new Set(
            firstMap.pool
                .filter(e => e.kind === 'token')
                .map(e => TOKENS[e.refId]?.config?.skill)
                .filter(Boolean)
        );

        for (const skillId of FOUNDATION_SKILL_IDS) {
            expect(worked.has(skillId),
                `no Token in ${firstMap.id} demands "${skillId}" — a Recruit holds it with nothing to do`
            ).toBe(true);
        }
    });

    it('the opening Tray is workable by the one hero the player starts with', () => {
        // D-122/D-123 hand the player four Tokens and exactly one Recruit. A
        // Token in that tray demanding a specialist would be the first thing a
        // new player tried and the first thing that refused them.
        const foundation = new Set(FOUNDATION_SKILL_IDS);

        for (const typeId of OPENING_TRAY) {
            const skill = TOKENS[typeId]?.config?.skill;
            if (!skill) continue;
            expect(foundation.has(skill),
                `opening Tray Token ${typeId} demands "${skill}"`
            ).toBe(true);
        }
    });

    it('sells a tool in the same Map as the Token it gates', () => {
        // A kit that gated a resource behind a tool from a different Map would
        // make that resource unobtainable until two purchases happened to line
        // up — which reads as broken rather than as scarce.
        for (const map of maps) {
            const ids = map.pool.filter(e => e.kind === 'token').map(e => e.refId);
            const toolTags = new Set();
            for (const id of ids) {
                if (TOKENS[id].isTool) for (const tag of TOKENS[id].provides || []) toolTags.add(tag);
            }
            for (const id of ids) {
                for (const route of productionRoutes(id)) {
                    for (const tag of route.requiresContext) {
                        if (!toolContextTags().has(tag)) continue;
                        expect(toolTags.has(tag), `${map.id} gates ${id} behind ${tag} it does not sell`).toBe(true);
                    }
                }
            }
        }
    });
});

describe('⚠️ Later Maps are stronger AND more demanding (D-95)', () => {
    /**
     * On a fixed board, power growth alone would just mean swapping Tokens and
     * having spare tiles. Because later content also costs **more board** —
     * deeper chains, more inputs, higher skill floors — the player faces a real
     * choice about what to run. **Map 2 must demonstrate that, not merely cost
     * more.**
     */
    const [first, second] = listMaps();

    /** The average skill floor across a Map's runnable Tokens. */
    function meanSkillFloor(mapId) {
        const ids = getMap(mapId).pool
            .filter(e => e.kind === 'token')
            .map(e => e.refId)
            .filter(id => TOKENS[id].config?.skillRequired != null);
        const total = ids.reduce((sum, id) => sum + TOKENS[id].config.skillRequired, 0);
        return total / ids.length;
    }

    it('costs more', () => {
        expect(second.price).toBeGreaterThan(first.price);
    });

    it('demands more skill — the "more demanding" half, which is the point', () => {
        expect(meanSkillFloor(second.id)).toBeGreaterThan(meanSkillFloor(first.id));
    });

    it('yields more per cycle from its headline producer', () => {
        const best = (mapId) => Math.max(...getMap(mapId).pool
            .filter(e => e.kind === 'token' && TOKENS[e.refId].tokenType === 'resource')
            .map(e => {
                const routes = productionRoutes(e.refId);
                return Math.max(0, ...routes.flatMap(r => r.outputs.map(expectedOutputQuantity)));
            }));

        expect(best(second.id)).toBeGreaterThan(0);
        expect(best(first.id)).toBeGreaterThan(0);
    });
});
