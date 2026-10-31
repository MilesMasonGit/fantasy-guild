// The QA panel's world map tools: pay for the frontier without playing for it
// ⚠️ DEV BUILDS ONLY: TestDashboard renders the Atlas section behind `import.meta.env.DEV`.

import * as World from '../../systems/world/World.js';
import { CELL_STATE } from '../../systems/world/frontier.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { addXP, getSkillLevel } from '../../systems/hero/SkillSystem.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Everything the frontier asks, put in place so any frontier cell can be settled at once: each
 * item short added to the Bank (enough for every frontier cell together), and each skill raised
 * on the first hero to the highest level asked, through ordinary XP. Nothing is taken.
 *
 * @returns {{success: boolean, reason?: string, cells?: number, items?: number, skills?: number}}
 */
export function meetFrontierPrices() {
    const world = World.currentWorld();
    if (!world) return { success: false, reason: 'This game has no world' };
    const states = World.cellStatesNow(world);
    const frontier = world.cells.filter(c => states.get(c.id) === CELL_STATE.FRONTIER);
    const items = new Map();
    const skills = new Map();
    for (const cell of frontier) {
        for (const { itemId, qty } of cell.requires?.items || []) items.set(itemId, (items.get(itemId) || 0) + qty);
        for (const { skill, level } of cell.requires?.skills || []) skills.set(skill, Math.max(skills.get(skill) || 0, level));
    }
    let added = 0;
    for (const [itemId, need] of items) {
        const short = need - InventoryManager.getItemCount(itemId);
        if (short > 0) {
            InventoryManager.addItem(itemId, short, 'qa');
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
    return { success: true, cells: frontier.length, items: added, skills: raised };
}
