// a Laboratory: the node it studies, whether it can study it now, and the nodes in its reach to pick

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { LABORATORY_KIND, laboratoryOf } from '../../config/registries/mastery.js';
import { stationKindOf } from '../effects/statements.js';
import * as BoardState from './BoardState.js';
import * as Demolition from './Demolition.js';
import * as Respawn from './Respawn.js';
import * as Fields from './Fields.js';
import * as Hand from './Hand.js';
import * as Mastery from '../progression/Mastery.js';
import { inReach, tokensInReach, writePick } from './reachPick.js';

/**
 * Science's one building (brief 810 K6). A **Laboratory** is a station that works as Science with
 * the station kind `laboratory` (`mastery.LABORATORY_KIND`); it runs no recipe. The player picks, on
 * its card, one **node** in its reach to study (`instance.studies`, the node's instance id, saved), as
 * a station's recipe is picked: a vein, a tree, a bush, a Field, a Fishing Spot, any Token whose
 * node kind has a mastery track (`Mastery.trackOf`) at a gathering level the Laboratory reaches
 * (`laboratory.maxLevel`, `mastery.laboratoryOf`).
 *
 * Each cycle its hero studies the node: the cycle wears the node as gathering it would (its chance to
 * end, a Field's harvest, a spot's chance to move on) and gives no goods, only a mastery point to
 * the node's kind, guild-wide (`Studies.js`). Its hero needs the kind's gathering level in Science
 * (`StationRecipe.workConfigOf` folds it in, as a recipe's level). No risk.
 *
 * The same shape as the Crime Hideout's camp (`Hideouts.js`): a station whose card picks one Token
 * in its reach, kept by instance id and refused out of reach (`reachPick.js`).
 *
 * While the node is **away** (resting, a Stump growing back, a Field with nothing ripe, in the
 * player's hand) the Laboratory waits, its hero beside it; a node that left the mat (a spot that
 * moved on) leaves it asking for another. A tree that becomes its Stump keeps the pick
 * (`Studies.followTransform`). A kind the guild has fully mastered is studied no more.
 *
 * ⚠️ Read side only: nothing here wears a node or adds a point, so the recipe resolver and the work
 * check can ask it without an import cycle through the spawners and the charges.
 */

const labMemo = new WeakMap();

/** Whether a Token type is a Laboratory: a station of the Laboratory kind. Kept per definition. */
export function isLaboratory(def) {
    if (!def || typeof def !== 'object') return false;
    let answer = labMemo.get(def);
    if (answer === undefined) {
        answer = stationKindOf(def) === LABORATORY_KIND;
        labMemo.set(def, answer);
    }
    return answer;
}

/** The highest gathering level a Laboratory studies, or null for any. */
export function maxLevelOf(lab) {
    return laboratoryOf(getTokenType(lab?.typeId)).maxLevel;
}

/**
 * Why a Laboratory may not study a Token on the mat, wherever it stands, or null when it may:
 * `'none'` for a Token that is no node with a track (a Laboratory, a station, an enemy, one marked
 * for demolition, a kind with no track), `'level'` for a kind above the Laboratory's reach,
 * `'mastered'` for a kind the guild holds every rank of.
 */
export function refusalOf(lab, node) {
    if (!lab || !node?.typeId || node.id === lab.id || Demolition.isMarked(node)) return 'none';
    const def = getTokenType(node.typeId);
    if (!def || def.enemy || def.spawner || def.foundation || isLaboratory(def)) return 'none';
    const kind = Mastery.kindOf(node);
    if (!Mastery.trackOf(kind)) return 'none';
    const cap = maxLevelOf(lab);
    if (cap != null && Mastery.levelOf(kind) > cap) return 'level';
    if (Mastery.isMastered(kind)) return 'mastered';
    return null;
}

/**
 * Every node in `lab`'s reach whose kind has a track, nearest first (then the earlier placed), as
 * `{ node, kind, level, refusal }`: `refusal` null for one it may study, else `'level'` or
 * `'mastered'` (the card shows those, greyed).
 */
export function candidatesOf(lab) {
    const out = [];
    for (const node of tokensInReach(lab)) {
        const refusal = refusalOf(lab, node);
        if (refusal === 'none') continue;
        const kind = Mastery.kindOf(node);
        out.push({ node, kind, level: Mastery.levelOf(kind), refusal });
    }
    return out;
}

/** The nodes `lab` may study now, nearest first. */
export function nodesInReach(lab) {
    return candidatesOf(lab).filter(c => c.refusal === null).map(c => c.node);
}

