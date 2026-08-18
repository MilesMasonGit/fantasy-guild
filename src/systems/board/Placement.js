// Fantasy Guild — Placement and displacement (7×7 Playmat rework, Phase 2)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { neighboursOf, neighboursOfFootprint } from './adjacency.js';
import { isPlaceable, isTileIndex, GUILD_HALL_TILE, TILE_PX, colOf, rowOf, tileFootprint, isFootprintInBounds, TILE_COUNT, BOARD_SIZE, quadrantPushVectors } from '../../ui/components/board/boardConstants.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import * as SpriteLayer from './SpriteLayer.js';

/** Wipe in-flight cycle progress. The forfeit in D-54 / D-131, in one place. */
function forfeitCycle(instance) {
    if (instance) instance.cycleElapsedMs = 0;
}

/**
 * Tell a tile and its neighbours that the neighbourhood changed.
 */
function markAdjacencyDirty(indexOrFootprint) {
    if (Array.isArray(indexOrFootprint)) {
        for (const t of indexOrFootprint) {
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: t });
        }
        for (const n of neighboursOfFootprint(indexOrFootprint)) {
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: n });
        }
        return;
    }
    const index = indexOrFootprint;
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: index });
    for (const n of neighboursOf(index)) {
        EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: n });
    }
}

/** Standard refusal shape, so callers can show the reason (UI §3). */
const refuse = (reason) => ({ success: false, reason });

/**
 * The tile already holding a Mythic of this type, or null (D-177).
 */
function mythicAlreadyPlaced(typeId, exceptAnchor) {
    if (getTokenType(typeId)?.rarity !== 'mythic') return null;
    for (const [index, instance] of BoardState.occupiedTiles()) {
        if (index !== exceptAnchor && instance.typeId === typeId) return index;
    }
    return null;
}

/**
 * Plans directional cascade pushing for 2x2 token placement.
 * Pushes 1x1 tokens outward in their quadrant direction into adjacent empty slots.
 * Falls back to secondary orthogonal axis, then to Tray displacement if blocked.
 */
function planCascadeFor2x2(anchorIndex) {
    const footprint = tileFootprint(anchorIndex, 2);
    const vectors = quadrantPushVectors(anchorIndex);

    // Simulated board state during planning
    const simTiles = new Map();
    for (const [idx, inst] of BoardState.occupiedTiles()) {
        const d = getTokenType(inst?.typeId);
        const sz = d?.size || 1;
        const hId = BoardState.heroOnTile(idx);
        simTiles.set(idx, { instance: inst, heroId: hId, is2x2: sz === 2, anchor: idx });
        if (sz === 2) {
            const fp = tileFootprint(idx, 2);
            for (const sub of fp) {
                if (sub !== idx) simTiles.set(sub, { instance: inst, heroId: null, is2x2: true, anchor: idx });
            }
        }
    }

    const shifts = []; // Array of { fromTile, toTile, instance, heroId }
    const trayDisplacements = []; // Array of { anchor, instance, heroId }
    const processedAnchors = new Set();

    for (const t of footprint) {
        if (!simTiles.has(t)) continue;
        const occ = simTiles.get(t);
        if (processedAnchors.has(occ.anchor)) continue;
        processedAnchors.add(occ.anchor);

        // Displace existing 2x2 tokens directly to Tray
        if (occ.is2x2) {
            trayDisplacements.push({ anchor: occ.anchor, instance: occ.instance, heroId: occ.heroId });
            const fp = tileFootprint(occ.anchor, 2);
            for (const sub of fp) simTiles.delete(sub);
            continue;
        }

        // 1x1 token: try cascading along primary then secondary quadrant push vectors
        const pushVec = vectors[t] || { primary: { dRow: -1, dCol: 0 }, secondary: { dRow: 0, dCol: -1 } };
        let pathFound = null;

        for (const dir of [pushVec.primary, pushVec.secondary]) {
            if (!dir) continue;
            const { dRow, dCol } = dir;
            const line = [t];
            let curr = t;
            let emptyTile = null;
            let blocked = false;

            while (true) {
                const nextRow = rowOf(curr) + dRow;
                const nextCol = colOf(curr) + dCol;

                if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) {
                    blocked = true;
                    break;
                }
                const nextIndex = nextRow * BOARD_SIZE + nextCol;

                if (nextIndex === GUILD_HALL_TILE || footprint.includes(nextIndex)) {
                    blocked = true;
                    break;
                }

                if (simTiles.has(nextIndex)) {
                    const nextOcc = simTiles.get(nextIndex);
                    if (nextOcc.is2x2) {
                        blocked = true;
                        break;
                    }
                    line.push(nextIndex);
                    curr = nextIndex;
                } else {
                    emptyTile = nextIndex;
                    break;
                }
            }

            if (!blocked && emptyTile != null) {
                pathFound = { dir, line, emptyTile };
                break;
            }
        }

        if (pathFound) {
            const { line, emptyTile } = pathFound;
            for (let i = line.length - 1; i >= 0; i--) {
                const from = line[i];
                const to = (i === line.length - 1) ? emptyTile : line[i + 1];
                const moved = simTiles.get(from);
                shifts.push({ fromTile: from, toTile: to, instance: moved.instance, heroId: moved.heroId });
                simTiles.delete(from);
                simTiles.set(to, { instance: moved.instance, heroId: moved.heroId, is2x2: false, anchor: to });
            }
        } else {
            trayDisplacements.push({ anchor: t, instance: occ.instance, heroId: occ.heroId });
            simTiles.delete(t);
        }
    }

    return { shifts, trayDisplacements };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Place a Token instance on a tile (or 2x2 anchor).
 *
 * @returns {{success: boolean, reason?: string, displacedToken?: object, displacedHeroId?: string}}
 */
