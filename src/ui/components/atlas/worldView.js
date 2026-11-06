// what the world map shows, read from the world, the Atlas, the Bank and the heroes

import * as World from '../../../systems/world/World.js';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { cellMat } from '../../../systems/world/cellMat.js';
import { HALL_TYPE_ID } from '../../../systems/atlas/Layout.js';
import { worldTables } from '../../../config/registries/worldTablesRegistry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { tutorialTemplate } from '../../../systems/quests/tutorialQuests.js';
import { TUTORIAL_TEXT } from '../../../systems/quests/tutorialText.js';
import { shownRings, cellLook } from './worldMapLayout.js';

/**
 * The Token that stands on each cell's tile: the one its mat holds most of (`cellMat`), the Guild
 * Hall on the Hall's cell. A world never changes, so it is read once per world.
 */
const tokenCache = new WeakMap();
export function standingTokens(world) {
    if (!world) return new Map();
    const cached = tokenCache.get(world);
    if (cached) return cached;
    const tables = worldTables();
    const hall = world.cells.find(c => c.ring === 0);
    const hallOrigins = (hall?.origins || []).map(o => o.id);
    const skillOf = (typeId) => getTokenType(typeId)?.config?.skill || null;
    const out = new Map();
    for (const cell of world.cells) {
        if (cell.ring === 0) {
            out.set(cell.id, HALL_TYPE_ID);
            continue;
        }
        let best = null;
        try {
            for (const node of cellMat(cell, tables, { skillOf, hallOrigins }).nodes) {
                if (!best || node.count > best.count) best = node;
            }
        } catch {
            best = null;
        }
        out.set(cell.id, best?.typeId ?? null);
    }
    tokenCache.set(world, out);
    return out;
}

/**
 * The cartographer's words while the tutorial's last step stands on the mat unfinished (the one
 * that opened this map), or null.
 */
function cartographerNote() {
    const step = QuestTokens.tutorialTokens().map(t => t.quest).find(q => tutorialTemplate(q.id)?.opensWorld && !q.done);
    return step ? { speaker: TUTORIAL_TEXT.speaker, title: step.title, says: step.says, instruction: step.instruction } : null;
}

/**
 * Everything the world map shows about the world, read once per refresh: each cell with its state,
 * its look, its names, outputs and price against the Bank and the heroes now. Null with no world.
 *
 * A cell's `name` is the place's ("Elderfield": its Region's, which the player may have renamed,
 * or the name it will take); its `terrain` the kind of land and line ("Highland Ores"); its `lock`
 * the Guild Hall stars its ring waits for, or null (`World.ringLockOf`).
 */
export function worldView() {
    const world = World.currentWorld();
    if (!world) return null;
    const settled = World.settledCellIds(world);
    const states = World.cellStatesNow(world);
    const here = World.activeCellId();
    const tables = worldTables();
    const tokens = standingTokens(world);
    const rings = shownRings(world, states);
    const cells = world.cells.map(cell => {
        const regionId = settled.has(cell.id) ? World.regionIdOfCell(cell.id) : null;
        const region = regionId ? Atlas.getRegion(regionId) : null;
        const shaped = {
            id: cell.id,
            q: cell.q,
            r: cell.r,
            ring: cell.ring,
            wild: cell.wild,
            kit: cell.kit,
            name: region?.flavourName || World.placeName(cell),
            terrain: World.cellName(cell, tables),
            state: states.get(cell.id),
            here: cell.id === here,
            shown: cell.ring <= rings,
            outputs: World.outputsOf(cell),
            price: World.priceOf(cell),
            lock: settled.has(cell.id) ? null : World.ringLockOf(cell),
            token: tokens.get(cell.id) ?? null,
            regionId
        };
        shaped.look = cellLook(shaped, { ringOpen: () => !shaped.lock });
        return shaped;
    });
    return { seed: world.seed, world, rings, cells, here, note: cartographerNote() };
}
