// One calibration setup, played in the real engine and priced by the rate calculator (loaded THROUGH
// Vite by `bench/calibration/worker.mjs`, so it shares module instances with the engine).
//
// The engine boots as the bench's does (`bench/lib/harness.mjs`: settings, the engine, a new game, the
// production logger, the console quiet), builds the setup's board from shipped content, warms up,
// then plays the measured hours through the game's own catch-up (`CatchUp.run`), an hour at a time.
//
// ⚠️ It does not load `bench/fixtures.mjs` or the harness that imports it: they load the test
// fixtures, whose recipe pools take over shipped skills (a Furnace would offer only a fixture bar).
//
// Counted: what lands as loot, item by item (`made`); the Bank and the floor before against after
// (`net`, loot waits on the mat with auto-collect off, the shipped default); XP off each hero's
// skills; finished cycles per Token type.

import fs from 'node:fs';
import path from 'node:path';
import { EngineBootstrap } from '../../src/systems/core/EngineBootstrap.js';
import { SettingsManager } from '../../src/systems/core/SettingsManager.js';
import { DiscoveryManager } from '../../src/systems/core/DiscoveryManager.js';
import { AudioSystem } from '../../src/systems/core/AudioSystem.js';
import { logger } from '../../src/utils/Logger.js';
import { pinMat, REFERENCE_STEPS } from '../scenarios/referenceMat.mjs';
import { setMatTuning } from '../../src/config/matTuning.js';
import * as CatchUp from '../../src/systems/core/CatchUp.js';
import { GameState } from '../../src/state/GameState.js';
import { EventBus } from '../../src/systems/core/EventBus.js';
import { InventoryManager } from '../../src/systems/inventory/InventoryManager.js';
import { EquipmentManager } from '../../src/systems/equipment/EquipmentManager.js';
import * as StationRecipe from '../../src/systems/board/StationRecipe.js';
import * as SpriteLayer from '../../src/systems/board/SpriteLayer.js';
import * as BoardState from '../../src/systems/board/BoardState.js';
import * as TileModifiers from '../../src/systems/board/TileModifiers.js';
import * as Orders from '../../src/systems/board/Orders.js';
import * as SpawnerSystem from '../../src/systems/board/SpawnerSystem.js';
import * as Flags from '../../src/systems/board/Flags.js';
import { BOARD_EVENTS } from '../../src/systems/board/boardEvents.js';
import { ItemRateTracker } from '../../src/systems/inventory/ItemRateTracker.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../src/config/registries/tokenRegistry.js';
import * as HeroManager from '../../src/systems/hero/HeroManager.js';
import { generateHero } from '../../src/systems/hero/HeroGenerator.js';
import { xpForLevel } from '../../src/utils/XPCurve.js';
import { buildRateBook, chainRates } from '../../src/systems/progression/ledger/rates.js';
import { SETUPS, HALL } from './setups.mjs';

const HOUR_MS = 3_600_000;

/**
 * The Guild Hall stand-in (the bench's `bench_hall`): heroes start and go home there. The shipped Hall
 * pays Passive Production and hands out bounties, which would add to what a setup makes.
 */
registerTokenTypes({
    calibration_hall: {
        id: 'calibration_hall', name: 'Calibration Hall', tokenType: 'guild_hall', isGuildHall: true,
        rarity: 'common', theme: 'fixture', uses: null, size: 2, requiresHero: false, sprite: 's_social'
    }
});

/**
 * The content as the CMS and the ledger read it: the shipped `data/` files, untouched.
 * ⚠️ The perk tables too: a level-10 hero holds their skill's milestone perks in the engine, so a
 * calculator priced without them is not pricing the same hero.
 */
export function loadContent(root) {
    const load = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
    return { tokens: load('tokens.json'), items: load('items.json'), recipes: load('tokenRecipes.json'), effects: load('effects.json'), skillPerks: load('skillPerks.json') };
}

/** As the bench boots (`harness.boot`): a quiet console, the shipped logger, then a new game. */
function boot(seed) {
    for (const level of ['log', 'info', 'warn', 'debug']) console[level] = () => {};
    logger.isDevelopment = false;
    SettingsManager.init();
    EngineBootstrap.init();
    globalThis.__bench.reseed(seed);
    globalThis.__bench.clock.enable();
    GameState.initNew();
    DiscoveryManager.init();
    AudioSystem.init();
    InventoryManager.init();
}

function placeAt(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED);
    return BoardState.addToken(instance, Math.round(x), Math.round(y));
}

