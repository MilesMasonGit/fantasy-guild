// the QA panel's Effect badges check: three groups of test Tokens whose cards show every kind of badge
// ⚠️ DEV BUILDS ONLY: reached from `BadgesDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../../config/guildUpgrades.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../../systems/effects/statements.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';
import { fighterAt } from './combatScreenDev.js';

/**
 * Test Tokens, an item and a star made in memory for this check only (never written to `data/`,
 * gone on reload), so each of brief 600's card checks is one click away:
 * - **QA Badge Furnace** (Copper Ore to Copper Ingot, a rare table of Quartz and Gold Ore at 2 %) beside
 *   the **QA Badge Forge** (Speed +15 %, Double Item on the ingot 8 %, Efficiency 12 % on the ore,
 *   Lucky +25 %, Preservation 6 %, Refresh 4 %), the **QA Badge Training** star (Speed +3 %, XP
 *   +10 % on QA Badge Tokens) and a smith wearing the **QA Quick Cap** (Speed +5 %) working it;
 * - **QA Badge Mine** beside the **QA Badge Rush** (Speed +90 %): its Speed held at the limit;
 * - **QA Badge Goblin** beside the **QA Loot Banner** (Double Loot 5 %, Double Item on Bones 12 %),
 *   a fighter on it.
 */
export const QA_BADGES = Object.freeze({
    FURNACE: 'qa_badge_furnace',
    FORGE: 'qa_badge_forge',
    MINE: 'qa_badge_mine',
    RUSH: 'qa_badge_rush',
    GOBLIN: 'qa_badge_goblin',
    BANNER: 'qa_badge_banner',
    STAR: 'qa_badge_star',
    CAP: 'qa_badge_cap',
    CAP_EFFECT: 'qa_badge_quick_cap'
});
const T = QA_BADGES;
const TAG = 'QA Badge';
const ORE = 'item_copper_ore';
const INGOT = 'item_copper_ingot';
const BONES = 'item_bones';
const FINDS = Object.freeze([{ itemId: 'item_quartz', weight: 3 }, { itemId: 'item_gold_ore', weight: 1 }]);
const ORE_STOCK = 3000;

const near = (id, to, payload) => ({ id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'id', value: to }, reach: 'nearby', payload });
const building = (id, name, sprite, statements) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: false, statements
});

function registerQaContent() {
    registerEffects({
        [T.CAP_EFFECT]: {
            id: T.CAP_EFFECT, name: 'Quick Hands',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 } }]
        }
    });
    registerItems({
        [T.CAP]: {
            id: T.CAP, name: 'QA Quick Cap', type: 'armor', equipSlot: 'hat', stackable: true, sprite: 'i_armor_plate_copper',
            tags: [], effects: [{ effectId: T.CAP_EFFECT, scale: 1 }]
        }
    });
    registerTokenTypes({
        [T.FURNACE]: {
            id: T.FURNACE, name: 'QA Badge Furnace', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: 500,
            sprite: 't_smelter', tags: [TAG], requiresHero: true, staysPut: true,
            config: {
                skill: 'smithing', skillRequired: 1, cycleTimeMs: 4000, xp: 5,
                inputs: [{ itemId: ORE, quantity: 10 }],
                outputs: [{ itemId: INGOT, chance: 100, minQty: 1, maxQty: 1 }]
            },
            rareTable: { chance: 2, entries: FINDS.map(f => ({ ...f, minQty: 1, maxQty: 1 })) }
        },
        [T.FORGE]: building(T.FORGE, 'QA Badge Forge', 't_forge', [
            near('qa_badge_forge_speed', T.FURNACE, { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.15 }),
            near('qa_badge_forge_double', T.FURNACE, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 8, category: INGOT }),
            near('qa_badge_forge_lean', T.FURNACE, { type: EFFECT_TYPES.INPUT_COST, bucket: 'percentage', value: -0.12 }),
            near('qa_badge_forge_luck', T.FURNACE, { type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: 0.25 }),
            near('qa_badge_forge_keep', T.FURNACE, { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: 6 }),
            near('qa_badge_forge_refresh', T.FURNACE, { type: EFFECT_TYPES.REFRESH, bucket: 'flat', value: 4 })
        ]),
        [T.MINE]: {
            id: T.MINE, name: 'QA Badge Mine', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_ore_vein_copper', tags: ['Ore', TAG], requiresHero: true, staysPut: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
        },
        [T.RUSH]: building(T.RUSH, 'QA Badge Rush', 't_mineshaft_copper', [
            near('qa_badge_rush', T.MINE, { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.9 })
        ]),
        [T.GOBLIN]: {
            id: T.GOBLIN, name: 'QA Badge Goblin', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 200,
            sprite: getTokenType('token_goblin')?.sprite || 's_occult', requiresHero: true, tags: [TAG],
            enemy: { level: 1, style: 'melee', hp: 6, hit: 1, speed: 'slow' },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: BONES, chance: 100, minQty: 1, maxQty: 1 }] }
        },
        [T.BANNER]: building(T.BANNER, 'QA Loot Banner', 't_mineshaft_copper', [
            near('qa_badge_banner_loot', T.GOBLIN, { type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 5 }),
            near('qa_badge_banner_bones', T.GOBLIN, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 12, category: BONES })
        ])
    });
}

