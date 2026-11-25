// a Laboratory's study: the point it gives the node's kind, the wear it puts on the node, a pick that follows a regrown tree

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { spotOf } from '../../config/registries/fishingSpots.js';
import { POINTS_PER_STUDY } from '../../config/registries/mastery.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as Charges from './Charges.js';
import * as CycleSavings from './CycleSavings.js';
import * as Respawn from './Respawn.js';
import * as Fields from './Fields.js';
import * as FishingSpots from './FishingSpots.js';
import * as Laboratories from './Laboratories.js';
import * as Mastery from '../progression/Mastery.js';

/**
 * The write side of a Laboratory (`Laboratories.js` reads): what a finished study cycle does, from
 * `BoardRunner.completeCycle`, with the study the resolver handed it (`io.study`: `{ nodeId, kind }`).
 *
 * * **Its point** ({@link land}): the node's kind gains a mastery point (`Mastery.addPoints`), a
 *   rank reached putting its buff on every Token of the kind; said as `BOARD_EVENTS.STUDIED`. A
 *   failed cycle learns nothing; an Echo learns once more.
 * * **Its wear** ({@link wear}): the node is worn as one gathering cycle there wears it, no goods
 *   made: its own cost is spent through its chance to end (`Charges.applyDelta`, a vein resting, a
 *   tree becoming its Stump), unless Can't Run Out or Refresh at the node keeps it (read at the node,
 *   on the node's own skill, as its gatherer's cycle reads them); a ripe Field spends a harvest
 *   (`Fields.harvested`, its last sowing again); a Fishing Spot draws its chance to move on, as after
 *   a catch (`FishingSpots.afterCatch`). A failed study still wears, as a failed gathering cycle does,
 *   but draws no Refresh and no move on, as no catch landed.
 */

/** A finished study's point to the node's kind, and its word. Returns the kind's standing after it. */
export function land(lab, study, heroId = null) {
    if (!study?.kind) return null;
    const result = Mastery.addPoints(study.kind, POINTS_PER_STUDY, { heroId, instanceId: lab?.id ?? null });
    if (!result) return null;
    EventBus.publish(BOARD_EVENTS.STUDIED, {
        instanceId: lab.id, typeId: lab.typeId, nodeId: study.nodeId, kind: study.kind,
        kindName: Mastery.kindName(study.kind), points: result.points, rank: result.rank, heroId: heroId || null
    });
    return result;
}

/** The skill a node's own work is narrowed to: its config's, a Field's Farming. */
function skillOfNode(def) {
    return typeof def?.config?.skill === 'string' && def.config.skill ? def.config.skill : undefined;
}

/**
 * Wear the studied node as one gathering cycle there would (see the module header). `overMs`: how
 * long before the tick's end the study ended, so a rest or a new sowing counts from then.
 */
export function wear(study, { failed = false, overMs = 0 } = {}) {
    const node = BoardState.getTokenById(study?.nodeId);
    if (!node) return;
    const def = getTokenType(node.typeId);
    const skill = skillOfNode(def);

    if (Fields.isField(def)) {
        if (Fields.stageOf(node, def) !== Fields.STAGE.RIPE) return;
        const refreshed = CycleSavings.neverRunsOut(node.id, skill) || (!failed && CycleSavings.rollRefresh(node.id, skill));
        Fields.harvested(node, def, { overMs, refreshed });
        return;
    }

    const plan = Charges.planCycle(node.id, node, { recipe: null });
    const spends = plan.ok && plan.debits.length > 0;
    const refreshed = spends && (CycleSavings.neverRunsOut(node.id, skill) || (!failed && CycleSavings.rollRefresh(node.id, skill)));
    if (spends && !refreshed) Charges.commitPlan(plan);
    Respawn.restBeganEarlier(node, overMs);

    // A spot moves on by chance after each catch; a study counts as one. Last: it may leave the mat.
    if (!failed && spotOf(def) && BoardState.getTokenById(node.id)) FishingSpots.afterCatch(node, def);
}

/**
 * A studied Token transformed (a tree became its Stump, the Stump its tree again): every Laboratory
 * set to the old one follows it to the new one while it is still the same node kind, so the study
 * waits for the tree to grow back instead of asking for another node.
 */
export function followTransform({ fromId, fromTypeId, instanceId, typeId } = {}) {
    if (!fromId || !instanceId) return 0;
    const labs = Laboratories.laboratoriesStudying(fromId);
    if (!labs.length || Mastery.kindOfTypeId(fromTypeId) !== Mastery.kindOfTypeId(typeId)) return 0;
    for (const lab of labs) {
        lab.studies = instanceId;
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: lab.id, typeId: lab.typeId });
    }
    return labs.length;
}

let unsubscribers = [];

/** Follow transforms; `init` is idempotent across reloads and tests. */
export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_TRANSFORMED, followTransform));
}

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}