export function placeToken(index, instance) {
    if (!instance?.typeId) return refuse('Not a valid Token');
    const def = getTokenType(instance.typeId);
    const isMap = !!def?.mapId;
    const size = def?.size || 1;

    // Freely positioned Map Tokens sit overtop of the playmat (D-155)
    if (isMap) {
        const x = colOf(index) * TILE_PX;
        const y = rowOf(index) * TILE_PX;
        BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
        EventBus.publish('state_changed');
        return { success: true, displacedToken: null, displacedHeroId: null };
    }

    if (!isFootprintInBounds(index, size)) {
        return refuse('Token does not fit on the board');
    }

    const footprint = tileFootprint(index, size);
    if (footprint.includes(GUILD_HALL_TILE)) {
        return refuse('The Guild Hall cannot be built on');
    }

    // Check mythic uniqueness
    if (mythicAlreadyPlaced(instance.typeId, index) != null) {
        return refuse(`Only one ${tokenName(instance.typeId)} can be on the board at a time`);
    }

    // 2x2 Cascade Placement
    if (size === 2) {
        const { shifts, trayDisplacements } = planCascadeFor2x2(index);

        // Check Tray capacity for all tokens that overflow to the Tray
        const currentTrayLength = BoardState.getTray().length;
        if (currentTrayLength + trayDisplacements.length > BoardState.TRAY_CAPACITY) {
            return refuse('No room in the Tray for the displaced Token(s)');
        }

        // Execute Tray displacements
        let primaryDisplacedToken = null;
        let primaryDisplacedHeroId = null;
        for (const { anchor, instance: dispInst, heroId } of trayDisplacements) {
            forfeitCycle(dispInst);
            BoardState.addToTray(dispInst);
            BoardState.setToken(anchor, null);
            if (heroId) {
                BoardState.setHeroTile(heroId, null);
                EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });
                if (!primaryDisplacedHeroId) primaryDisplacedHeroId = heroId;
            }
            if (!primaryDisplacedToken) primaryDisplacedToken = dispInst;
        }

        // Execute token shifts along cascade paths (end of line to start)
        const dirtyTiles = new Set(footprint);
        for (const { fromTile, toTile, instance: shiftedInst, heroId } of shifts) {
            BoardState.setToken(fromTile, null);
            BoardState.setToken(toTile, shiftedInst);
            dirtyTiles.add(fromTile);
            dirtyTiles.add(toTile);

            if (heroId) {
                BoardState.setHeroTile(heroId, toTile);
                EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: toTile, heroId });
            }

            EventBus.publish(BOARD_EVENTS.TILE_PUSHED, {
                fromTile,
                toTile,
                typeId: shiftedInst.typeId,
                heroId: heroId || null,
                durationMs: 250
            });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: toTile, typeId: shiftedInst.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: fromTile, typeId: null });
        }

        // Handle standing heroes on bare ground within the 2x2 footprint
        for (const t of footprint) {
            const standingHeroId = BoardState.heroOnTile(t);
            if (standingHeroId && t !== index) {
                if (def?.requiresHero !== false) {
                    BoardState.setHeroTile(standingHeroId, index);
                    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: index, heroId: standingHeroId });
                } else {
                    BoardState.setHeroTile(standingHeroId, null);
                    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: standingHeroId });
                    if (!primaryDisplacedHeroId) primaryDisplacedHeroId = standingHeroId;
                }
            }
        }

        // Place the 2x2 token at anchor index
        forfeitCycle(instance);
        BoardState.setToken(index, instance);

        for (const t of footprint) {
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: instance.typeId });
        }
        EventBus.publish('token_placed', { tile: index, typeId: instance.typeId });
        markAdjacencyDirty(Array.from(dirtyTiles));
        EventBus.publish('state_changed');

        return { success: true, displacedToken: primaryDisplacedToken, displacedHeroId: primaryDisplacedHeroId };
    }

    // 1x1 Standard Placement
    const occ = BoardState.getOccupyingToken(index);
    let displacedToken = null;
    let displacedHeroId = null;

    if (occ) {
        const currentTrayLength = BoardState.getTray().length;
        if (currentTrayLength + 1 > BoardState.TRAY_CAPACITY) {
            return refuse('No room in the Tray for the displaced Token(s)');
        }

        displacedToken = occ.instance;
        forfeitCycle(displacedToken);
        BoardState.addToTray(displacedToken);
        BoardState.setToken(occ.anchorIndex, null);

        const heroOnTile = BoardState.heroOnTile(occ.anchorIndex) || BoardState.heroOnTile(index);
        if (heroOnTile) {
            BoardState.setHeroTile(heroOnTile, null);
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: heroOnTile });
            displacedHeroId = heroOnTile;
        }
    } else {
        const standingHeroId = BoardState.heroOnTile(index);
        if (standingHeroId && def?.requiresHero === false) {
            BoardState.setHeroTile(standingHeroId, null);
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: standingHeroId });
            displacedHeroId = standingHeroId;
        }
    }

    forfeitCycle(instance);
    BoardState.setToken(index, instance);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: instance.typeId });
    EventBus.publish('token_placed', { tile: index, typeId: instance.typeId });
    markAdjacencyDirty(index);
    EventBus.publish('state_changed');

    return { success: true, displacedToken, displacedHeroId };
}

