// the eye-check scene for three of Faith's blessings: Fortune, Valiant and Wisdom
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look (T-705), then
// deleted with its test once that eye-check is accepted.

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
import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload):
 * - QA Blessed Shrine: lit at its most (30 minutes) from the start, so nobody tends it; on every
 *   Token in its reach, Fortune 25 % (a sure rare find every fourth cycle), Valiant 100 % and
 *   Wisdom 50 %;
 * - two QA Fortune Veins either side of it: Copper Ore every 3 s cycle, and a rare table (1 %) of
 *   Coal and, rarer, Quartz: every fourth cycle each gives a Quartz for certain and says "Fortune!";
 * - QA Brute below it: an enemy far too strong for a beginner.
 * Two QA Blessed Miners (Mining 10) work the veins: each also gets half of the other's Mining XP
 * (Wisdom). A QA Valiant Recruit (Melee 1) is sent at the Brute: brought down, they flee, keeping
 * their food and gear, the fight log and a banner saying Fled, and go home to heal; while they
 * fought, the miners' XP was shared with them too.
 * ⚠️ Changes the game, like Spawn Party.
 */
const SHRINE = 'qa_blessed_shrine';
const VEIN = 'qa_fortune_vein';
const BRUTE = 'qa_valiant_brute';
const ORE = 'item_copper_ore';
const COMMON_FIND = 'item_coal';
export const QA_RAREST_FIND = 'item_quartz';
const LIT_MS = 30 * 60_000;

function register() {
    const rule = (id, type, value) => ({
        id, keyword: 'provides', chargeDelta: 0, reach: 'nearby', target: null, when: null, upkeep: null,
        to: { mode: 'all', value: '' }, payload: { type, bucket: 'flat', value }
    });
    registerTokenTypes({
        [SHRINE]: {
            id: SHRINE, name: 'QA Blessed Shrine', tokenType: 'station', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_shrine_forest', requiresHero: true, shrine: { maxLitMs: LIT_MS },
            config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 1000, xp: 0, inputs: [], outputs: [] },
            statements: [
                { id: `stm_${SHRINE}_works`, keyword: 'station', payload: { skill: 'faith', stationKind: 'shrine' } },
                rule(`stm_${SHRINE}_fortune`, EFFECT_TYPES.FORTUNE, 25),
                rule(`stm_${SHRINE}_valiant`, EFFECT_TYPES.VALIANT, 100),
                rule(`stm_${SHRINE}_wisdom`, EFFECT_TYPES.WISDOM, 50)
            ]
        },
        [VEIN]: {
            id: VEIN, name: 'QA Fortune Vein', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_ore_vein_copper', tags: ['Ore'], requiresHero: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 4, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
            rareTable: { chance: 1, entries: [{ itemId: COMMON_FIND, weight: 9, minQty: 1, maxQty: 1 }, { itemId: QA_RAREST_FIND, weight: 1, minQty: 1, maxQty: 1 }] }
        },
        [BRUTE]: {
            id: BRUTE, name: 'QA Brute', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 1,
            sprite: 'e_goblin', requiresHero: true, enemy: { level: 60, style: 'melee' },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
        }
    });
}

/** A new QA hero with `skills` (skill → level), the roster cap raised for them, at full health. */
function qaHero(name, skills) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    for (const [skill, level] of Object.entries(skills)) {
        hero.skills = { ...(hero.skills || {}), [skill]: { ...(hero.skills?.[skill] || {}), level, xp: xpForLevel(level) } };
    }
    if (!HeroManager.addHero(hero)) return null;
    HeroManager.updateHeroFromSkills(hero);
    if (hero.hp) hero.hp.current = hero.hp.max;
    return hero;
}

function placeNear(typeId, aim) {
    const at = MatPlacement.findSpot(typeId, aim, { reach: 480 });
    const instance = at ? BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

/**
 * Lays the scene out on the current mat, right of its middle: the lit QA Blessed Shrine, its two
 * veins and the Brute in its reach, and the three QA heroes ordered on.
 * @returns {{ok: boolean, error?: string, shrineId?: string, veinIds?: string[], bruteId?: string, minerIds?: string[], recruitId?: string}}
 */
export function setUpBlessingsScene() {
    if (!getItem(ORE) || !getItem(COMMON_FIND) || !getItem(QA_RAREST_FIND)) return { ok: false, error: 'No Copper Ore, Coal or Quartz in the content' };
    register();
    const shrine = placeNear(SHRINE, { x: 1100, y: 420 });
    if (!shrine) return { ok: false, error: 'No room on the mat for the QA Blessed Shrine' };
    shrine.shrine = { litMs: LIT_MS };
    const west = placeNear(VEIN, { x: shrine.x - 160, y: shrine.y });
    const east = placeNear(VEIN, { x: shrine.x + 160, y: shrine.y });
    const brute = placeNear(BRUTE, { x: shrine.x, y: shrine.y + 160 });
    if (!west || !east || !brute) return { ok: false, error: 'No room beside the QA Blessed Shrine' };
    TileModifiers.rebuildAll();

    const miners = [qaHero('QA Blessed Miner', { mining: 10 }), qaHero('QA Blessed Miner Two', { mining: 10 })];
    const recruit = qaHero('QA Valiant Recruit', { melee: 1 });
    if (!miners[0] || !miners[1] || !recruit) return { ok: false, error: 'The roster would not take the QA heroes' };
    const orders = [
        Orders.orderAt(miners[0].id, { x: west.x, y: west.y }),
        Orders.orderAt(miners[1].id, { x: east.x, y: east.y }),
        Orders.orderAt(recruit.id, { x: brute.x, y: brute.y })
    ];
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_blessings_scene' });
    const refused = orders.find(o => !o?.success);
    if (refused) return { ok: false, error: refused.reason || 'A QA hero would not take their order' };
    return {
        ok: true, shrineId: shrine.id, veinIds: [west.id, east.id], bruteId: brute.id,
        minerIds: miners.map(m => m.id), recruitId: recruit.id
    };
}
