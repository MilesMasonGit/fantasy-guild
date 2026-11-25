// the eye-check scene for Faith's shrines: a QA shrine tended with offerings, lit, then fading
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look (brief 810 K3),
// then deleted with its test once that eye-check is accepted.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as StationRecipe from '../../systems/board/StationRecipe.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../../config/registries/recipePoolRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload):
 * - QA Shrine: a Faith shrine lit at most 90 s, blessing the Tokens in its reach with Can't Run Out
 *   100 % and Echo 50 %; it burns QA Wood Offerings (1 Oak Wood each, 1 s to offer, 20 s lit apiece), so it
 *   is lit before the vein's first cycle ends;
 * - QA Shrine Vein: Copper Ore, 3 s a cycle, 3 charges, so unblessed it is gone in three cycles.
 * A QA Priest (Faith 10) tends the shrine and a QA Shrine Miner (Mining 10) works the vein, with
 * 6 Oak Wood in the Bank: the shrine lights, the vein keeps its 3 charges and now and then says
 * "Echo!" with a second ore; the wood is gone in about a minute, then the shrine burns down over
 * about 70 s, goes out, and the vein runs out three cycles later.
 */
const SHRINE = 'qa_faith_shrine';
const VEIN = 'qa_faith_vein';
const OFFERING = 'qa_faith_offering';
const WOOD = 'item_oak_wood';
const ORE = 'item_copper_ore';
export const QA_FAITH_WOOD = 6;

function register() {
    registerRecipePools({
        faith: [{
            id: OFFERING, name: 'QA Wood Offering', skill: 'faith', levelRequirement: 1, durationMs: 1000, xp: 2,
            stationKinds: ['shrine'], inputs: [{ itemId: WOOD, quantity: 1 }], outputs: [], offering: { litMs: 20_000 }
        }]
    }, { takeOver: false });
    const rule = (id, payload) => ({
        id, keyword: 'provides', chargeDelta: 0, reach: 'nearby', target: null, when: null, upkeep: null,
        to: { mode: 'all', value: '' }, payload
    });
    registerTokenTypes({
        [SHRINE]: {
            id: SHRINE, name: 'QA Shrine', tokenType: 'station', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_shrine_forest', requiresHero: true, shrine: { maxLitMs: 90_000 },
            config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 1000, xp: 0, inputs: [], outputs: [] },
            statements: [
                { id: `stm_${SHRINE}_works`, keyword: 'station', payload: { skill: 'faith', stationKind: 'shrine' } },
                rule(`stm_${SHRINE}_unending`, { type: EFFECT_TYPES.NEVER_RUNS_OUT, bucket: 'flat', value: 100 }),
                rule(`stm_${SHRINE}_echo`, { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 50 })
            ]
        },
        [VEIN]: {
            id: VEIN, name: 'QA Shrine Vein', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: 3,
            sprite: 't_ore_vein_copper', tags: ['Ore'], requiresHero: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
        }
    });
}

/** A new QA hero at `level` in `skill`, the roster cap raised for them. */
function qaHero(name, skill, level) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = { ...(hero.skills || {}), [skill]: { ...(hero.skills?.[skill] || {}), level, xp: xpForLevel(level) } };
    return HeroManager.addHero(hero) ? hero : null;
}

function placeNear(typeId, aim) {
    const at = MatPlacement.findSpot(typeId, aim, { reach: 480 });
    const instance = at ? BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

/**
 * Lays the scene out on the current mat, left of its middle: the QA Shrine set to its offering, the
 * QA Shrine Vein beside it, their two heroes ordered on, and {@link QA_FAITH_WOOD} Oak Wood in the
 * Bank. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, shrineId?: string, veinId?: string}}
 */
export function setUpFaithScene() {
    if (!getItem(WOOD) || !getItem(ORE)) return { ok: false, error: 'No Oak Wood or Copper Ore in the content' };
    register();
    const shrine = placeNear(SHRINE, { x: 560, y: 520 });
    if (!shrine) return { ok: false, error: 'No room on the mat for the QA Shrine' };
    const vein = placeNear(VEIN, { x: shrine.x + 160, y: shrine.y });
    if (!vein) return { ok: false, error: 'No room beside the QA Shrine for its vein' };
    StationRecipe.setSelectedRecipe(shrine, OFFERING);
    InventoryManager.addItem(WOOD, QA_FAITH_WOOD);
    TileModifiers.rebuildAll();

    const priest = qaHero('QA Priest', 'faith', 10);
    const miner = qaHero('QA Shrine Miner', 'mining', 10);
    if (!priest || !miner) return { ok: false, error: 'The roster would not take the QA heroes' };
    const tends = Orders.orderAt(priest.id, { x: shrine.x, y: shrine.y });
    const mines = Orders.orderAt(miner.id, { x: vein.x, y: vein.y });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_faith_scene' });
    if (!tends?.success || !mines?.success) return { ok: false, error: tends?.reason || mines?.reason || 'A QA hero would not take their order' };
    return { ok: true, shrineId: shrine.id, veinId: vein.id };
}
