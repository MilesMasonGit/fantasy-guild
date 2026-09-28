// Fantasy Guild bench — runtime-registered content and layout helpers.
//
// Loaded THROUGH Vite (by the harness), so it shares module instances with the
// engine. Registers Token and item types in memory for this process only.
//
// ⚠️ Never `data/*.json`. A fresh game has no workable Token and a roster of 0
// by design, so every scenario builds its board from these fixtures. The test
// suite's own fixture Tokens (`src/tests/fixtures/testTokens.js`) are reused
// where they fit — they are stable instruments with known numbers — and the
// few shapes they lack are registered below under a `bench_` prefix.
//
// If a scenario's numbers change after a fixture edit, the fixture is the
// suspect, not the engine. Keep these boring and fixed.

import '../src/tests/fixtures/testTokens.js';
import { registerTokenTypes, tokenStartingUses } from '../src/config/registries/tokenRegistry.js';
import { GameState } from '../src/state/GameState.js';
import * as BoardState from '../src/systems/board/BoardState.js';
import * as Flags from '../src/systems/board/Flags.js';
import * as MatPlacement from '../src/systems/board/MatPlacement.js';
import * as SpawnerSystem from '../src/systems/board/SpawnerSystem.js';
import { getTokenType } from '../src/config/registries/tokenRegistry.js';
import * as HeroManager from '../src/systems/hero/HeroManager.js';
import { generateHero } from '../src/systems/hero/HeroGenerator.js';
import { xpForLevel } from '../src/utils/XPCurve.js';
import { SettingsManager } from '../src/systems/core/SettingsManager.js';
import { InventoryManager } from '../src/systems/inventory/InventoryManager.js';

/** Settings and the Bank, for scenarios (a scenario gets this module as `fixtures`). */
export { SettingsManager as settings, InventoryManager as inventory };

/** Token types the test fixtures do not have. */
export const BENCH_TOKENS = {
    /**
     * The Guild Hall stand-in: a 2×2 with `isGuildHall`, inert. Quest Tokens
     * spawn beside it, heroes walk home to it. (The shipped Hall carries
     * authored content — a trickle, upgrades — that would make the bench move
     * whenever content is retuned.)
     */
    bench_hall: {
        id: 'bench_hall', name: 'Bench Hall', tokenType: 'guild_hall', isGuildHall: true,
        rarity: 'common', theme: 'fixture', uses: null, size: 2, requiresHero: false,
        sprite: 'skill_social'
    },

    /** A spawned logging Token that runs out — 40 cycles — so its spawner refills it. */
    bench_tree: {
        id: 'bench_tree', name: 'Bench Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 40, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 8000, xp: 3,
            inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    },
    /** The mining twin of `bench_tree`. */
    bench_rock: {
        id: 'bench_rock', name: 'Bench Rock', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 40, sprite: 'skill_industry',
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 3,
            inputs: [],
            outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
        }
    },

    /** Spawners (Token Lifecycle 3.3): a family cap of `allowance` each. */
    bench_forest: {
        id: 'bench_forest', name: 'Bench Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'bench_tree', weight: 1 }], allowance: 10, intervalMs: 5000, upkeep: [] }
    },
    bench_quarry: {
        id: 'bench_quarry', name: 'Bench Quarry', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
        spawner: { spawns: [{ typeId: 'bench_rock', weight: 1 }], allowance: 10, intervalMs: 5000, upkeep: [] }
    },
    bench_camp: {
        id: 'bench_camp', name: 'Bench Camp', tokenType: 'spawner',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_crime',
        spawner: { spawns: [{ typeId: 'bench_goblin', weight: 1 }], allowance: 3, intervalMs: 30000, upkeep: [] }
    },

    /** A bigger camp for S3: five goblins. */
    bench_warcamp: {
        id: 'bench_warcamp', name: 'Bench War Camp', tokenType: 'spawner',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_crime',
        spawner: { spawns: [{ typeId: 'bench_goblin', weight: 1 }], allowance: 5, intervalMs: 30000, upkeep: [] }
    },

    /** A hostile level-1 melee enemy with one charge: a kill clears it and its camp respawns it. */
    bench_goblin: {
        id: 'bench_goblin', name: 'Bench Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 'skill_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee', budgetScale: 0.3, hostile: true },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0,
            inputs: [],
            outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }]
        }
    },

    /** A station fed by the producers: 2 wood → 1 glowcap. Starves when wood runs short. */
    bench_mill: {
        id: 'bench_mill', name: 'Bench Mill', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 5000, sprite: 'skill_flask',
        config: {
            skill: 'alchemy', skillRequired: 1, cycleTimeMs: 15000, xp: 6,
            inputs: [{ itemId: 'fixture_oak_wood', quantity: 2 }],
            outputs: [{ itemId: 'item_glowcap', quantity: 1, chance: 100 }]
        }
    },
    /**
     * A station nothing on the mat can feed (coal): the "stalled station". With
     * a couple of coal in the Bank a hero claims it, runs a cycle, and is then
     * left standing on a Token that cannot run — the case CR3-005 is about.
     */
    bench_smelter: {
        id: 'bench_smelter', name: 'Bench Smelter', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 5000, sprite: 'skill_industry',
        config: {
            skill: 'smithing', skillRequired: 1, cycleTimeMs: 12000, xp: 6,
            inputs: [{ itemId: 'item_coal', quantity: 2 }],
            outputs: [{ itemId: 'item_spider_silk', quantity: 1, chance: 100 }]
        }
    },

    /** One rule with BOARD reach: +5 % yield to every Token on the mat (CR3-004). */
    bench_board_aura: {
        id: 'bench_board_aura', name: 'Bench Board Aura', tokenType: 'buff',
        rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_occult',
        statements: [
            { id: 'stm_bench_board_aura', keyword: 'provides', reach: 'board', to: { mode: 'all' },
              payload: { type: 'YIELD', bucket: 'percentage', value: 0.05 } }
        ]
    }
};