/**
 * Move a Token from one tile to another.
 */
export function moveToken(from, to) {
    if (from === to) return refuse('Already there');
    const occ = BoardState.getOccupyingToken(from);
    if (!occ) return refuse('No Token there');
    const moving = occ.instance;
    const fromAnchor = occ.anchorIndex;

    if (occ.footprint.includes(GUILD_HALL_TILE)) return refuse('The Guild Hall cannot be moved');

    const heroLeftBehind = BoardState.heroOnTile(fromAnchor) || BoardState.heroOnTile(from);

    BoardState.setToken(fromAnchor, null);

    const result = placeToken(to, moving);
    if (!result.success) {
        // Roll back
        BoardState.setToken(fromAnchor, moving);
        return result;
    }

    for (const t of occ.footprint) {
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: null });
        const heroLeft = BoardState.heroOnTile(t);
        if (heroLeft) {
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: t, heroId: heroLeft });
        }
    }
    markAdjacencyDirty(occ.footprint);
    return { ...result, heroLeftBehind };
}

/**
 * Lift a Token off the board and back into the Tray.
 */
export function returnTokenToTray(index, position = null) {
    const occ = BoardState.getOccupyingToken(index);
    if (!occ) return refuse('No Token there');
    if (occ.footprint.includes(GUILD_HALL_TILE)) return refuse('The Guild Hall cannot be removed');

    const instance = occ.instance;
    forfeitCycle(instance);
    instance.isLanding = true;
    if (!BoardState.addToTray(instance, undefined, position)) {
        return refuse('No room in the Tray');
    }

    BoardState.setToken(occ.anchorIndex, null);
    const heroId = BoardState.heroOnTile(occ.anchorIndex);

    const col = colOf(occ.anchorIndex);
    const row = rowOf(occ.anchorIndex);
    const x = col * 136 + 68;
    const y = row * 136 + 68;

    EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
        kind: 'token',
        refId: instance.typeId,
        quantity: 1,
        x,
        y,
        destination: 'tray',
        trayX: instance.x,
        trayY: instance.y,
        instanceId: instance.id
    });

    for (const t of occ.footprint) {
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: null });
    }
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: occ.anchorIndex, heroId });
    markAdjacencyDirty(occ.footprint);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
}

