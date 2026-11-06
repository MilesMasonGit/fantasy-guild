// The world map's world: generated once at a new game, kept in the save

import { GameState } from '../../state/GameState.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { SKILLS } from '../../config/registries/skillRegistry.js';
import { worldTables, isPlaceholderTables } from '../../config/registries/worldTablesRegistry.js';
import { lineById } from '../../config/worldTablesShape.js';
import { seedFromText, nextSeed } from '../atlas/seededRandom.js';
import * as StarterCamp from '../atlas/StarterCamp.js';
import { generateWorld } from './generate.js';
import { worldFindings, WORLD_CHECK } from './checks.js';
import { worldText } from './describe.js';
import { materialsFromTokens, hallOriginsOf } from './materials.js';
import { logger } from '../../utils/Logger.js';
import { currentWorld } from './worldState.js';

export { currentWorld };
export {
    SETTLE_TEXT, settleCell, writePlace, arriveAt, settledCellIds, cellStatesNow, priceOf, ringLockOf, outputsOf, regionIdOfCell,
    activeCellId, cellName, placeName, guildSkillLevel
} from './Settling.js';

/**
 * Each run has one world (brief 330): a hex grid of cells around the Guild Hall, generated from the
 * run seed and the world tables when the game starts (`EngineBootstrap.createDefaultGameData`), and
 * kept whole in the save as `state.world`, so a later change to the tables never reshapes a world
 * already being played. Nothing reads it per tick.
 *
 * A save made before the world existed has `state.world` null: old saves are abandoned (owner,
 * 2026-10-30), so nothing is generated for them.
 *
 * The Atlas's World page draws it; settling a place is `Settling.js`'s.
 */

/** The run seed of a game: from when it was created, so two new games differ. */
export function runSeedOf(state = GameState.state) {
    return seedFromText(`world|${state?.meta?.createdAt ?? 0}`);
}

/** What the generator reads besides the tables: what each origin yields, and the Starter Camp's origins. */
export function lookups() {
    const materialsOf = materialsFromTokens(getTokenType);
    return { materialsOf, hallOrigins: hallOriginsOf(StarterCamp.starterCamp()?.tokens, materialsOf) };
}

/** A world for `seed` from the tables in force, without keeping it. */
export function previewWorld(seed) {
    return generateWorld({ seed, tables: worldTables(), ...lookups() });
}

/**
 * The world's own checks that are the ledger's checks F (`ledger/world.js`): a world rolled for a
 * new game must have none of them. The rest are holes in the tables, the same in every world.
 */
export const ROLL_CHECKS = Object.freeze([WORLD_CHECK.PRICE_RING, WORLD_CHECK.KEY_REACH, WORLD_CHECK.COVERAGE, WORLD_CHECK.VALUE]);

/** How many seeds a roll tries for a world with none of {@link ROLL_CHECKS}. */
export const ROLL_TRIES = 20;

/** A first seed for the new-game screen, from the moment it is asked for (the screen's clock: no game runs yet). */
export function freshWorldSeed(now) {
    return seedFromText(`world|${now}`);
}

/**
 * A world for the new-game screen: the world for `seed`, or, while it fails one of
 * {@link ROLL_CHECKS}, the next seed's (`nextSeed`), up to {@link ROLL_TRIES} seeds. Tables that no
 * seed satisfies give the world with the fewest such findings, `clean` false, rather than none.
 * Nothing is kept: the screen hands the chosen seed to the new game ({@link createWorld}).
 *
 * @returns {{seed: number, world: object, clean: boolean, tries: number}}
 */
export function rollWorld(seed) {
    let best = null;
    let s = seed >>> 0;
    for (let tries = 1; tries <= ROLL_TRIES; tries++) {
        const world = previewWorld(s);
        const failed = findingsOf(world).filter(f => ROLL_CHECKS.includes(f.check)).length;
        if (failed === 0) return { seed: world.seed, world, clean: true, tries };
        if (!best || failed < best.failed) best = { seed: world.seed, world, failed };
        s = nextSeed(s);
    }
    logger.warn('World', `No world in ${ROLL_TRIES} seeds passed the checks; keeping seed ${best.seed} (${best.failed} findings)`);
    return { seed: best.seed, world: best.world, clean: false, tries: ROLL_TRIES };
}

/**
 * Generate this game's world and keep it in the save. Called once, at a new game.
 *
 * @param {{seed?: number}} [options] the run seed; by default from when the game was created
 * @returns {object|null} the world, or null with no game
 */
export function createWorld({ seed } = {}) {
    const state = GameState.state;
    if (!state) return null;
    const started = performance.now();
    const world = generateWorld({ seed: Number.isFinite(seed) ? seed : runSeedOf(state), tables: worldTables(), ...lookups() });
    state.world = world;
    const ms = performance.now() - started;
    logger.debug('World', `World ${world.seed}: ${world.cells.length} cells in ${ms.toFixed(1)} ms, ${world.problems.length} problems`);
    return world;
}


/** The checks' findings on a world, against the tables in force. */
export function findingsOf(world) {
    return world ? worldFindings(world, worldTables(), lookups()) : [];
}

/** A world in words, named from the registries, with the checks' findings at the end. */
export function describeWorld(world) {
    if (!world) return '';
    const tables = worldTables();
    return worldText(world, {
        tokenName: (id) => tokenName(id) || id,
        itemName: (id) => getItem(id)?.name || id,
        lineName: (id) => lineById(tables, id)?.name || id,
        kitName: (id) => tables.kits.find(k => k.id === id)?.name || id,
        // A specialty need not be a skill ("combat": a camp); it reads capitalised all the same.
        skillName: (id) => SKILLS[id]?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : id),
        placeholder: isPlaceholderTables(),
        findings: findingsOf(world)
    });
}
