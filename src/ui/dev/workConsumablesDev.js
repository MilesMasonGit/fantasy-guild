// the QA panel's work consumables check (brief 230 S6b): a forester with a Birdwatcher and a Coffee, and a miner who keeps theirs
// ⚠️ DEV BUILDS ONLY: reached from `WorkConsumablesDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as SpriteLayer from '../../systems/board/SpriteLayer.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { getItem, registerItems } from '../../config/registries/itemRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { DRINK_CYCLES, MAX_SPEED_UP_CUT } from '../../config/loopConstants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test Tokens, effects and items made in memory for this check only (never written to `data/`,
 * gone on reload), authored as the content pack (S8) will author them. Stand-in art.
 * - a QA Birdwatcher (a work potion, a Consumable): "On Forestry Work Start: applies Birdwatcher to
 *   the hero for the cycle"; Birdwatcher: "Grants 1 QA Bird Nest, 25% of the time";
 * - a QA Coffee (a drink): "On Work Start: applies Coffee to the hero for the cycle"; Coffee: work
 *   50 % faster;
 * - a QA Oak (Forestry, 8 s) and a QA Copper Vein (Mining, 8 s), never running out.
 */
export const QA_WORK = Object.freeze({
    TREE: 'qa_s6b_oak',
    VEIN: 'qa_s6b_vein',
    BIRDWATCHER: 'qa_s6b_birdwatcher',
    COFFEE: 'qa_s6b_coffee',
    NEST: 'qa_s6b_bird_nest'
});
const BASE_MS = 8000;

const forTheCycle = (id, effectId, skill = null) => ({
    ...makeStatement(KEYWORD.APPLIES),
    id,
    when: { event: 'WORK_START', scope: 'self', ...(skill ? { skill } : {}) },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 },
    chargeDelta: 0
});

let registered = false;
function registerQa() {
    if (registered) return;
    registerEffects({
        qa_s6b_fx_birdwatcher: {
            id: 'qa_s6b_fx_birdwatcher', name: 'Birdwatcher',
            statements: [{ ...makeStatement(KEYWORD.GRANTS), id: 'stm_qa_s6b_nest', to: null,
                payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: QA_WORK.NEST, quantity: 1, chance: 25 } }]
        },
        qa_s6b_fx_birdwatcher_potion: {
            id: 'qa_s6b_fx_birdwatcher_potion', name: 'Birdwatcher Potion',
            statements: [forTheCycle('stm_qa_s6b_birdwatcher', 'qa_s6b_fx_birdwatcher', 'forestry')]
        },
        qa_s6b_fx_coffee: {
            id: 'qa_s6b_fx_coffee', name: 'Coffee',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_qa_s6b_coffee', to: null,
                payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.5 } }]
        },
        qa_s6b_fx_coffee_drink: {
            id: 'qa_s6b_fx_coffee_drink', name: 'Coffee Drink',
            statements: [forTheCycle('stm_qa_s6b_coffee_drink', 'qa_s6b_fx_coffee')]
        }
    });
    registerItems({
        [QA_WORK.NEST]: { id: QA_WORK.NEST, name: 'QA Bird Nest', type: 'material', stackable: true, equipSlot: '', sprite: 'i_nest_bird', value: 1 },
        [QA_WORK.BIRDWATCHER]: {
            id: QA_WORK.BIRDWATCHER, name: 'QA Birdwatcher', type: 'potion', stackable: true, equipSlot: 'consumable',
            sprite: 'i_potion_donut_green', value: 1, effects: [{ effectId: 'qa_s6b_fx_birdwatcher_potion' }]
        },
        [QA_WORK.COFFEE]: {
            id: QA_WORK.COFFEE, name: 'QA Coffee', type: 'drink', stackable: true, equipSlot: 'drink',
            sprite: 'i_potion_donut_orange', value: 1, effects: [{ effectId: 'qa_s6b_fx_coffee_drink' }]
        }
    });
    const node = (id, name, sprite, skill, output) => ({
        id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: true,
        config: { skill, skillRequired: 1, cycleTimeMs: BASE_MS, xp: 1, inputs: [], outputs: [{ itemId: output, quantity: 1, chance: 100 }] }
    });
    registerTokenTypes({
        [QA_WORK.TREE]: node(QA_WORK.TREE, 'QA Oak', 't_tree_oak', 'forestry', getItem('item_oak_wood') ? 'item_oak_wood' : QA_WORK.NEST),
        [QA_WORK.VEIN]: node(QA_WORK.VEIN, 'QA Copper Vein', 't_ore_vein_copper', 'mining', getItem('item_copper_ore') ? 'item_copper_ore' : QA_WORK.NEST)
    });
    registered = true;
}

/** Ids of what the scene laid, and what the readout counts. */
let scene = null;
let offs = [];

function put(typeId, point) {
    const spot = MatPlacement.findSpot(typeId, point, { reach: 320 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, { x: spot.x, y: spot.y })?.success ? inst : null;
}

/** A new hero at level 10 in `skill`, with room made in the roster, carrying `items` from the Bank. */
function qaWorker(name, skill, items) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = { [skill]: { ...(hero.skills?.[skill] || {}), level: 10, xp: xpForLevel(10) } };
    if (!HeroManager.addHero(hero)) return null;
    for (const itemId of items) EquipmentManager.equipItem(hero.id, itemId);
    return hero;
}

