// a world not yet played, as the world map draws it: the new-game screen's preview

import * as World from '../../../systems/world/World.js';
import { HALL_CELL, CELL_STATE } from '../../../systems/world/frontier.js';
import { STRICT_RINGS } from '../../../config/worldTablesShape.js';
import { worldTables } from '../../../config/registries/worldTablesRegistry.js';
import { CELL_LOOK } from './worldMapLayout.js';
import { standingTokens } from './worldView.js';

/**
 * What `WorldMap` draws for a world no game holds yet (`worldView`'s shape): the strict rings in
 * full colour round the Hall's cell, where the guild starts, and the rings past them in the fog, as
 * in play until the guild reaches them. Nothing here reads a game: there is none yet.
 *
 * @param {object} world a `generateWorld` result
 */
export function previewView(world) {
    const tables = worldTables();
    const tokens = standingTokens(world);
    const rings = Math.min(world.rings, STRICT_RINGS);
    const cells = world.cells.map(cell => ({
        id: cell.id,
        q: cell.q,
        r: cell.r,
        ring: cell.ring,
        wild: cell.wild,
        kit: cell.kit,
        name: World.placeName(cell),
        terrain: World.cellName(cell, tables),
        state: cell.id === HALL_CELL ? CELL_STATE.SETTLED : CELL_STATE.BEYOND,
        here: cell.id === HALL_CELL,
        shown: cell.ring <= rings,
        outputs: World.outputsOf(cell),
        price: null,
        token: tokens.get(cell.id) ?? null,
        regionId: null,
        // Every place lit: the screen shows what the world holds, not what the guild can reach.
        look: CELL_LOOK.SETTLED
    }));
    return { seed: world.seed, world, rings, cells, here: HALL_CELL, note: null };
}
