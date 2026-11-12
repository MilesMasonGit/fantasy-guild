// World fixtures for tests: pay for the frontier without playing for it, the ring stars, and a
// ring-1 place of any kit.

import * as World from '../../systems/world/World.js';
import { CELL_STATE } from '../../systems/world/frontier.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { addXP, getSkillLevel } from '../../systems/hero/SkillSystem.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { GameState } from '../../state/GameState.js';
import { seedFromText } from '../../systems/atlas/seededRandom.js';
import { ORIGIN_ROLE } from '../../systems/world/generate.js';
import { worldTables } from '../../config/registries/worldTablesRegistry.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { authoredStars, getUpgradeDef, getUpgradePrice } from '../../config/guildUpgrades.js';
import { ringStarsOf } from '../../systems/world/ringStars.js';
import { qaRingStarSky } from './qaRingStars.js';

/**
 * Everything the frontier asks, put in place so any frontier cell can be settled at once: each
 * item short added to the Bank (enough for every frontier cell together), and each skill raised
 * on the first hero to the highest level asked, through ordinary XP. A frontier cell whose ring
 * waits for a Guild Hall star gets that star's price in the Bank too, for the star to be bought in
 * the Hall (it is not bought here). Nothing is taken.
 *
 * @returns {{success: boolean, reason?: string, cells?: number, items?: number, skills?: number, stars?: number}}
 */
export function meetFrontierPrices() {
    const world = World.currentWorld();
    if (!world) return { success: false, reason: 'This game has no world' };
    const states = World.cellStatesNow(world);
    const frontier = world.cells.filter(c => states.get(c.id) === CELL_STATE.FRONTIER);
    const items = new Map();
    const skills = new Map();
    const stars = new Set();
    for (const cell of frontier) {
        for (const { itemId, qty } of cell.requires?.items || []) items.set(itemId, (items.get(itemId) || 0) + qty);
        for (const { skill, level } of cell.requires?.skills || []) skills.set(skill, Math.max(skills.get(skill) || 0, level));
        const lock = World.ringLockOf(cell);
        if (lock) stars.add(lock.stars[0].id);
    }
    for (const id of stars) {
        for (const { itemId, quantity } of getUpgradePrice(getUpgradeDef(id), 0) || []) items.set(itemId, (items.get(itemId) || 0) + quantity);
    }
    let added = 0;
    for (const [itemId, need] of items) {
        const short = need - InventoryManager.getItemCount(itemId);
        if (short > 0) {
            InventoryManager.addItem(itemId, short);
            added++;
        }
    }
    const hero = (HeroManager.getAllHeroes() || []).find(h => !h.isVillager);
    let raised = 0;
    if (skills.size && !hero) return { success: false, reason: 'Recruit a hero first: the price asks for skill levels', cells: frontier.length, items: added };
    for (const [skill, level] of skills) {
        const now = getSkillLevel(hero.id, skill);
        if (now === null || now >= level) continue;
        const xp = hero.skills[skill]?.xp || 0;
        addXP(hero.id, skill, Math.max(1, xpForLevel(level) - xp));
        raised++;
    }
    return { success: true, cells: frontier.length, items: added, skills: raised, stars: stars.size };
}

/**
 * Put the ring stars' pack in the sky beside the authored stars (`qaRingStars.js`), so the world
 * map's locked rings show before the pack is synced. Adds nothing once any authored star opens a
 * ring (the synced stars win). Gone on reload.
 *
 * @returns {{success: boolean, reason?: string, added?: number}}
 */
export function installRingStars() {
    if (ringStarsOf(authoredStars()).size) return { success: false, reason: 'The sky has its ring stars already' };
    const authored = authoredHallSky();
    const qa = qaRingStarSky();
    registerHallSky({
        constellations: { ...authored.constellations, ...qa.constellations },
        stars: { ...authored.stars, ...qa.stars }
    });
    // No upgrade event: a quest step reads one as a purchase. The Hall and the map read the sky as they open.
    return { success: true, added: Object.keys(qa.stars).length };
}

/** The specialty each kit's fixture place takes: its own line's skill. */
const FIXTURE_SPECIALTY = Object.freeze({ highland: 'mining', woodland: 'forestry', plains: 'farming', wetland: 'alchemy', riverside: 'fishing' });

/**
 * A ring-1 place of kit `kitId` that is on no world map, for looking at a written mat: the line
 * that leans most to the kit as its own (every origin of its ring-1 table), one origin blended in
 * from another line, the kit's specialty, no hidden extras, and the ring's arrival at its largest,
 * of its commonest enemy. Its seed differs each time, so a second press writes another layout.
 */
export function fixtureCell(kitId, { ring = 1 } = {}) {
    const tables = worldTables();
    const lean = (line) => line.kits?.[kitId] || 0;
    const line = [...tables.lines].sort((a, b) => lean(b) - lean(a))[0];
    const origins = (line.origins[ring] || []).map(o => ({ id: o.id, line: line.id, role: ORIGIN_ROLE.MAIN }));
    const other = tables.lines.find(l => l !== line && lean(l) > 0 && (l.origins[ring] || []).length)
        || tables.lines.find(l => l !== line && (l.origins[ring] || []).length);
    if (other) origins.push({ id: other.origins[ring][0].id, line: other.id, role: ORIGIN_ROLE.BLEND });
    const table = tables.arrival?.[ring];
    const enemy = table?.enemies?.[0]?.id;
    const n = Object.keys(GameState.state?.atlas?.regions || {}).length;
    return {
        id: `qa_${kitId}`, q: 0, r: 0, ring, tier: ring, wedge: line.id, wild: false,
        seed: seedFromText(`qa|${kitId}|${n}`),
        origins, kit: kitId, specialty: FIXTURE_SPECIALTY[kitId] || line.skill, extras: [], value: 0,
        requires: { items: [], skills: [] }, payFrom: [], extreme: null,
        arrival: enemy ? [{ typeId: enemy, count: table.count[1] }] : []
    };
}