/**
 * Lift a Token off the board and deposit it straight into the Vault.
 */
export function returnTokenToVault(index) {
    const occ = BoardState.getOccupyingToken(index);
    if (!occ) return refuse('No Token there');
    if (occ.footprint.includes(GUILD_HALL_TILE)) return refuse('The Guild Hall cannot be removed');

    const instance = occ.instance;
    if (getTokenType(instance.typeId)?.mapId) {
        return refuse('Maps cannot be stored — open it.');
    }

    forfeitCycle(instance);
    if (!TokenBank.deposit(instance)) {
        return refuse('No room in the Vault');
    }

    BoardState.setToken(occ.anchorIndex, null);
    const heroId = BoardState.heroOnTile(occ.anchorIndex);

    for (const t of occ.footprint) {
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: null });
    }
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: occ.anchorIndex, heroId });
    markAdjacencyDirty(occ.footprint);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
}

// ---------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------

/**
 * Place a hero on a tile.
 */
export function placeHero(heroId, index) {
    if (!heroId) return refuse('No hero');
    if (!isPlaceable(index)) {
        return index === GUILD_HALL_TILE
            ? refuse('Nobody works the Guild Hall')
            : refuse('Not a tile');
    }

    const occ = BoardState.getOccupyingToken(index);
    const targetAnchor = occ ? occ.anchorIndex : index;
    const target = occ ? occ.instance : null;

    if (target) {
        const targetDef = getTokenType(target.typeId);
        if (targetDef && targetDef.requiresHero === false) {
            return refuse('This token operates passively and does not accept a hero');
        }
    }

    const previous = BoardState.tileOfHero(heroId);
    if (previous === targetAnchor) return { success: true, displacedHeroId: null };

    // Vacate wherever they were, forfeiting that cycle.
    if (previous != null) {
        const oldOcc = BoardState.getOccupyingToken(previous);
        if (oldOcc?.instance) {
            forfeitCycle(oldOcc.instance);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: oldOcc.anchorIndex, typeId: oldOcc.instance.typeId });
        }
    }

    // Whoever was standing here is knocked to the Dock
    const displacedHeroId = BoardState.heroOnTile(targetAnchor);
    if (displacedHeroId) BoardState.setHeroTile(displacedHeroId, null);

    if (target) forfeitCycle(target);
    BoardState.setHeroTile(heroId, targetAnchor);

    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: targetAnchor, heroId });
    if (target) {
        EventBus.publish('hero_deployed', { tile: targetAnchor, heroId, typeId: target.typeId });
    }
    if (displacedHeroId) {
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: displacedHeroId });
    }
    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, displacedHeroId, workedTile: target ? targetAnchor : null };
}

/** Take the hero off a tile and back to the Dock. Forfeits the cycle (D-131). */
export function recallHero(index) {
    const occ = BoardState.getOccupyingToken(index);
    const targetTile = occ ? occ.anchorIndex : index;

    const heroId = BoardState.heroOnTile(targetTile) || BoardState.heroOnTile(index);
    if (!heroId) return refuse('Nobody is standing on that tile');

    const heroActualTile = BoardState.tileOfHero(heroId);
    BoardState.setHeroTile(heroId, null);

    const instance = BoardState.getToken(heroActualTile);
    if (instance) {
        forfeitCycle(instance);
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: heroActualTile, typeId: instance.typeId });
    }

    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });
    EventBus.publish('heroes_updated', { source: 'board_recall' });
    EventBus.publish('state_changed');

    return { success: true, heroId };
}

/**
 * Take a hero off the board wherever they are, by id.
 */
export function recallHeroById(heroId) {
    const index = BoardState.tileOfHero(heroId);
    if (index == null) return { success: true, heroId };
    return recallHero(index);
}