/** Fill every spawner to its cap now, through the real `attemptSpawn` (`fixtures.prefillSpawners`). */
function prefillSpawners(maxRounds = 50) {
    for (let round = 0; round < maxRounds; round++) {
        let any = false;
        for (const s of BoardState.tokens().filter(t => SpawnerSystem.isSpawner(getTokenType(t.typeId)))) {
            if (SpawnerSystem.attemptSpawn(s, getTokenType(s.typeId), Math.random)) any = true;
        }
        if (!any) break;
    }
}

function bankAndFloor() {
    const out = {};
    for (const [itemId, entry] of Object.entries(GameState.state?.inventory?.items || {})) out[itemId] = Number(entry?.quantity) || 0;
    for (const sprite of SpriteLayer.getSprites() || []) {
        if (sprite?.kind === 'item' && sprite.refId) out[sprite.refId] = (out[sprite.refId] || 0) + (Number(sprite.quantity) || 0);
    }
    return out;
}

function xpBySkill() {
    const out = {};
    for (const hero of GameState.state?.heroes || []) {
        for (const [skill, data] of Object.entries(hero.skills || {})) out[skill] = (out[skill] || 0) + (Number(data?.xp) || 0);
    }
    return out;
}

/**
 * Count what lands as loot, item by item: every item a cycle, a bonus or a kill makes reaches the mat
 * through `SpriteLayer.addSprite`, which tells the item rate tracker. Spending is told as a negative
 * gain, so only positive amounts count.
 */
function countMade() {
    const made = {};
    const original = ItemRateTracker.recordGain;
    ItemRateTracker.recordGain = function (itemId, amount) {
        if (amount > 0) made[itemId] = (made[itemId] || 0) + amount;
        return original.call(this, itemId, amount);
    };
    return { made, stop: () => { ItemRateTracker.recordGain = original; } };
}

/** The board and the heroes as the run ended, for reading a surprising number. */
function snapshotState() {
    return {
        tokens: BoardState.tokens().map(t => ({ typeId: t.typeId, x: Math.round(t.x), y: Math.round(t.y), alert: t.alert || null, uses: t.usesRemaining ?? null })),
        heroes: (GameState.state?.heroes || []).map(h => ({ id: h.id, name: h.name, work: BoardState.getTokenById(BoardState.workTokenOf(h.id))?.typeId ?? null, status: Flags.statusOf(h.id) }))
    };
}

/** Board events with their game time, for reading a lifecycle (`--trace`): the first 400. */
function traceEvents() {
    const rows = [];
    const at = () => Math.round((GameState.state?.time?.gameTimeMs || 0) / 100) / 10;
    const name = (instanceId) => BoardState.getTokenById(instanceId)?.typeId ?? null;
    const offs = [
        ['spawned', BOARD_EVENTS.TOKEN_SPAWNED], ['depleted', BOARD_EVENTS.TOKEN_DEPLETED], ['transformed', BOARD_EVENTS.TOKEN_TRANSFORMED],
        ['resting', BOARD_EVENTS.TOKEN_RESTING], ['respawned', BOARD_EVENTS.TOKEN_RESPAWNED], ['cycle', BOARD_EVENTS.CYCLE_COMPLETE],
        ['growth', BOARD_EVENTS.GROWTH_ALERT_CHANGED], ['spawner', BOARD_EVENTS.SPAWNER_ALERT_CHANGED], ['start', BOARD_EVENTS.CYCLE_START]
    ].map(([label, event]) => EventBus.subscribe(event, (payload = {}) => {
        if (rows.length >= 400) return;
        rows.push({ t: at(), e: label, id: payload.instanceId ?? null, type: payload.typeId ?? name(payload.instanceId), hero: payload.heroId ?? null, extra: payload.fromTypeId ?? payload.toTypeId ?? payload.alert ?? payload.state ?? null });
    }));
    return { rows, stop: () => offs.forEach(off => off()) };
}

function census() {
    const out = {};
    for (const t of BoardState.tokens()) out[t.typeId] = (out[t.typeId] || 0) + 1;
    return out;
}

/** Play `ms` of game time through the game's catch-up, as a load after that long away would. */
async function play(ms) {
    const clock = globalThis.__bench.clock;
    let played = 0;
    while (played < ms) {
        const chunk = Math.min(HOUR_MS, ms - played);
        const savedAt = clock.nowMs;
        await CatchUp.run({ savedAt, now: savedAt + chunk, save: false, sliceMs: Infinity, yieldFn: () => Promise.resolve() });
        clock.advance(chunk);
        played += chunk;
    }
}

