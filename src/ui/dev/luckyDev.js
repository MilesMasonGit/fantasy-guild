// the QA panel's Lucky check: rare drop tables on two veins and an enemy, raised by a Lucky building and a Lucky Hall star
// ⚠️ QA BUILDS ONLY: reached from `LuckyDevSection`, which TestDashboard renders behind `QA_TOOLS`.

import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as RareTables from '../../systems/board/RareTables.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, tokenName, getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { rareTableChance } from '../../config/registries/rareTables.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../../config/guildUpgrades.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';
import { fighterAt } from './combatScreenDev.js';

/**
 * Test Tokens and a test star made in memory for this check only (never written to `data/`, gone on
 * reload). The finds are the content's Quartz (weight 3) and Gold Ore (weight 1):
 * - QA Lucky Vein (near): Copper Ore, 2 s a cycle, and a rare table at 5 %;
 * - QA Lucky Charm: a building giving Lucky +900 % to the near vein in reach, so its table rolls at
 *   50 %;
 * - QA Lucky Vein (star): the same vein with a 10 % table, out of the Charm's reach, tagged QA Lucky;
 * - QA Lucky Goblin: an enemy dropping Bones, with a 25 % rare table, tagged QA Lucky;
 * - QA Lucky Finds: a Hall star, rank 1 held, Lucky +100 % aimed at QA Lucky Tokens, so the star
 *   vein's table rolls at 20 % and the Goblin's at 50 %.
 */
export const QA_LUCKY = Object.freeze({
    NEAR_VEIN: 'qa_lucky_vein_near',
    STAR_VEIN: 'qa_lucky_vein_star',
    CHARM: 'qa_lucky_charm',
    GOBLIN: 'qa_lucky_goblin',
    STAR: 'qa_lucky_star'
});
const T = QA_LUCKY;
const TAG = 'QA Lucky';
const ORE = 'item_copper_ore';
const BONES = 'item_bones';
const FINDS = Object.freeze([{ itemId: 'item_quartz', weight: 3 }, { itemId: 'item_gold_ore', weight: 1 }]);
const table = (chance) => ({ chance, entries: FINDS.map(f => ({ ...f, minQty: 1, maxQty: 1 })) });
const CHARM_LUCKY = 9;
const STAR_LUCKY = 1;

const vein = (id, name, chance, tags = []) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null, sprite: 't_ore_vein_copper', tags: ['Ore', ...tags],
    requiresHero: true, staysPut: true,
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
    rareTable: table(chance)
});

function registerQaTypes() {
    registerTokenTypes({
        [T.NEAR_VEIN]: vein(T.NEAR_VEIN, 'QA Lucky Vein (near)', 5),
        [T.STAR_VEIN]: vein(T.STAR_VEIN, 'QA Lucky Vein (star)', 10, [TAG]),
        [T.CHARM]: {
            id: T.CHARM, name: 'QA Lucky Charm', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_mineshaft_copper', requiresHero: false,
            statements: [{
                id: `stm_${T.CHARM}`, keyword: 'provides', to: { mode: 'id', value: T.NEAR_VEIN }, reach: 'nearby',
                payload: { type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: CHARM_LUCKY }
            }]
        },
        [T.GOBLIN]: {
            id: T.GOBLIN, name: 'QA Lucky Goblin', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 200, sprite: 's_occult',
            requiresHero: true, tags: [TAG],
            enemy: { level: 1, style: 'melee', hp: 6, hit: 1, speed: 'slow' },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: BONES, chance: 100, minQty: 1, maxQty: 1 }] },
            rareTable: table(25)
        }
    });
}

/** The authored sky with one more star by the Hall, its rank 1 held. */
function installQaStar() {
    const authored = authoredHallSky();
    const star = {
        id: T.STAR, constellation: 'qa_lucky', name: 'QA Lucky Finds',
        description: 'QA Lucky Tokens roll their rare drop tables more often.',
        node: { x: 0, y: -1.35 }, links: [HALL_NODE], tag: 'top',
        ranks: [{
            tier: 1, price: [], lines: [],
            rules: [{
                id: `stm_${T.STAR}`, keyword: 'provides', chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                to: { mode: 'tag', value: TAG },
                payload: { type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: STAR_LUCKY }
            }]
        }]
    };
    registerHallSky({
        constellations: { ...authored.constellations, qa_lucky: { id: 'qa_lucky', name: 'QA Lucky', label: { x: 0.1, y: -1.6 } } },
        stars: { ...authored.stars, [T.STAR]: star }
    });
    GuildUpgradeManager.getRanks()[T.STAR] = 1;
}

