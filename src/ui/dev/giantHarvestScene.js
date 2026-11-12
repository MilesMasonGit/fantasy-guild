// the eye-check scene for Giant Harvest: a vein, its miner and a Hall star at 50 %
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look, then deleted.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { HALL_NODE } from '../../config/guildUpgrades.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload):
 * - QA Giant Vein: Copper Ore, 1 to 2 a cycle, 2 s a cycle, never used up;
 * - QA Giant Seams: a Hall star, rank 1 held, Giant Harvest 50 % on Mining, so about every other
 *   cycle comes in at ten times with the celebration over the vein (and the star shows in the sky).
 */
const VEIN = 'qa_giant_vein';
const STAR = 'qa_giant_star';
const ORE = 'item_copper_ore';
const CHANCE = 50;

/**
 * Lays the scene out on the current mat: the QA Giant Vein near the mat's left middle, a QA Giant
 * Miner (Mining 10) working it, and the QA Giant Seams star held. A Giant Harvest, with its burst and
 * "Giant!" over the vein, shows within a few cycles. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, instanceId?: string, heroId?: string}}
 */
export function setUpGiantHarvestScene() {
    if (!getItem(ORE)) return { ok: false, error: 'No Copper Ore in the content' };
    registerTokenTypes({
        [VEIN]: {
            id: VEIN, name: 'QA Giant Vein', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_ore_vein_copper', tags: ['Ore'], requiresHero: true, staysPut: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 2 }] }
        }
    });

    const authored = authoredHallSky();
    registerHallSky({
        constellations: { ...authored.constellations, qa_giant: { id: 'qa_giant', name: 'QA Giant', label: { x: -1.3, y: 0.6 } } },
        stars: {
            ...authored.stars,
            [STAR]: {
                id: STAR, constellation: 'qa_giant', name: 'QA Giant Seams',
                description: 'Mining sometimes comes in at ten times.',
                node: { x: -1.25, y: 0.35 }, links: [HALL_NODE], tag: 'left',
                ranks: [{
                    tier: 1, price: [], lines: [],
                    rules: [{
                        id: `stm_${STAR}`, keyword: 'provides', chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                        to: { mode: 'all', value: '' },
                        payload: { type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value: CHANCE, category: 'mining' }
                    }]
                }]
            }
        }
    });

    const at = MatPlacement.findSpot(VEIN, { x: 520, y: 520 }, { reach: 480 });
    const vein = at ? BoardState.createTokenInstance(VEIN, tokenStartingUses(VEIN)) : null;
    if (!vein || !Placement.placeTokenAt(vein, at)?.success) return { ok: false, error: 'No room on the mat for the QA Giant Vein' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks[STAR] = 1;
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    TileModifiers.rebuildAll();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});

    const miner = generateHero({ name: 'QA Giant Miner' });
    miner.skills = { ...(miner.skills || {}), mining: { ...(miner.skills?.mining || {}), level: 10, xp: xpForLevel(10) } };
    if (!HeroManager.addHero(miner)) return { ok: false, error: 'The roster would not take another hero' };
    const order = Orders.orderAt(miner.id, { x: vein.x, y: vein.y });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_giant_harvest_scene' });
    if (!order?.success) return { ok: false, error: order?.reason || 'The miner would not take the vein' };
    return { ok: true, instanceId: vein.id, heroId: miner.id };
}
