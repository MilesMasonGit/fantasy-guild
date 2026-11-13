// The edge of the one standard reach, for a test: a camp with an Oak Tree just inside its reach and
// one just outside, and a woodcutter sent to it.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as Camps from '../../systems/board/Camps.js';
import { reachRadius } from '../../systems/board/nearby.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';

function hallPoint() {
    return HeroMotion.guildHallPoint() || { x: 960, y: 520 };
}

/** A new hero with `skills` at their levels holding `tool` (added to the Bank first); the roster grows to take them. */
function qaHero(name, skills, tool = null) {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    for (const [id, level] of Object.entries(skills)) hero.skills[id] = { ...(hero.skills?.[id] || {}), level, xp: xpForLevel(level) };
    if (!HeroManager.addHero(hero)) return null;
    if (tool && getItem(tool)) {
        if (!InventoryManager.hasItem(tool, 1)) InventoryManager.addItem(tool, 1);
        EquipmentManager.equipItem(hero.id, tool);
    }
    return hero;
}

/** The reach-edge scene's camp: a QA Logging Camp of its own type, so the four-camp scene never takes it for its own. */
const EDGE_CAMP = 'qa_camp_edge';
const EDGE_TREE = 'token_oak_tree';
/** How far inside and outside the standard reach the edge scene's two trees stand. */
const EDGE_MARGIN = 20;

/** A Token of `typeId` standing within a few units of `point`, or null when there is no room right there. */
function putExactly(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 4 });
    if (!at) return null;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/**
 * The edge of the one standard reach, to see by clicking: a QA Logging Camp with an Oak Tree 20 u
 * inside its reach and one 20 u outside, side by side, and a woodcutter sent to it. The hand fells
 * the inside tree and never touches the outside one. Tried left below the Hall, then right below,
 * left above and right above, wherever all three fit exactly.
 * @returns {{ ok: boolean, error?: string, where?: string, name?: string, reach?: number, inside?: number, outside?: number,
 *   inReach?: number, insideWorked?: boolean, outsideWorked?: boolean }}
 */
export function placeReachEdge() {
    if (!getTokenType(EDGE_TREE)) return { ok: false, error: 'No Oak Tree in the content' };
    registerTokenTypes({
        [EDGE_CAMP]: {
            id: EDGE_CAMP, name: 'QA Edge Camp', tokenType: 'camp', rarity: 'common', theme: 'fixture', sprite: 't_sawmill',
            size: 1, uses: null, requiresHero: false, config: null, camp: { skill: 'forestry' }
        }
    });
    const r = reachRadius();
    const c = hallPoint();
    const tries = [
        ['left below the Hall', { x: c.x - 560, y: c.y + 320 }], ['right below the Hall', { x: c.x + 560, y: c.y + 320 }],
        ['left above the Hall', { x: c.x - 560, y: c.y - 320 }], ['right above the Hall', { x: c.x + 560, y: c.y - 320 }]
    ];
    for (const [where, p] of tries) {
        const camp = putExactly(EDGE_CAMP, p);
        if (!camp) continue;
        const inside = putExactly(EDGE_TREE, { x: camp.x + r - EDGE_MARGIN, y: camp.y });
        const outside = inside && putExactly(EDGE_TREE, { x: camp.x - r - EDGE_MARGIN, y: camp.y });
        if (!inside || !outside) {
            for (const t of [camp, inside].filter(Boolean)) BoardState.removeToken(t.id);
            continue;
        }
        const hand = qaHero('QA Edge hand', { forestry: 10 }, 'item_copper_woodaxe');
        if (!hand) return { ok: false, error: 'The roster would not take another hero' };
        Orders.orderAt(hand.id, { x: camp.x, y: camp.y });
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_camps' });
        const dist = (t) => Math.round(Math.hypot(t.x - camp.x, t.y - camp.y));
        return {
            ok: true, where, name: hand.name, reach: r, inside: dist(inside), outside: dist(outside),
            inReach: Camps.campWork(camp).length, insideWorked: Camps.isCampWork(camp, inside), outsideWorked: Camps.isCampWork(camp, outside)
        };
    }
    return { ok: false, error: 'No room for the camp and both trees round the Hall' };
}
