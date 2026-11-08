// the QA panel's tools-that-break check: a brittle woodaxe and a brittle sword, worked until they break
// ⚠️ DEV BUILDS ONLY: reached from `ToolsBreakDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Flags from '../../systems/board/Flags.js';
import * as CatchUp from '../../systems/core/CatchUp.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem, registerItems } from '../../config/registries/itemRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { breakChanceOf } from '../../config/registries/itemBreak.js';
import { heroMaxHpFromSkills } from '../../systems/combat/CombatFormulas.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';

/**
 * Test items and Tokens made in memory for this check only (never written to `data/`, gone on
 * reload), stand-in art from the content:
 * - a QA Brittle Woodaxe (a Woodaxe tool) and a QA Brittle Sword (a Melee weapon), each with a
 *   25 % chance to break, so a break comes within a minute or so;
 * - a QA Endless Oak (needs a Woodaxe, never runs out, a 2 s cycle) and a QA Training Slime (6 HP,
 *   hits for 1, never runs out: it rests and stands up again after each kill), so the Melee 30
 *   QA Duelist outlasts many kills.
 */
export const QA_BREAK = Object.freeze({
    AXE: 'qa_l1_brittle_axe',
    SWORD: 'qa_l1_brittle_sword',
    OAK: 'qa_l1_endless_oak',
    SLIME: 'qa_l1_training_slime'
});
export const QA_BREAK_CHANCE = 25;
const WOOD = 'item_oak_wood';
const AWAY_MS = 5 * 60_000;

let registered = false;
function registerQa() {
    if (registered) return;
    registerItems({
        [QA_BREAK.AXE]: {
            id: QA_BREAK.AXE, name: 'QA Brittle Woodaxe', type: 'tool', equipSlot: 'hand', stackable: true,
            sprite: getItem('item_copper_woodaxe')?.sprite || 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 },
            breakChance: QA_BREAK_CHANCE, description: 'Made for the QA panel: it breaks often.'
        },
        [QA_BREAK.SWORD]: {
            id: QA_BREAK.SWORD, name: 'QA Brittle Sword', type: 'weapon', equipSlot: 'hand', stackable: true,
            sprite: getItem('item_copper_sword')?.sprite || 'i_longsword_copper', styles: ['melee'], damage: 3,
            breakChance: QA_BREAK_CHANCE, description: 'Made for the QA panel: it breaks often.'
        }
    });
    registerTokenTypes({
        [QA_BREAK.OAK]: {
            id: QA_BREAK.OAK, name: 'QA Endless Oak', tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null,
            sprite: getTokenType('token_oak_tree')?.sprite || 't_tree_oak', requiresHero: true,
            needsTool: { kind: 'woodaxe', minTier: 1 },
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [],
                outputs: [{ itemId: WOOD, chance: 100, minQty: 1, maxQty: 1 }] }
        },
        [QA_BREAK.SLIME]: {
            id: QA_BREAK.SLIME, name: 'QA Training Slime', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: null,
            sprite: getTokenType('token_greater_slime')?.sprite || 'e_slime_green_greater', requiresHero: true,
            enemy: { style: 'melee', level: 1, hp: 6, hit: 1 },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        }
    });
    registered = true;
}

/** What the scene laid, and what broke, for the readout. */
let scene = null;
let offBroke = null;

function put(typeId, point) {
    const spot = MatPlacement.findSpot(typeId, point, { reach: 320 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, { x: spot.x, y: spot.y })?.success ? inst : null;
}

/** A new hero at `level` in every skill, full health, room made in the roster, holding `itemId` from the Bank. */
function qaHero(name, level, itemId) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    if (!HeroManager.addHero(hero)) return null;
    InventoryManager.addItem(itemId, 1);
    return EquipmentManager.equipItem(hero.id, itemId)?.success === false ? null : hero;
}

