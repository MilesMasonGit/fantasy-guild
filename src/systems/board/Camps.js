// camps: a Token that hands the heroes sent to it every job of its skill in its reach

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { fieldOf, campOf, CAMP_REACH_DEFAULT } from '../../config/registries/tokenConstants.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { stationSkillOf } from '../effects/statements.js';
import * as BoardState from './BoardState.js';
import * as SpawnerSystem from './SpawnerSystem.js';
import * as EnemyMotion from './EnemyMotion.js';
import * as Demolition from './Demolition.js';
import { isGuildHall } from './MatCap.js';
import { centreOf, distanceSq } from './nearby.js';

/**
 * A **camp** is a Token type with a `camp` block, `{ skill, reach }` (the CMS Token editor's Camp
 * block), built on a Foundation like a station: the Logging Camp, the Mining Camp, the Fishing Hut,
 * the Farmstead. A hero ordered onto one works, one at a time, the Tokens of its skill within
 * `reach` mat units of its centre (centre to centre); any number of heroes may work from one camp,
 * one hero per Token. Which one, and when they move on, is `Flags`' business; this file says what a
 * camp hands out.
 *
 * A camp's work is a Token whose own work names the camp's skill: a tree, a vein, water, a berry
 * bush. Never a station, which takes a recipe and its inputs (a Windmill, a Furnace), except a
 * **Field**, whose harvest is its crop: a Farmstead harvests the ripe Fields in its reach. Never a
 * Foundation, a spawner, an enemy, a Promotion Token, the Guild Hall or a Token marked for
 * demolition (that is the demolisher's job).
 *
 * An **enemy camp** is any working spawner of enemies (the Goblin Camp, a boss's camp of one): no
 * block needed. A hero ordered onto one hunts what it spawned (the enemies tethered to it,
 * `EnemyMotion.tetherOf`) and waits for the next when it stands empty.
 *
 * A camp marked for demolition is only that job (`Demolition`): it hands out nothing until the mark
 * comes off.
 */

/** A Token type's camp terms, `{ skill, reach }`, or null (`tokenConstants.campOf`). */
export { campOf, CAMP_REACH_DEFAULT };

/** The camp a Token on the mat is (`{ skill, reach }`), or null: not a camp, or marked for demolition. */
export function campOfInstance(instance) {
    if (!instance?.typeId || Demolition.isMarked(instance)) return null;
    return campOf(getTokenType(instance.typeId));
}

/** Each spawner type's enemies, memoised per type id on the registry's version (`SpawnerSystem.familyOf`). */
const enemyFamilies = new Map();
let enemyFamiliesVersion = -1;

/** The enemy types a spawner type puts on the mat (its family's enemies), in its family's order. */
export function enemiesOf(typeId) {
    const version = registryVersion();
    if (version !== enemyFamiliesVersion) {
        enemyFamilies.clear();
        enemyFamiliesVersion = version;
    }
    let list = enemyFamilies.get(typeId);
    if (!list) {
        list = SpawnerSystem.familyOf(typeId).filter(id => isEnemyDef(getTokenType(id)));
        enemyFamilies.set(typeId, list);
    }
    return list;
}

/** Whether a Token on the mat is an enemy camp: a working spawner of enemies, not turned, not marked for demolition. */
export function isEnemyCamp(instance) {
    if (!instance?.typeId || instance.turnedFrom || Demolition.isMarked(instance)) return false;
    if (!SpawnerSystem.isSpawner(getTokenType(instance.typeId))) return false;
    return enemiesOf(instance.typeId).length > 0;
}

/** Whether a Token on the mat takes a camp order: a camp, or an enemy camp. */
export function isCampLike(instance) {
    return !!campOfInstance(instance) || isEnemyCamp(instance);
}

/**
 * Whether a Token type is the kind of work a camp of `block` hands out, wherever it stands: its own
 * work names the camp's skill, and it is not a station (a Field excepted), a Foundation, a spawner,
 * an enemy, another camp or the Guild Hall.
 */
export function worksType(block, def) {
    if (!block || !def) return false;
    if (def.config?.skill !== block.skill || def.requiresHero === false) return false;
    // A Promotion Token trains through its rule and authors no work of its own, so it never matches.
    if (isEnemyDef(def) || def.spawner || def.foundation || def.camp || def.isGuildHall) return false;
    return !stationSkillOf(def) || fieldOf(def) != null;
}

/** Whether a mat point lies within a work camp's reach (centre to centre, inclusive). */
export function reaches(camp, block, point) {
    const centre = centreOf(camp);
    return !!centre && !!point && distanceSq(centre, point) <= block.reach * block.reach;
}

/**
 * Whether `instance` is work `camp` hands out right now (not yet checked against any hero): for a
 * work camp, a Token of its kind ({@link worksType}) standing in its reach and not marked for
 * demolition; for an enemy camp, an enemy it spawned.
 */
export function isCampWork(camp, instance) {
    if (!camp || !instance || instance.id === camp.id) return false;
    const block = campOfInstance(camp);
    if (block) {
        if (Demolition.isMarked(instance) || isGuildHall(instance)) return false;
        return worksType(block, getTokenType(instance.typeId)) && reaches(camp, block, centreOf(instance));
    }
    return isEnemyCamp(camp) && instance.tether === camp.id && isEnemyDef(getTokenType(instance.typeId));
}

/** Every Token `camp` hands out now, in the mat's order (unsorted). Empty for a Token that is not a camp. */
export function campWork(camp) {
    if (!camp) return [];
    const block = campOfInstance(camp);
    const enemy = !block && isEnemyCamp(camp);
    if (!block && !enemy) return [];
    const out = [];
    for (const instance of BoardState.tokens()) {
        if (isCampWork(camp, instance)) out.push(instance);
    }
    return out;
}

/**
 * The ring a camp shows on hover, `{ x, y, r }` in mat units, or null for a Token that is not one:
 * a work camp's reach; an enemy camp's ground, where its enemies roam (`EnemyMotion.areaOf`).
 */
export function reachRingOf(instance) {
    const centre = centreOf(instance);
    if (!centre) return null;
    const block = campOfInstance(instance);
    if (block) return { ...centre, r: block.reach };
    if (isEnemyCamp(instance)) return { ...centre, r: EnemyMotion.areaOf(instance).outer };
    return null;
}

/** The camp `heroId`'s order names while it stands on the mat, or null (no order, another Token, a spot). */
export function campOfHero(heroId) {
    const id = BoardState.flagOf(heroId)?.pinnedTo;
    const token = typeof id === 'string' ? BoardState.getTokenById(id) : null;
    return token && isCampLike(token) ? token : null;
}
