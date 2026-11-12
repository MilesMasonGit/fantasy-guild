// QA scene for the War Camp rule, for the owner's look. QA BUILDS ONLY: wired to a QA panel
// button by the director, deleted once the War Camp is authored content.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as Camps from '../../systems/board/Camps.js';
import * as Orders from '../../systems/board/Orders.js';
import { reachRadius } from '../../systems/board/nearby.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../systems/combat/CombatFormulas.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/** The QA War Camp: a camp of a combat style (the mark), the Fighter's Academy picture standing in. Gone on reload. */
export const QA_WAR_CAMP = 'qa_war_camp';

/** The enemies laid in its reach (shipped Tokens), each as an offset from the camp, inside the standard reach. */
const IN_REACH = Object.freeze([
    { typeId: 'token_goblin', dx: 150, dy: 0 },
    { typeId: 'token_wolf', dx: -120, dy: 110 },
    { typeId: 'token_crab', dx: 40, dy: -170 },
    { typeId: 'token_goblin', dx: -170, dy: -60 }
]);

/** One goblin laid just outside its reach, never fought. */
const OUTSIDE = Object.freeze({ typeId: 'token_goblin', dx: 300, dy: 70 });

/** How far past the reach an enemy camp must stand: its spawns land round it. */
const CAMP_CLEARANCE = 200;

/** Where the camp is tried, from the Hall: left below it, right below, left above, right above. */
const TRIES = Object.freeze([
    ['left below the Hall', { x: -560, y: 300 }], ['right below the Hall', { x: 560, y: 300 }],
    ['left above the Hall', { x: -560, y: -300 }], ['right above the Hall', { x: 560, y: -300 }]
]);

/** A Token of `typeId` at the free spot nearest `point` (within `reach`), or null. */
function put(typeId, point, reach) {
    const at = MatPlacement.findSpot(typeId, point, { reach });
    if (!at) return null;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** A Fighter with every skill at `level`, on the roster (it grows to take them), an Iron Sword in hand and Steak to eat. */
function qaFighter(name, level) {
    const ranks = GameState.state.progress.guildUpgrades || (GameState.state.progress.guildUpgrades = {});
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ spriteId: 'fighter', name });
    for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    const maxHp = heroMaxHpFromSkills(hero.skills);
    hero.hp = { current: maxHp, max: maxHp };
    hero.name = name;
    if (!HeroManager.addHero(hero)) return null;
    const sword = getItem('item_iron_sword') ? 'item_iron_sword' : 'item_copper_sword';
    for (const [itemId, n] of [[sword, 1], ['item_steak', 20]]) {
        if (!getItem(itemId)) continue;
        InventoryManager.addItem(itemId, n);
        EquipmentManager.equipItem(hero.id, itemId);
    }
    return hero;
}

/**
 * A QA War Camp beside the Guild Hall with four enemies standing in its reach (two Goblins, a Wolf,
 * a Crab) and a Goblin just outside it, and a QA Fighter at 40 (Iron Sword, Steak) sent to it. They
 * walk out, fight the nearest enemy in reach, then the next, one at a time, leave the Goblin outside
 * alone and wait at the camp once none is left ("Nothing to fight near QA War Camp"). Tried left
 * below the Hall, then right below, left above and right above, wherever everything fits clear of
 * every enemy camp (the Starter Camp's Goblin Camp included).
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ ok: boolean, error?: string, where?: string, name?: string, campId?: string, inReach?: number, outsideId?: string }}
 */
export function setUpWarCamp() {
    registerTokenTypes({
        [QA_WAR_CAMP]: {
            id: QA_WAR_CAMP, name: 'QA War Camp', tokenType: 'camp', rarity: 'common', theme: 'fixture', sprite: 't_school_fighter',
            size: 1, uses: null, requiresHero: false, config: null, camp: { skill: 'melee' }
        }
    });
    const missing = [...IN_REACH, OUTSIDE].map(e => e.typeId).find(id => !getTokenType(id));
    if (missing) return { ok: false, error: `No ${missing} in the content` };
    const hall = HeroMotion.guildHallPoint() || { x: 960, y: 520 };
    for (const [where, off] of TRIES) {
        const camp = put(QA_WAR_CAMP, { x: hall.x + off.x, y: hall.y + off.y }, 60);
        if (!camp) continue;
        // Clear of every enemy camp, so its spawns never land in the reach and the wait shows.
        if (BoardState.tokens().some(t => Camps.isEnemyCamp(t) && Math.hypot(t.x - camp.x, t.y - camp.y) <= reachRadius() + CAMP_CLEARANCE)) {
            BoardState.removeToken(camp.id);
            continue;
        }
        const laid = [];
        let fits = true;
        for (const e of [...IN_REACH, OUTSIDE]) {
            const t = put(e.typeId, { x: camp.x + e.dx, y: camp.y + e.dy }, 40);
            const inReach = !!t && Camps.isCampWork(camp, t);
            if (!t || inReach !== (e !== OUTSIDE)) { fits = false; if (t) laid.push(t); break; }
            // Placed by hand: tied to no enemy camp.
            BoardState.setTether(t, null);
            laid.push(t);
        }
        if (!fits) {
            for (const t of [camp, ...laid]) BoardState.removeToken(t.id);
            continue;
        }
        const hero = qaFighter('QA War Camp hand', 40);
        if (!hero) return { ok: false, error: 'The roster would not take another hero' };
        const order = Orders.orderAt(hero.id, { x: camp.x, y: camp.y });
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_war_camp' });
        if (!order.success) return { ok: false, error: order.reason, where };
        return {
            ok: true, where, name: hero.name, campId: camp.id,
            inReach: Camps.campWork(camp).length, outsideId: laid[laid.length - 1].id
        };
    }
    return { ok: false, error: 'No room round the Hall for the War Camp and its enemies' };
}