/**
 * @param {{ id: string, seed?: number, hours?: number, root: string }} opts
 */
export async function runSetup({ id, seed = 1, hours = 8, root, trace = false }) {
    const setup = SETUPS.find(s => s.id === id);
    if (!setup) throw new Error(`no calibration setup ${id}`);
    const t0 = performance.now();

    boot(seed);
    pinMat(setMatTuning, REFERENCE_STEPS);
    placeAt('calibration_hall', HALL.x, HALL.y);
    for (const [itemId, n] of Object.entries(setup.bank || {})) InventoryManager.addItem(itemId, n);

    const heroes = [];
    const ctx = {
        place: (typeId, x, y) => {
            const placed = placeAt(typeId, x, y);
            if (!placed) throw new Error(`${typeId} found no room at ${x},${y}`);
            return placed;
        },
        prefillSpawners,
        order: (hero, at) => {
            const r = Orders.orderAt(hero.id, { x: at.x, y: at.y });
            if (!r.success) throw new Error(`${hero.name} could not be ordered onto ${at.typeId}: ${r.reason}`);
        },
        hero: (name, skills, carried) => {
            // As `fixtures.makeHeroes` makes them (a fixed id, set skills), one at a time.
            GameState.state.progress.rosterLimit = Math.max(heroes.length + 1, GameState.state.progress.rosterLimit || 0);
            const made = generateHero({ name });
            made.id = `hero_calibration_${heroes.length}`;
            for (const [skill, level] of Object.entries(skills)) made.skills[skill] = { level, xp: xpForLevel(level) };
            const h = HeroManager.addHero(made);
            for (const itemId of carried) {
                InventoryManager.addItem(itemId, 1);
                const r = EquipmentManager.equipItem(h.id, itemId);
                if (!r.success) throw new Error(`${name} could not carry ${itemId}: ${r.error}`);
            }
            heroes.push(h);
            return h;
        },
        selectRecipe: (instance, recipeId) => {
            const live = BoardState.getTokenById(instance.id) || instance;
            if (!StationRecipe.setSelectedRecipe(live, recipeId)) {
                throw new Error(`${live.typeId} does not offer ${recipeId}: its pool is ${StationRecipe.poolFor(getTokenType(live.typeId)).map(r => r.id).join(', ') || 'empty'}`);
            }
        }
    };
    setup.build(ctx);
    TileModifiers.rebuildAll();
    EventBus.publish('heroes_updated');
    EventBus.publish('inventory_updated');

    await play(setup.warmupMs);

    const events = trace ? traceEvents() : null;
    const counter = countMade();
    const cycles = {};
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, ({ typeId, failed } = {}) => {
        if (typeId && !failed) cycles[typeId] = (cycles[typeId] || 0) + 1;
    });
    const itemsBefore = bankAndFloor();
    const xpBefore = xpBySkill();
    const censusBefore = census();
    const tPlay = performance.now();
    await play(hours * HOUR_MS);
    const playMs = performance.now() - tPlay;
    off();
    counter.stop();
    events?.stop();
    const itemsAfter = bankAndFloor();
    const xpAfter = xpBySkill();

    const perHour = (before, after) => {
        const out = {};
        for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
            const d = (after[k] || 0) - (before[k] || 0);
            if (d) out[k] = d / hours;
        }
        return out;
    };

    const book = buildRateBook(loadContent(root));
    const calc = chainRates(book, setup.works);

    return {
        id, name: setup.name, seed, hours,
        engine: {
            made: Object.fromEntries(Object.entries(counter.made).map(([k, v]) => [k, v / hours])),
            net: perHour(itemsBefore, itemsAfter),
            xp: perHour(xpBefore, xpAfter),
            cyclesPerHour: Object.fromEntries(Object.entries(cycles).map(([k, v]) => [k, v / hours])),
            census: { before: censusBefore, after: census() },
            state: snapshotState(),
            trace: events?.rows ?? null,
            playMsPerGameHour: playMs / hours
        },
        calc: {
            made: calc.made,
            spent: calc.spent,
            net: calc.net,
            xp: calc.xp,
            works: calc.works.map(w => ({
                target: w.target, fed: w.fed, cyclesPerHour: w.cyclesPerHour, limitedBy: w.rate.limitedBy, ok: w.rate.ok, reason: w.rate.reason,
                cycleMs: w.rate.cycleMs, lifecycle: w.rate.lifecycle, factors: w.rate.factors,
                unmodelled: w.rate.unmodelled, assumptions: w.rate.assumptions
            }))
        },
        compare: setup.compare,
        wallMs: performance.now() - t0
    };
}