function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 200 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** Where the scene stands: the mat's lower row, the star's vein well out of the Charm's reach. */
export const LUCKY_SPOTS = Object.freeze({
    near: { x: 260, y: 900 },
    charm: { x: 410, y: 900 },
    star: { x: 800, y: 900 },
    goblin: { x: 1250, y: 900 }
});

let scene = null;
let unsubscribe = null;

const isFind = (itemId) => FINDS.some(f => f.itemId === itemId);

/**
 * The mat's lower row: a QA Lucky Vein beside a QA Lucky Charm (its 5 % table at 50 %), a second
 * vein the QA Lucky Finds star reaches (10 % at 20 %), and a QA Lucky Goblin the star reaches too
 * (25 % at 50 %), a miner on each vein and a fighter on the Goblin. Finds are Quartz and Gold Ore
 * and are marked for the rare twinkle as they land (the twinkle itself is switched off in
 * `lootEffects.js`). ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpLuckyScene() {
    if (!getItem(ORE) || !getItem(BONES) || FINDS.some(f => !getItem(f.itemId))) {
        return { ok: false, error: 'No Copper Ore, Bones, Quartz or Gold Ore in the content' };
    }
    registerQaTypes();
    installQaStar();
    const s = LUCKY_SPOTS;
    const near = put(T.NEAR_VEIN, s.near);
    const charm = put(T.CHARM, s.charm);
    const star = put(T.STAR_VEIN, s.star);
    const goblin = put(T.GOBLIN, s.goblin);
    if (!near || !charm || !star || !goblin) return { ok: false, error: 'No room on the mat’s lower row for the scene' };
    TileModifiers.rebuildAll();

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 3);
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});

    for (const [inst, name] of [[near, 'QA Lucky Miner'], [star, 'QA Star Miner']]) {
        const miner = generateHero({ name });
        miner.skills = { mining: { ...(miner.skills?.mining || {}), level: 10, xp: xpForLevel(10) } };
        if (!HeroManager.addHero(miner)) return { ok: false, error: 'The roster would not take another hero' };
        qaOrder(miner.id, { x: inst.x, y: inst.y });
    }
    const fighter = fighterAt(40, 'QA Lucky Fighter');
    if (!HeroManager.addHero(fighter)) return { ok: false, error: 'The roster would not take another hero' };
    qaOrder(fighter.id, { x: goblin.x, y: goblin.y });

    const ids = [near.id, star.id, goblin.id];
    scene = {
        near: near.id, star: star.id, goblin: goblin.id,
        cycles: Object.fromEntries(ids.map(id => [id, 0])),
        finds: Object.fromEntries(ids.map(id => [id, 0])),
        twinkles: 0
    };
    unsubscribe?.();
    const offCycle = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
        if (!scene || !(e.instanceId in scene.cycles) || e.instanceId === scene.goblin) return;
        scene.cycles[e.instanceId] += 1;
        if ((e.produced || []).some(isFind)) scene.finds[e.instanceId] += 1;
    }, UI_LISTENER);
    const offLoot = EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, (e) => {
        if (!scene || e.instanceId !== scene.goblin) return;
        scene.cycles[scene.goblin] += 1;
        if ((e.drops || []).some(d => d.rare)) scene.finds[scene.goblin] += 1;
    }, UI_LISTENER);
    const offTwinkle = EventBus.subscribe(BOARD_EVENTS.RARE_DROP, (e) => {
        if (scene && isFind(e.itemId)) scene.twinkles += 1;
    }, UI_LISTENER);
    unsubscribe = () => { offCycle?.(); offLoot?.(); offTwinkle?.(); };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_lucky_scene' });
    return { ok: true };
}

function tokenLine(id, from, unit) {
    const t = BoardState.getTokenById(id);
    if (!t) return null;
    const def = getTokenType(t.typeId);
    const chance = RareTables.rareChanceAt(id, def, def?.config?.skill || '');
    const round = (n) => Math.round(n * 100) / 100;
    return `${tokenName(t.typeId)}: rare table ${rareTableChance(def)} %, ${round(chance)} % with Lucky (${from}); ${scene.cycles[id]} ${unit}, ${scene.finds[id]} rare finds`;
}

/**
 * What the scene shows, read from the engine.
 * @returns {string[]}
 */
export function luckyReadout() {
    if (!scene) return [];
    const rank = GuildUpgradeManager.getRanks()[T.STAR] || 0;
    return [
        tokenLine(scene.near, 'the Charm beside it', 'cycles'),
        tokenLine(scene.star, `the QA Lucky Finds star, rank ${rank}`, 'cycles'),
        tokenLine(scene.goblin, `the QA Lucky Finds star, rank ${rank}`, 'kills'),
        `Rare finds marked for the twinkle: ${scene.twinkles} (the twinkle is switched off in lootEffects.js)`
    ].filter(Boolean);
}