/**
 * Below the Guild Hall: the QA Endless Oak with QA Woodcutter on it holding a QA Brittle Woodaxe,
 * and the QA Training Slime with QA Duelist on it holding a QA Brittle Sword. A spare QA Brittle
 * Woodaxe waits in the Bank: nothing equips it when the first one breaks.
 * ⚠️ Changes the game, like Spawn Party: it adds two heroes and the items.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpBreakScene() {
    registerQa();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const oak = put(QA_BREAK.OAK, { x: c.x - 220, y: c.y + 260 });
    const slime = put(QA_BREAK.SLIME, { x: c.x + 220, y: c.y + 260 });
    if (!oak || !slime) return { ok: false, error: 'No room below the Guild Hall for the scene' };
    TileModifiers.rebuildAll();

    const cutter = qaHero('QA Woodcutter', 10, QA_BREAK.AXE);
    const duelist = qaHero('QA Duelist', 30, QA_BREAK.SWORD);
    if (!cutter || !duelist) return { ok: false, error: 'The roster would not take two more heroes' };
    InventoryManager.addItem(QA_BREAK.AXE, 1);
    qaOrder(cutter.id, { x: oak.x, y: oak.y });
    qaOrder(duelist.id, { x: slime.x, y: slime.y });

    scene = { oak: oak.id, slime: slime.id, cutter: cutter.id, duelist: duelist.id, broke: [], cycles: { [oak.id]: 0, [slime.id]: 0 } };
    offBroke?.();
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.GEAR_BROKE, (p) => {
            if (!scene || (p?.heroId !== scene.cutter && p?.heroId !== scene.duelist)) return;
            scene.broke.push({ heroId: p.heroId, itemId: p.itemId, after: scene.cycles[p.instanceId] ?? null });
        }, UI_LISTENER),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (scene && p?.instanceId in scene.cycles) scene.cycles[p.instanceId]++;
        }, UI_LISTENER)
    ];
    offBroke = () => offs.forEach(off => off());
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_tools_break' });
    return { ok: true };
}

/**
 * Give each QA hero a new brittle tool from the Bank's spares (one is added if none is left) and
 * send them back to work: the next break can then be watched, or played through time away.
 * @returns {{ok: boolean, error?: string}}
 */
export function rearmBreakScene() {
    if (!scene) return { ok: false, error: 'Lay out the scene first' };
    for (const [heroId, itemId, tokenId] of [[scene.cutter, QA_BREAK.AXE, scene.oak], [scene.duelist, QA_BREAK.SWORD, scene.slime]]) {
        const hero = HeroManager.getHero(heroId);
        const token = BoardState.getTokenById(tokenId);
        if (!hero || !token) continue;
        if (!getGrid(hero).includes(itemId)) {
            if (!InventoryManager.hasItem(itemId, 1)) InventoryManager.addItem(itemId, 1);
            EquipmentManager.equipItem(heroId, itemId);
        }
        if (Flags.pinnedIdOf(heroId) !== tokenId) qaOrder(heroId, { x: token.x, y: token.y });
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_tools_break' });
    return { ok: true };
}

/**
 * Play five minutes of time away with the loading bar and the "While you were away" summary, so
 * its news says which tools broke.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function playBreakTimeAway(ms = AWAY_MS) {
    if (CatchUp.isRunning()) return { ok: false, error: 'A catch-up is already playing' };
    const now = Date.now();
    await CatchUp.run({ savedAt: now - ms, now, save: false });
    return { ok: true };
}

const heroName = (id) => HeroManager.getHero(id)?.name || id;
const itemName = (id) => getItem(id)?.name || id;

/**
 * What the scene shows, read from the engine, refreshed while the panel is open. Live play only:
 * time away's breaks are in its summary.
 * @returns {string[]}
 */
export function breakReadout() {
    if (!scene) return [];
    const lines = [];
    for (const [heroId, tokenId] of [[scene.cutter, scene.oak], [scene.duelist, scene.slime]]) {
        const hero = HeroManager.getHero(heroId);
        if (!hero) continue;
        const held = getGrid(hero).filter(id => breakChanceOf(getItem(id)) > 0);
        const holding = held.length ? held.map(id => `${itemName(id)} (${breakChanceOf(getItem(id))}%)`).join(', ') : 'nothing that breaks';
        const status = Flags.statusOf(heroId);
        const doing = status.needsJob ? 'stopped: needs a job'
            : status.state === 'working' ? `working ${tokenName(BoardState.getTokenById(status.instanceId)?.typeId) || ''}`
                : `${status.state}${Flags.pinnedIdOf(heroId) === tokenId ? ' by its Token' : ''}`;
        lines.push(`${hero.name}: holds ${holding}; ${doing}; ${scene.cycles[tokenId] ?? 0} cycles`);
    }
    lines.push(`Spare QA Brittle Woodaxes in the Bank: ${InventoryManager.getItemCount(QA_BREAK.AXE)}`);
    for (const b of scene.broke.slice(-4)) lines.push(`  broke: ${heroName(b.heroId)}'s ${itemName(b.itemId)} after ${b.after} cycles`);
    return lines;
}
