// The world map's world: generated once at a new game, kept in the save

import { GameState } from '../../state/GameState.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { SKILLS } from '../../config/registries/skillRegistry.js';
import { worldTables, isPlaceholderTables } from '../../config/registries/worldTablesRegistry.js';
import { lineById } from '../../config/worldTablesShape.js';
import { seedFromText } from '../atlas/seededRandom.js';
import * as StarterCamp from '../atlas/StarterCamp.js';
import { generateWorld } from './generate.js';
import { worldFindings } from './checks.js';
import { worldText } from './describe.js';
import { materialsFromTokens, hallOriginsOf } from './materials.js';
import { logger } from '../../utils/Logger.js';

/**
 * Each run has one world (brief 330): a hex grid of cells around the Guild Hall, generated from the
 * run seed and the world tables when the game starts (`EngineBootstrap.createDefaultGameData`), and
 * kept whole in the save as `state.world`, so a later change to the tables never reshapes a world
 * already being played. Nothing reads it per tick.
 *
 * A save made before the world existed has `state.world` null: old saves are abandoned (owner,
 * 2026-10-30), so nothing is generated for them.
 *
 * Not on the game screen yet: the world map screen is brief 330 W2. The QA panel's Atlas section
 * shows it in words.
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

/** This game's world (the live record: do not hand it to the screen), or null. */
export function currentWorld() {
    const world = GameState.state?.world;
    return world && Array.isArray(world.cells) ? world : null;
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
        skillName: (id) => SKILLS[id]?.name || id,
        placeholder: isPlaceholderTables(),
        findings: findingsOf(world)
    });
}