/** The authored sky with one more star by the Hall, its rank 1 held: Speed and XP on QA Badge Tokens. */
function installQaStar() {
    const authored = authoredHallSky();
    const rule = (id, payload) => ({
        id, keyword: 'provides', chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
        to: { mode: 'tag', value: TAG }, payload
    });
    const star = {
        id: T.STAR, constellation: 'qa_badge', name: 'QA Badge Training',
        description: 'QA Badge Tokens work faster and teach more.',
        node: { x: 0.4, y: -1.35 }, links: [HALL_NODE], tag: 'top',
        ranks: [{
            tier: 1, price: [], lines: [],
            rules: [
                rule('stm_qa_badge_star_speed', { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.03 }),
                rule('stm_qa_badge_star_xp', { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 0.1 })
            ]
        }]
    };
    registerHallSky({
        constellations: { ...authored.constellations, qa_badge: { id: 'qa_badge', name: 'QA Badges', label: { x: 0.5, y: -1.6 } } },
        stars: { ...authored.stars, [T.STAR]: star }
    });
    GuildUpgradeManager.getRanks()[T.STAR] = 1;
}

function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 200 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** Where the scene stands: three pairs on the mat's middle row, each well out of the others' reach. */
export const BADGE_SPOTS = Object.freeze({
    furnace: { x: 240, y: 700 },
    forge: { x: 390, y: 700 },
    mine: { x: 760, y: 700 },
    rush: { x: 910, y: 700 },
    goblin: { x: 1280, y: 700 },
    banner: { x: 1430, y: 700 }
});

/**
 * A new hero, or with the roster full, one already in it the scene has not used (their skill is
 * raised to 10 and their order moved): the scene works on any save.
 */
function heroFor(fresh, skill, used) {
    if (HeroManager.addHero(fresh)) return fresh;
    const spare = (HeroManager.getAllHeroes() || []).filter(h => h && !h.isVillager && !used.has(h.id)).at(-1);
    if (!spare) return null;
    const at = Math.max(10, spare.skills?.[skill]?.level || 0);
    spare.skills = { ...(spare.skills || {}), [skill]: { ...(spare.skills?.[skill] || {}), level: at, xp: xpForLevel(at) } };
    return spare;
}

/**
 * Lays out the three groups and sends a smith with the QA Quick Cap to the Furnace and a fighter to
 * the Goblin (new heroes, or with the roster full, two already in it); the Bank gets Copper Ore for
 * the Furnace. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpBadgeScene() {
    if ([ORE, INGOT, BONES, ...FINDS.map(f => f.itemId)].some(id => !getItem(id))) {
        return { ok: false, error: 'No Copper Ore, Copper Ingot, Bones, Quartz or Gold Ore in the content' };
    }
    registerQaContent();
    installQaStar();
    const s = BADGE_SPOTS;
    const placed = {};
    for (const [key, typeId] of [['furnace', T.FURNACE], ['forge', T.FORGE], ['mine', T.MINE], ['rush', T.RUSH], ['goblin', T.GOBLIN], ['banner', T.BANNER]]) {
        placed[key] = put(typeId, s[key]);
        if (!placed[key]) return { ok: false, error: 'No room on the mat’s middle row for the scene' };
    }
    TileModifiers.rebuildAll();

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 2);
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});

    InventoryManager.addItem(ORE, ORE_STOCK);
    const used = new Set();
    const smith = heroFor(generateHero({ name: 'QA Badge Smith' }), 'smithing', used);
    if (!smith) return { ok: false, error: 'No hero to work the Furnace' };
    used.add(smith.id);
    InventoryManager.addItem(T.CAP, 1);
    EquipmentManager.equipItem(smith.id, T.CAP);
    qaOrder(smith.id, { x: placed.furnace.x, y: placed.furnace.y });

    const fighter = heroFor(fighterAt(40, 'QA Badge Fighter'), 'melee', used);
    if (!fighter) return { ok: false, error: 'No hero to fight the Goblin' };
    qaOrder(fighter.id, { x: placed.goblin.x, y: placed.goblin.y });

    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_badge_scene' });
    return { ok: true };
}