/**
 * Above the Guild Hall, two Tokens apart from each other, each with its worker:
 * - left, the QA Oak: QA Forester, carrying a QA Birdwatcher and a QA Coffee. Each Forestry cycle
 *   starts with a Birdwatcher drunk (a "used" bubble, the Bank down one) and, a quarter of the time,
 *   ends with a QA Bird Nest beside the Oak; the first cycle also drinks a Coffee (a bubble), which
 *   runs the cycles at half time (8 s becomes 4 s) for 10 cycles, then the next Coffee is drunk;
 * - right, the QA Copper Vein: QA Miner, carrying a QA Birdwatcher too: mining is not Forestry, so
 *   the Birdwatcher is kept (no bubble, the miner's count never moves).
 * The Bank gets 20 Birdwatchers and 3 Coffees.
 * ⚠️ Changes the game, like Spawn Party: it adds two heroes and puts potions and drinks in the Bank.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpWorkConsumablesScene() {
    registerQa();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };

    const tree = put(QA_WORK.TREE, { x: c.x - 360, y: c.y - 300 });
    const vein = put(QA_WORK.VEIN, { x: c.x + 360, y: c.y - 300 });
    if (!tree || !vein) return { ok: false, error: 'No room above the Guild Hall for the scene' };
    TileModifiers.rebuildAll();

    InventoryManager.addItem(QA_WORK.BIRDWATCHER, 20);
    InventoryManager.addItem(QA_WORK.COFFEE, 3);
    const forester = qaWorker('QA Forester', 'forestry', [QA_WORK.BIRDWATCHER, QA_WORK.COFFEE]);
    const miner = qaWorker('QA Miner', 'mining', [QA_WORK.BIRDWATCHER]);
    if (!forester || !miner) return { ok: false, error: 'The roster would not take two more heroes' };
    Placement.plantFlagAt(forester.id, { x: tree.x, y: tree.y });
    Placement.plantFlagAt(miner.id, { x: vein.x, y: vein.y });

    scene = { tree: tree.id, vein: vein.id, forester: forester.id, miner: miner.id, drunk: { [forester.id]: {}, [miner.id]: {} }, nests: 0, cycles: 0 };
    offs.forEach(off => off());
    offs = [
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => {
            const drunk = scene?.drunk?.[p?.heroId];
            if (drunk && p.dose) drunk[p.itemId] = (drunk[p.itemId] || 0) + 1;
        }, UI_LISTENER),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (p?.instanceId !== scene?.tree) return;
            scene.cycles += 1;
            if ((p.produced || []).includes(QA_WORK.NEST)) scene.nests += 1;
        }, UI_LISTENER)
    ];
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_work_consumables_scene' });
    return { ok: true };
}

const secs = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/**
 * What the scene shows, read from the engine, refreshed while the panel is open.
 * @returns {string[]}
 */
export function workConsumablesReadout() {
    if (!scene) return [];
    const forester = HeroManager.getHero(scene.forester);
    const miner = HeroManager.getHero(scene.miner);
    if (!forester || !miner) return [];
    const rules = TileModifiers.resolveAxis(scene.tree, EFFECT_TYPES.WORK_TIME, BASE_MS, 'forestry');
    const cycle = Math.max(1000, TileModifiers.floorSpeedUp(BASE_MS, rules));
    const left = forester.drinkCycles?.[QA_WORK.COFFEE] ?? 0;
    const carried = (forester.effects || []).map(e => (e.effectId === 'qa_s6b_fx_coffee' ? 'Coffee' : e.effectId === 'qa_s6b_fx_birdwatcher' ? 'Birdwatcher' : e.effectId));
    return [
        `Bank: ${InventoryManager.getItemCount(QA_WORK.BIRDWATCHER)} QA Birdwatchers, ${InventoryManager.getItemCount(QA_WORK.COFFEE)} QA Coffees`,
        `QA Forester: ${scene.cycles} Oak cycles, ${scene.drunk[scene.forester][QA_WORK.BIRDWATCHER] || 0} Birdwatchers and ${scene.drunk[scene.forester][QA_WORK.COFFEE] || 0} Coffees drunk; Coffee ${left} of ${DRINK_CYCLES} cycles left`,
        `  a cycle every ${secs(cycle)}${cycle < BASE_MS ? ` (${secs(BASE_MS)} without Coffee; never under ${secs(BASE_MS - BASE_MS * MAX_SPEED_UP_CUT)})` : ''}; carrying now: ${carried.length ? carried.join(', ') : 'nothing'}`,
        `  QA Bird Nests: ${scene.nests} dropped (${SpriteLayer.countOnBoard(QA_WORK.NEST)} on the mat, ${InventoryManager.getItemCount(QA_WORK.NEST)} banked)`,
        `QA Miner: ${scene.drunk[scene.miner][QA_WORK.BIRDWATCHER] || 0} Birdwatchers drunk (mining is not Forestry: kept)`
    ];
}
