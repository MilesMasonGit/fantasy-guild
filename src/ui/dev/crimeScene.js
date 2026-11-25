// the eye-check scene for Crime (brief 810 K4): a camp with a steal table, two Hideouts, a thief and a fighter
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look, then deleted.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as SkillSystem from '../../systems/hero/SkillSystem.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { GameState } from '../../state/GameState.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { HIDEOUT_KIND } from '../../config/registries/crime.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { KEYWORD } from '../../systems/effects/statements.js';
import { reachRadius } from '../../systems/board/nearby.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload):
 * - QA Pasture: a Cow Pasture of QA Cows (three at most), whose steal table is Wheat (80 %), Milk
 *   (50 %) and a rare Wheat Seed (5 %), the camp's Crime level 5;
 * - QA Hideout and QA Quiet Hideout (Quiet 20) in the pasture's reach, a theft every 4 s;
 * - QA Thief (Crime 3) ordered onto the QA Hideout, which has no camp chosen yet; QA Fighter
 *   (Melee 40) at the Guild Hall, to beat a guard. At Crime 3 against 5 the thief is caught about
 *   one theft in three at the QA Hideout, one in nine at the Quiet one.
 * ⚠️ Changes the game, like Spawn Party.
 */
const COW = 'qa_crime_cow';
const PASTURE = 'qa_crime_pasture';
const HIDEOUT = 'qa_crime_hideout';
const QUIET = 'qa_crime_quiet_hideout';
const THIEF_LEVEL = 3;
const FIGHTER_LEVEL = 40;

const works = (id) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } });
const hideout = (id, name, statements) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'qa', uses: null, sprite: 't_campfire', requiresHero: true,
    config: { skill: 'crime', skillRequired: 1, cycleTimeMs: 4000, xp: 3, inputs: [], outputs: [] },
    statements
});

function registerScene() {
    const cow = getTokenType('token_cow');
    const pasture = getTokenType('token_cow_pasture');
    registerTokenTypes({
        [COW]: {
            ...(cow || {}), id: COW, name: 'QA Cow',
            enemy: { ...(cow?.enemy || {}), level: 5 },
            steal: {
                crimeLevel: 5,
                xp: 4,
                outputs: [
                    { itemId: 'item_wheat', chance: 80, minQty: 1, maxQty: 2 },
                    { itemId: 'item_milk', chance: 50, minQty: 1, maxQty: 1 }
                ],
                rareTable: { chance: 5, entries: [{ itemId: 'item_wheat_seed', weight: 1, minQty: 1, maxQty: 3 }] }
            }
        },
        [PASTURE]: {
            ...(pasture || {}), id: PASTURE, name: 'QA Pasture',
            spawner: { spawns: [{ typeId: COW, weight: 1 }], allowance: 3, intervalMs: 20000, upkeep: [] }
        },
        [HIDEOUT]: hideout(HIDEOUT, 'QA Hideout', [works(HIDEOUT)]),
        [QUIET]: hideout(QUIET, 'QA Quiet Hideout', [works(QUIET), {
            id: `stm_${QUIET}_quiet`, keyword: KEYWORD.PROVIDES, to: null, reach: 'self',
            payload: { type: EFFECT_TYPES.QUIET, bucket: 'flat', value: 20, category: 'crime' }
        }])
    });
}

function place(typeId, near) {
    const at = MatPlacement.findSpot(typeId, near, { reach: 200 });
    const instance = at ? BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

function addHero(name, skills) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, GameState.state.heroes.length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name, takenNames: HeroManager.getAllHeroes().map(h => h.name) });
    if (!HeroManager.addHero(hero)) return null;
    for (const [skill, level] of Object.entries(skills)) {
        const need = xpForLevel(level) - (hero.skills?.[skill]?.xp || 0);
        if (need > 0) SkillSystem.addXP(hero.id, skill, need);
    }
    if (hero.hp) hero.hp.current = hero.hp.max;
    return hero;
}

/**
 * Lays the scene out on the current mat, the pasture near its middle with a Hideout either side.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpCrimeScene() {
    if (!getTokenType('token_cow') || !getItem('item_wheat')) return { ok: false, error: 'No Cow or Wheat in the content' };
    registerScene();
    const centre = Placement.centreOfBoard();
    const pasture = place(PASTURE, centre);
    if (!pasture) return { ok: false, error: 'No room on the mat for the QA Pasture' };
    const side = Math.round(reachRadius() * 0.7);
    const loud = place(HIDEOUT, { x: pasture.x - side, y: pasture.y });
    const quiet = place(QUIET, { x: pasture.x + side, y: pasture.y });
    if (!loud || !quiet) return { ok: false, error: 'No room on the mat for the QA Hideouts' };
    for (let i = 0; i < 3; i++) SpawnerSystem.attemptSpawn(pasture, getTokenType(PASTURE));
    TileModifiers.rebuildAll();

    const thief = addHero('QA Thief', { crime: THIEF_LEVEL });
    const fighter = addHero('QA Fighter', { melee: FIGHTER_LEVEL });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_crime_scene' });
    if (!thief || !fighter) return { ok: false, error: 'The roster would not take the QA heroes' };
    const order = Orders.orderAt(thief.id, { x: loud.x, y: loud.y });
    if (!order?.success) return { ok: false, error: order?.reason || 'The thief would not take the Hideout' };
    return { ok: true };
}
