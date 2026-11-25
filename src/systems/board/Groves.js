// trees that belong to a Forest: whose a tree is, and an older save's trees joining one

import { GameState } from '../../state/GameState.js';
import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { ownerTypesOf } from '../../config/registries/tokenConstants.js';
import * as BoardState from './BoardState.js';
import { neighbourIds, distanceSq, centreOf } from './nearby.js';

/**
 * A tree belongs to the Forest that planted it, a fruit tree to its Orchard: `instance.tether` is
 * that owner's instance id, written by `SpawnerSystem` when it plants one, by a new Region's map for
 * its wild Forests (`atlas/wildForests.js`), and carried through every change of the tree (a Tree
 * to its Stump and back, `EffectActions.transformInstance`). What a tree needs to come back
 * (`needsNearby` on its Stump's growth or on its refill) is asked of its owner alone: a Stump
 * regrows only while its own Forest stands, wherever it stands, and never for another Forest of its
 * species. A demolished Forest's trees keep a tether to nothing, so their Stumps never regrow.
 *
 * ⚠️ A leaf for `Growth`, `Respawn` and `TimedChanges`: it must not import them.
 */

/** Whether `instance`'s owner is one of `typeIds`, standing on the mat; true when it needs none. */
export function ownGateMet(instance, typeIds) {
    if (!typeIds?.length) return true;
    const owner = typeof instance?.tether === 'string' ? BoardState.getTokenById(instance.tether) : null;
    return !!owner && typeIds.includes(owner.typeId);
}

/** Type id → the owner types it needs ({@link ownerTypesOf}), memoised on the registry's version. */
let owners = { version: -1, byType: new Map() };

function ownersOf(typeId) {
    const version = registryVersion();
    if (owners.version !== version) owners = { version, byType: new Map() };
    let list = owners.byType.get(typeId);
    if (!list) {
        list = ownerTypesOf(getTokenType(typeId), getTokenType);
        owners.byType.set(typeId, list);
    }
    return list;
}

/**
 * An older save's trees, Stumps and fruit trees join a Forest, once per board (`board.groveTethers`):
 * each one with no `tether` whose way back needs an owner takes the nearest Token of those types in
 * its reach (Near), as it would have regrown beside it, and one with none in reach belongs to none
 * (`tether: null`). The Starter Camp's trees join its Forest the same way on a new game's first tick.
 *
 * @returns {number} how many joined one (tests)
 */
export function attachUntethered() {
    const board = GameState.state?.board;
    if (!board || board.groveTethers === 1) return 0;
    let attached = 0;
    for (const t of BoardState.tokens()) {
        if ('tether' in t) continue;
        const types = ownersOf(t.typeId);
        if (!types.length) continue;
        const here = centreOf(t);
        let best = null;
        let bestD = Infinity;
        for (const id of neighbourIds(t.id)) {
            const other = BoardState.getTokenById(id);
            if (!other || !types.includes(other.typeId)) continue;
            const d = distanceSq(here, centreOf(other));
            if (d < bestD) { best = other; bestD = d; }
        }
        BoardState.setTether(t, best ? best.id : null);
        if (best) attached++;
    }
    board.groveTethers = 1;
    return attached;
}