registerTokenTypes(BENCH_TOKENS);

/** Skills every bench hero holds, and at what level. */
export const HERO_SKILLS = {
    logging: 30, mining: 30, alchemy: 30, smithing: 30,
    melee: 25
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Put a Token on the mat at `(x, y)`, no rules (as `src/tests/fixtures/mat.js` does). */
export function placeAt(typeId, x, y, origin = BoardState.ORIGIN.PLACED) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, origin);
    return BoardState.addToken(instance, Math.round(x), Math.round(y));
}

/**
 * `n` heroes with fixed ids (`hero_bench_0` …) and the skills above. Hero ids
 * are normally random (nanoid); fixed ids keep two runs identical.
 */
export function makeHeroes(n, skills = HERO_SKILLS) {
    GameState.state.progress.rosterLimit = Math.max(n, GameState.state.progress.rosterLimit || 0);
    const heroes = [];
    for (let i = 0; i < n; i++) {
        const hero = generateHero({ name: `Bench ${i}` });
        hero.id = `hero_bench_${i}`;
        for (const [skill, level] of Object.entries(skills)) {
            hero.skills[skill] = { level, xp: xpForLevel(level) };
        }
        heroes.push(HeroManager.addHero(hero));
    }
    return heroes;
}

/** Plant a hero's flag at a point, as the player's drop does. */
export function plant(heroId, point, options = {}) {
    return Flags.plant(heroId, point, options);
}

/**
 * Points on a lattice `step` apart, filling the mat row by row, keeping
 * `margin` from every edge.
 */
export function lattice(w, h, step = 160, margin = 80) {
    const points = [];
    for (let y = margin; y <= h - margin; y += step) {
        for (let x = margin; x <= w - margin; x += step) points.push({ x, y });
    }
    return points;
}

/**
 * Fill every spawner to its family cap now, through the real
 * `SpawnerSystem.attemptSpawn` (landing, pushes and all), rather than waiting
 * minutes of game time for the clocks. Round-robin, so every spawner gets its
 * share of the room. Returns how many Tokens landed.
 */
export function prefillSpawners(maxRounds = 50) {
    let landed = 0;
    for (let round = 0; round < maxRounds; round++) {
        let any = false;
        const spawners = BoardState.tokens().filter(t => SpawnerSystem.isSpawner(getTokenType(t.typeId)));
        for (const s of spawners) {
            if (SpawnerSystem.attemptSpawn(s, getTokenType(s.typeId), Math.random)) { landed++; any = true; }
        }
        if (!any) break;
    }
    return landed;
}

/** The first of `points` where a Token of `typeId` may legally stand (or any spot near the first). */
export function freeSpot(typeId, points) {
    for (const p of points) {
        if (MatPlacement.isLegal(typeId, p)) return p;
    }
    return points.length ? MatPlacement.findSpotAnywhere(typeId, points[0]) : null;
}

/** A tally of what is on the mat, for the report. */
export function census() {
    const out = { tokens: 0, placed: 0, spawned: 0, enemies: 0, quests: 0, alerts: 0, sprites: 0, heroesWorking: 0 };
    for (const t of BoardState.tokens()) {
        out.tokens++;
        if (BoardState.originOf(t) === BoardState.ORIGIN.SPAWNED) out.spawned++;
        else out.placed++;
        if (t.typeId === 'bench_goblin') out.enemies++;
        if (t.typeId === 'token_quest') out.quests++;
        if (t.alert) out.alerts++;
    }
    out.sprites = (GameState.state?.board?.sprites || []).length;
    for (const hero of GameState.state?.heroes || []) {
        if (BoardState.workTokenOf(hero.id)) out.heroesWorking++;
    }
    return out;
}
