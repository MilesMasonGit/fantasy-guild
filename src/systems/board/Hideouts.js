// a Hideout: the camp it robs, what a theft takes, and whether the thief is caught

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { worldTables } from '../../config/registries/worldTablesRegistry.js';
import { HIDEOUT_KIND, stealOf, crimeLevelOf, caughtCurveOf, caughtChance } from '../../config/registries/crime.js';
import { stationKindOf } from '../effects/statements.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import * as BoardState from './BoardState.js';
import * as TileModifiers from './TileModifiers.js';
import * as Demolition from './Demolition.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { inReach, tokensInReach, writePick } from './reachPick.js';

/**
 * Crime's one building. A **Hideout** is a station that works as Crime with the station kind
 * `hideout` (`crime.HIDEOUT_KIND`); it runs no recipe. The player picks, on its card, one **enemy
 * camp** in its reach to rob (`instance.stealFrom`, the camp's instance id, saved), as a station's
 * recipe is picked. Each cycle its hero rolls that camp's enemy's **steal table** (`crime.stealOf`)
 * in place of a recipe's outputs (`RecipeResolver.effectiveIO`), and the enemies stand where they
 * stood: thieves and fighters share a camp.
 *
 * A camp can be robbed when it is a working spawner of enemies (not marked for demolition), its
 * enemy carries a steal table, and it is not a **boss camp** (one the world tables list as a kit's
 * `bossCamps`): bosses are fought, never robbed. The camp's enemy is the first enemy its spawns name
 * that carries a table, and the camp's Crime level is that enemy's (`crime.crimeLevelOf`).
 *
 * A thief is **caught** at the odds of their Crime level against the camp's (`caughtChanceAt`). A
 * catch takes nothing and puts a **guard** on the camp (`Thefts.js`): one of the camp's enemy,
 * marked `guardOf` (the camp's id, saved), standing past the camp's cap and outside the Token cap.
 * While a guard stands on it ({@link guardOf}) the camp cannot be robbed: its Hideouts wait, saying
 * so. Any hero may fight the guard; a hero sent to the camp hunts it with the camp's own
 * (`Camps.isCampWork`).
 *
 * ⚠️ Read side only: nothing here spawns or pays, so `RecipeResolver` can ask it without an import
 * cycle through the spawners.
 */

const hideoutMemo = new WeakMap();

/**
 * Whether a Token type is a Hideout: a station of the Hideout kind. Kept per definition object: the
 * recipe resolver asks it of every station it resolves, many times a tick.
 */
export function isHideout(def) {
    if (!def || typeof def !== 'object') return false;
    let answer = hideoutMemo.get(def);
    if (answer === undefined) {
        answer = stationKindOf(def) === HIDEOUT_KIND;
        hideoutMemo.set(def, answer);
    }
    return answer;
}

/** Whether a Token type is a boss camp: a kit of the world tables names it among its `bossCamps`. */
export function isBossCampType(typeId) {
    if (!typeId) return false;
    return (worldTables()?.kits || []).some(kit => Array.isArray(kit?.bossCamps) && kit.bossCamps.includes(typeId));
}

/**
 * The enemy a camp type is robbed of: the first enemy its spawns name that carries a steal table, as
 * `{ typeId, def, steal }`, or null when none does (or it is no spawner).
 */
export function robbedEnemyOfType(campTypeId) {
    const spawns = getTokenType(campTypeId)?.spawner?.spawns;
    if (!Array.isArray(spawns)) return null;
    for (const entry of spawns) {
        const def = entry?.typeId && Number(entry.weight) > 0 ? getTokenType(entry.typeId) : null;
        if (!isEnemyDef(def)) continue;
        const steal = stealOf(def);
        if (steal) return { typeId: entry.typeId, def, steal };
    }
    return null;
}

/**
 * Whether a Token on the mat is a camp a Hideout may rob, wherever it stands: a spawner of enemies
 * whose enemy carries a steal table, not a boss camp, not marked for demolition.
 */
export function isRobbable(camp) {
    if (!camp?.typeId || Demolition.isMarked(camp)) return false;
    if (isBossCampType(camp.typeId)) return false;
    return robbedEnemyOfType(camp.typeId) != null;
}

/** The camps `hideout` may rob now, nearest first (then the earlier placed). */
export function campsInReach(hideout) {
    return tokensInReach(hideout).filter(isRobbable);
}

/**
 * The camp `hideout` is set to rob, while it is still one it may: on the mat, robbable and in reach.
 * Null otherwise. ⚠️ The chosen id is kept when it fails, so a camp moved back into reach is robbed
 * again; only the player's next pick replaces it.
 */
export function targetOf(hideout) {
    const id = hideout?.stealFrom;
    if (typeof id !== 'string') return null;
    const camp = BoardState.getTokenById(id);
    return camp && isRobbable(camp) && inReach(hideout, camp) ? camp : null;
}

/**
 * Set the camp a Hideout robs: the only writer of `stealFrom`. Refused unless `campId` is one of
 * {@link campsInReach}. A new pick starts the Hideout's cycle from zero and says so
 * (`TILE_CHANGED`), as a station's new recipe does.
 * @returns {boolean} whether the pick was taken
 */
export function setTarget(hideout, campId) {
    if (!hideout || !isHideout(getTokenType(hideout.typeId))) return false;
    if (!campsInReach(hideout).some(c => c.id === campId)) return false;
    return writePick(hideout, 'stealFrom', campId);
}

/** Whether a Token on the mat is a guard a catch set on a camp. */
export function isGuard(instance) {
    return typeof instance?.guardOf === 'string';
}

/** The guard standing on `camp`, or null: while one stands, nobody robs it. */
export function guardOf(camp) {
    if (!camp?.id) return null;
    return BoardState.tokens().find(t => t.guardOf === camp.id && isEnemyDef(getTokenType(t.typeId))) || null;
}

/** A hero's Crime level (or the Hideout's skill's), 0 with nobody. */
function thiefLevel(heroId, skill) {
    return heroId ? (Number(SkillSystem.getSkillLevel(heroId, skill)) || 0) : 0;
}

/**
 * The percent `heroId` is caught robbing `camp` from Hideout `hideoutId` now: the Hideout's curve
 * (`crime.caughtCurveOf`) at their Crime level against the camp's, less the Quiet that reaches the
 * Hideout (its own, a neighbour's, the guild's and what the thief carries), never past the curve's
 * floor or ceiling. Draws nothing.
 */
export function caughtChanceAt(hideoutId, heroId, camp) {
    const hideout = BoardState.getTokenById(hideoutId);
    const def = getTokenType(hideout?.typeId);
    const robbed = robbedEnemyOfType(camp?.typeId);
    if (!def || !robbed) return 0;
    const skill = def.config?.skill || 'crime';
    const quiet = TileModifiers.resolveAxis(hideoutId, EFFECT_TYPES.QUIET, 0, skill, heroId || undefined);
    return caughtChance(thiefLevel(heroId, skill), crimeLevelOf(robbed.def), caughtCurveOf(def), quiet);
}

/**
 * What a Hideout is doing now, for the recipe resolver: `{ ok: true, camp, robbed }` while it can
 * rob its chosen camp, else `{ ok: false, reason }`: `choose_camp` with nothing (valid) chosen,
 * `guarded` while a guard stands on the camp.
 */
export function theftOf(hideout) {
    const camp = targetOf(hideout);
    if (!camp) return { ok: false, reason: 'choose_camp' };
    if (guardOf(camp)) return { ok: false, reason: 'guarded', camp };
    return { ok: true, camp, robbed: robbedEnemyOfType(camp.typeId) };
}