/**
 * The node `lab` is set to study, while it is one it may (on the mat, a node with a track, in reach,
 * within its level), mastered or not. Null otherwise. ⚠️ The chosen id is kept when it fails, so a
 * node moved back into reach is studied again; only the player's next pick replaces it.
 */
export function targetOf(lab) {
    const id = lab?.studies;
    if (typeof id !== 'string') return null;
    const node = BoardState.getTokenById(id);
    if (!node || !inReach(lab, node)) return null;
    const refusal = refusalOf(lab, node);
    return refusal === null || refusal === 'mastered' ? node : null;
}

/**
 * Set the node a Laboratory studies: the only writer of `studies`. Refused unless `nodeId` is one
 * of {@link nodesInReach}. A new pick starts the cycle from zero and says so (`TILE_CHANGED`), as a
 * station's new recipe does.
 * @returns {boolean} whether the pick was taken
 */
export function setTarget(lab, nodeId) {
    if (!lab || !isLaboratory(getTokenType(lab.typeId))) return false;
    if (!nodesInReach(lab).some(n => n.id === nodeId)) return false;
    return writePick(lab, 'studies', nodeId);
}

/**
 * Whether a node cannot be worn now, so a study waits for it: in the player's hand, resting until it
 * comes back, a stage with no work of its own (a Stump growing back), a Field with nothing ripe.
 */
export function isNodeAway(node) {
    if (!node) return true;
    if (Hand.isInHand(node.id)) return true;
    const def = getTokenType(node.typeId);
    if (Fields.isField(def)) return Fields.stageOf(node, def) !== Fields.STAGE.RIPE;
    if (!def?.config) return true;
    return Respawn.isResting(node, def);
}

/**
 * What a Laboratory is doing now, for the recipe resolver: `{ ok: true, node, kind }` while it can
 * study, else `{ ok: false, reason, node?, kind? }`: `choose_node` with nothing (valid) chosen,
 * `mastered` for a kind with every rank held, `node_away` while its node is away.
 */
export function studyOf(lab) {
    const node = targetOf(lab);
    if (!node) return { ok: false, reason: 'choose_node' };
    const kind = Mastery.kindOf(node);
    if (Mastery.isMastered(kind)) return { ok: false, reason: 'mastered', node, kind };
    if (isNodeAway(node)) return { ok: false, reason: 'node_away', node, kind };
    return { ok: true, node, kind };
}

/** Whether a Laboratory's node is away now (`WorkCheck.isAway` asks it of every held Token). */
export function isWaiting(lab, def = getTokenType(lab?.typeId)) {
    return isLaboratory(def) && studyOf(lab).reason === 'node_away';
}

/**
 * The gathering level a hero needs in Science to study the Laboratory's chosen node: its kind's
 * level, 0 with nothing (valid) chosen. `StationRecipe.workConfigOf` folds it into `skillRequired`.
 */
export function studyLevelOf(lab) {
    const node = targetOf(lab);
    return node ? Mastery.levelOf(Mastery.kindOf(node)) : 0;
}

/**
 * What a study of `node` takes, as a gathering cycle there would: a ripe Field's seed still owed
 * (its first harvest's), nothing for any other node.
 */
export function studyInputsOf(node) {
    const def = getTokenType(node?.typeId);
    return Fields.isField(def) ? Fields.seedOwedOf(node, def) : [];
}

/** The Laboratories on the mat, remembered while nothing arrives or leaves. */
let labsKept = { tokens: null, version: -1, list: [] };

function labsOnMat() {
    const { tokens, version } = BoardState.membershipVersion();
    if (labsKept.tokens !== tokens || labsKept.version !== version) {
        labsKept = { tokens, version, list: BoardState.tokens().filter(t => isLaboratory(getTokenType(t.typeId))) };
    }
    return labsKept.list;
}

/** The Laboratories on the mat set to study `node` (by its id), whoever works them. */
export function laboratoriesStudying(nodeId) {
    if (!nodeId) return [];
    return labsOnMat().filter(lab => lab.studies === nodeId);
}

/**
 * Whether a hero is studying `node` from a Laboratory: one is set to it, in reach, and worked. A
 * Fishing Spot studied so counts as worked: it does not drift off unworked (`TimedChanges`).
 */
export function isStudied(node) {
    if (!node?.id) return false;
    for (const lab of labsOnMat()) {
        if (lab.studies === node.id && BoardState.workerOf(lab.id) && targetOf(lab)?.id === node.id) return true;
    }
    return false;
}
