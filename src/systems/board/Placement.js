// Fantasy Guild — Placement and displacement (7×7 Playmat rework, Phase 2)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { positionOf } from './nearby.js';
import * as Flags from './Flags.js';
import * as BoardCombat from './BoardCombat.js';
import * as BoardPromotion from './BoardPromotion.js';
import { isPlaceable, GUILD_HALL_TILE, TILE_PX, TILE_STEP_PX, colOf, rowOf, tileFootprint, isFootprintInBounds, BOARD_SIZE, quadrantPushVectors, getTilePushVectors, tileCentre, footprintCentre } from '../../config/boardGeometry.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import * as Restrictions from './Restrictions.js';
import * as StationRecipe from './StationRecipe.js';
import { QuestManager } from '../quests/QuestManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';

/** Wipe in-flight cycle progress. The forfeit in D-54 / D-131, in one place. */
function forfeitCycle(instance) {
    if (instance) instance.cycleElapsedMs = 0;
}

/**
 * Tell the board that the Tokens on some tiles changed — **one event per
 * change**, naming the mat points to rebuild around.
 *
 * ## Why one event with every point (Free Playmat 1.3, points since 1.6b)
 * The listener rebuilds every Token within Near (+ the largest art radius) of
 * any point (`TileModifiers.rebuildAround`). Naming the centre of **every tile
 * the change touched** — where Tokens left as well as where they landed —
 * covers a departed Token that differs from the one now standing there (a push,
 * a swap, a 2×2 cascade): any Token that covered a tile had its centre within
 * 113 u of that tile's centre, inside the 144 u margin.
 *
 * STOPGAP (deleted in 1.6d with the tile placement code): the points are tile
 * centres. `tile` stays in the payload for anything that only wants "where".
 */
function markAdjacencyDirty(indexOrFootprint) {
    const changed = Array.isArray(indexOrFootprint) ? indexOrFootprint : [indexOrFootprint];
    if (!changed.length) return;
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, {
        tile: changed[0],
        points: changed.map(tileCentre).filter(Boolean)
    });
}

/**
 * STOPGAP (deleted in 1.6d): the mat point a Token of `typeId` anchored at tile
 * `index` would stand at — what `Restrictions.checkPlacement` now takes.
 */
function pointAt(index, typeId) {
    return footprintCentre(index, getTokenType(typeId)?.size || 1);
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

/** Check if a token cannot be removed from the playmat once placed. */
export function isPermanentToken(typeId, instance) {
    if (typeId === 'token_guild_hall' || instance?.typeId === 'token_guild_hall') return true;
    const def = getTokenType(typeId || instance?.typeId);
    return !!(def?.cannotLeaveBoard || def?.isGuildHall);
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
        const hId = BoardState.workerOfTile(idx);
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

                if (footprint.includes(nextIndex)) {
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
            } else if (isPermanentToken(occ.instance?.typeId, occ.instance) && line.length > 0) {
                // If a permanent token (Guild Hall) is in the footprint and reaches an edge,
                // displace the far-end token to tray and shift the rest so Guild Hall stays on board!
                const edgeTile = line[line.length - 1];
                const edgeOcc = simTiles.get(edgeTile);
                if (edgeOcc && !isPermanentToken(edgeOcc.instance?.typeId, edgeOcc.instance)) {
                    trayDisplacements.push({ anchor: edgeTile, instance: edgeOcc.instance, heroId: edgeOcc.heroId });
                    simTiles.delete(edgeTile);
                    pathFound = { dir, line: line.slice(0, -1), emptyTile: edgeTile };
                    break;
                }
            }
        }

        if (pathFound) {
            const { line, emptyTile } = pathFound;
            for (let i = line.length - 1; i >= 0; i--) {
                const from = line[i];
                const to = (i === line.length - 1) ? emptyTile : line[i + 1];
                const moved = simTiles.get(from);
                if (moved) {
                    shifts.push({ fromTile: from, toTile: to, instance: moved.instance, heroId: moved.heroId });
                    simTiles.delete(from);
                    simTiles.set(to, { instance: moved.instance, heroId: moved.heroId, is2x2: false, anchor: to });
                }
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
 * @returns {{success: boolean, reason?: string, displacedToken?: object}}
 */
export function placeToken(index, instance) {
    if (!instance?.typeId) return refuse('Not a valid Token');
    const def = getTokenType(instance.typeId);

    // CR2-108c / CR2-044. Placement still goes ahead on the defaults below —
    // warn-only, per the owner's ruling — but a Token with no definition has no
    // size, no rules and no artwork, so it sits there doing nothing. That is
    // exactly what a Token whose id was renamed in the CMS looks like, and it
    // is how four starting Tokens went unnoticed.
    if (!def) {
        warnMissingContent('Placement', 'Token', instance.typeId,
            'the Token being placed has no rules, no artwork and will never do anything');
    }

    // A station arrives set to something (R-5) — the lowest-level recipe of its
    // pool, whoever is or is not standing on it. Done here rather than only
    // lazily in the resolver so the selection exists the moment the Token lands,
    // which is what P3's gear badge will read. A Token that already carries a
    // valid selection keeps it, so a move across the board or a trip through the
    // Tray does not silently reset the station.
    StationRecipe.ensureSelection(instance, def);

    const isMap = !!def?.mapId;
    const size = def?.size || 1;

    // Freely positioned Map Tokens sit overtop of the playmat (D-155)
    if (isMap) {
        const x = colOf(index) * TILE_PX;
        const y = rowOf(index) * TILE_PX;
        BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
        EventBus.publish('state_changed');
        return { success: true, displacedToken: null };
    }

    if (!isFootprintInBounds(index, size)) {
        return refuse('Token does not fit on the board');
    }

    const footprint = tileFootprint(index, size);

    // Check mythic uniqueness
    if (mythicAlreadyPlaced(instance.typeId, index) != null) {
        return refuse(`Only one ${tokenName(instance.typeId)} can be on the board at a time`);
    }

    // 2x2 Cascade Placement
    if (size === 2) {
        const { shifts, trayDisplacements } = planCascadeFor2x2(index);

        // Check Tray capacity for all tokens that overflow to the Tray.
        // `hasTraySpaceFor` is the one capacity rule (CR2-054); raw tray length
        // counted Maps, which do not occupy Tray capacity.
        if (!BoardState.hasTraySpaceFor(trayDisplacements.length)) {
            return refuse('No room in the Tray for the displaced Token(s)');
        }

        /**
         * `Cannot` — checked against the board **as the cascade would leave
         * it**, before a single Token has moved (design §6.1's third path).
         *
         * A 2×2 shoves its 1×1 neighbours sideways, which can push a fourth
         * Coast into contact with a Coast several tiles away that the player
         * never touched. Refusing the whole placement is strictly kinder than
         * completing the shove and then confiscating whatever it broke — and it
         * is the only version where nothing has to be rescued afterwards.
         */
        // STOPGAP plan (deleted in 1.6d): the cascade's tiles as ids and points.
        const cascadeCheck = Restrictions.checkPlacement(pointAt(index, instance.typeId), instance.typeId, {
            id: instance.id,
            remove: trayDisplacements.map(d => d.instance.id),
            move: shifts.map(s => ({ id: s.instance.id, ...tileCentre(s.toTile) }))
        });
        if (!cascadeCheck.ok) {
            const vName = tokenName(cascadeCheck.violatingTypeId) || tokenName(instance.typeId) || 'Token';
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                tile: index,
                severity: 'disallow',
                type: 'drop_rejected',
                name: vName,
                title: `Drop Rejected: ${vName}`,
                rulesText: cascadeCheck.rulesText || cascadeCheck.reason,
                message: `Drop Rejected: ${vName}`
            });
            return refuse(cascadeCheck.reason);
        }

        // Execute Tray displacements. A hero working a Token sent to the Tray
        // is not touched here: their claim finds the Token gone on the next
        // tick and their flag chooses again (Free Playmat 1.4b).
        let primaryDisplacedToken = null;
        for (const { anchor, instance: dispInst } of trayDisplacements) {
            forfeitCycle(dispInst);
            BoardState.addToTray(dispInst);
            BoardState.setToken(anchor, null);
            if (!primaryDisplacedToken) primaryDisplacedToken = dispInst;
        }

        // Execute token shifts along cascade paths (end of line to start). A
        // shifted Token keeps its hero: claims follow the instance (FP-68).
        const dirtyTiles = new Set(footprint);
        for (const { fromTile, toTile, instance: shiftedInst, heroId } of shifts) {
            BoardState.setToken(fromTile, null);
            BoardState.setToken(toTile, shiftedInst);
            BoardCombat.moveFight(fromTile, toTile);   // a shoved enemy keeps its HP (FPP-4)
            dirtyTiles.add(fromTile);
            dirtyTiles.add(toTile);

            if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: toTile, heroId });

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

        // Place the 2x2 token at anchor index
        forfeitCycle(instance);
        BoardState.setToken(index, instance);

        for (const t of footprint) {
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: instance.typeId });
        }
        EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: index, typeId: instance.typeId });
        markAdjacencyDirty(Array.from(dirtyTiles));
        EventBus.publish('state_changed');

        return { success: true, displacedToken: primaryDisplacedToken };
    }

    // 1x1 Standard Placement
    const occ = BoardState.getOccupyingToken(index);
    let displacedToken = null;

    /**
     * `Cannot` — the owner's ruling, on the same seam the one-Mythic rule uses.
     *
     * The refusal travels back as `{ success: false, reason }`, and every
     * caller in `Board.jsx`, `Tray.jsx` and `TrayMiniBoard.jsx` already returns
     * the Token to exactly where it came from and flashes the reason. So "flies
     * back to its last location, with a warning saying why" needed no new
     * machinery at all — only a new thing to say no about.
     *
     * Whatever this drop would displace to the Tray is subtracted first: the
     * Token being covered is on its way off the board, so it must not count
     * towards the newcomer's neighbours.
     */
    const check = Restrictions.checkPlacement(pointAt(index, instance.typeId), instance.typeId, {
        id: instance.id,
        remove: occ ? [occ.instance.id] : []
    });
    if (!check.ok) {
        const vName = tokenName(check.violatingTypeId) || tokenName(instance.typeId) || 'Token';
        EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            tile: index,
            severity: 'disallow',
            type: 'drop_rejected',
            name: vName,
            title: `Drop Rejected: ${vName}`,
            rulesText: check.rulesText || check.reason,
            message: `Drop Rejected: ${vName}`
        });
        return refuse(check.reason);
    }

    if (occ) {
        const occDef = getTokenType(occ.instance?.typeId);
        const occSize = occDef?.size || 1;
        const heroOnTile = BoardState.workerOfTile(occ.anchorIndex) || BoardState.workerOfTile(index);

        // Special behavior: Dropping a token onto a matching copy restocks its charges
        if (occ.instance.typeId === instance.typeId && occDef?.uses != null && occ.instance.usesRemaining != null && occ.instance.usesRemaining < occDef.uses) {
            const maxCap = occDef.uses;
            const needed = maxCap - occ.instance.usesRemaining;
            const available = instance.usesRemaining != null ? instance.usesRemaining : maxCap;
            const transferred = Math.min(needed, available);

            occ.instance.usesRemaining += transferred;
            instance.usesRemaining = available - transferred;

            const tName = tokenName(instance.typeId) || 'Token';
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                tile: occ.anchorIndex,
                severity: 'green',
                type: 'token_restocked',
                name: tName,
                title: `Restocked from ${tName}`,
                message: `Restocked from ${tName}`
            });

            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
                tile: occ.anchorIndex,
                delta: transferred,
                remaining: occ.instance.usesRemaining,
                typeId: occ.instance.typeId
            });

            EventBus.publish('token_restocked', {
                tile: occ.anchorIndex,
                typeId: instance.typeId,
                addedCharges: transferred,
                currentCharges: occ.instance.usesRemaining
            });
            EventBus.publish('audio:play', { clip: 'quest_claim' });
            EventBus.publish('state_changed');

            if (instance.usesRemaining === 0) {
                // Incoming token was completely absorbed into the on-board token
                return { success: true, restocked: true, absorbed: true, addedCharges: transferred };
            }

            // Leftover charges remain on the incoming token — push it to an adjacent cell or Tray
            let pushTarget = null;
            if (occSize === 1) {
                const pushVectors = getTilePushVectors(occ.anchorIndex);
                for (const vec of pushVectors) {
                    if (!vec) continue;
                    const nextRow = rowOf(occ.anchorIndex) + vec.dRow;
                    const nextCol = colOf(occ.anchorIndex) + vec.dCol;
                    if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) continue;
                    const nextIndex = nextRow * BOARD_SIZE + nextCol;
                    if (BoardState.getOccupyingToken(nextIndex)) continue;

                    const pushCheck = Restrictions.checkPlacement(pointAt(nextIndex, instance.typeId), instance.typeId, {
                        id: instance.id,
                        remove: []
                    });
                    if (pushCheck.ok) {
                        pushTarget = nextIndex;
                        break;
                    }
                }
            }

            if (pushTarget != null) {
                forfeitCycle(instance);
                BoardState.setToken(pushTarget, instance);
                EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: pushTarget, typeId: instance.typeId });
                EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: pushTarget, typeId: instance.typeId });
                EventBus.publish(BOARD_EVENTS.TILE_PUSHED, {
                    fromTile: occ.anchorIndex,
                    toTile: pushTarget,
                    instance
                });
                markAdjacencyDirty(pushTarget);
                EventBus.publish('state_changed');
                return { success: true, restocked: true, pushedLeftover: true, pushTarget, addedCharges: transferred };
            } else {
                if (!BoardState.hasTraySpace()) {
                    return refuse('No room in the Tray for the leftover Token');
                }
                forfeitCycle(instance);
                instance.isLanding = true;
                BoardState.addToTray(instance);

                const col = colOf(occ.anchorIndex);
                const row = rowOf(occ.anchorIndex);
                const x = col * TILE_STEP_PX + TILE_STEP_PX / 2;
                const y = row * TILE_STEP_PX + TILE_STEP_PX / 2;

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
                EventBus.publish('state_changed');
                return { success: true, restocked: true, trayLeftover: true, addedCharges: transferred };
            }
        }

        let pushTarget = null;
        if (occSize === 1) {
            const pushVectors = getTilePushVectors(occ.anchorIndex);
            for (const vec of pushVectors) {
                if (!vec) continue;
                const nextRow = rowOf(occ.anchorIndex) + vec.dRow;
                const nextCol = colOf(occ.anchorIndex) + vec.dCol;
                if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) continue;
                const nextIndex = nextRow * BOARD_SIZE + nextCol;
                if (BoardState.getOccupyingToken(nextIndex)) continue;

                const pushCheck = Restrictions.checkPlacement(pointAt(nextIndex, occ.instance.typeId), occ.instance.typeId, {
                    id: occ.instance.id,
                    remove: [occ.instance.id]
                });
                if (pushCheck.ok) {
                    pushTarget = nextIndex;
                    break;
                }
            }

            // If Guild Hall cannot find an empty adjacent tile, shove adjacent tokens along push vector
            if (pushTarget == null && isPermanentToken(occ.instance?.typeId, occ.instance)) {
                for (const vec of pushVectors) {
                    if (!vec) continue;
                    const nextRow = rowOf(occ.anchorIndex) + vec.dRow;
                    const nextCol = colOf(occ.anchorIndex) + vec.dCol;
                    if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) continue;
                    const nextIndex = nextRow * BOARD_SIZE + nextCol;
                    const nextOcc = BoardState.getOccupyingToken(nextIndex);
                    if (nextOcc && !isPermanentToken(nextOcc.instance?.typeId, nextOcc.instance)) {
                        const nextHero = BoardState.workerOfTile(nextOcc.anchorIndex);
                        let nextPushTarget = null;
                        const nextVectors = getTilePushVectors(nextIndex);
                        for (const nVec of nextVectors) {
                            const nRow = rowOf(nextIndex) + nVec.dRow;
                            const nCol = colOf(nextIndex) + nVec.dCol;
                            if (nRow < 0 || nRow >= BOARD_SIZE || nCol < 0 || nCol >= BOARD_SIZE) continue;
                            const nIdx = nRow * BOARD_SIZE + nCol;
                            if (nIdx !== occ.anchorIndex && !BoardState.getOccupyingToken(nIdx)) {
                                nextPushTarget = nIdx;
                                break;
                            }
                        }
                        if (nextPushTarget != null) {
                            forfeitCycle(nextOcc.instance);
                            BoardState.setToken(nextIndex, null);
                            BoardState.setToken(nextPushTarget, nextOcc.instance);
                            BoardCombat.moveFight(nextIndex, nextPushTarget);   // FPP-4
                            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: nextPushTarget, typeId: nextOcc.instance.typeId });
                            EventBus.publish(BOARD_EVENTS.TILE_PUSHED, { fromTile: nextIndex, toTile: nextPushTarget, instance: nextOcc.instance, heroId: nextHero });
                            // The pushed Token keeps its hero (claims follow the instance).
                            if (nextHero) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: nextPushTarget, heroId: nextHero });
                            markAdjacencyDirty(nextPushTarget);
                        } else {
                            // Off to the Tray: its hero's flag chooses again next tick.
                            forfeitCycle(nextOcc.instance);
                            nextOcc.instance.isLanding = true;
                            BoardState.addToTray(nextOcc.instance);
                            BoardState.setToken(nextIndex, null);
                            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: nextIndex, typeId: null });
                            markAdjacencyDirty(nextIndex);
                        }
                        pushTarget = nextIndex;
                        break;
                    }
                }
            }
        }

        if (pushTarget != null) {
            // Push covered token into adjacent empty cell. Its hero goes with
            // it: claims are keyed by the Token instance (Free Playmat 1.4b).
            forfeitCycle(occ.instance);
            BoardState.setToken(occ.anchorIndex, null);
            BoardState.setToken(pushTarget, occ.instance);
            BoardCombat.moveFight(occ.anchorIndex, pushTarget);   // FPP-4
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: pushTarget, typeId: occ.instance.typeId });
            EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: pushTarget, typeId: occ.instance.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_PUSHED, {
                fromTile: occ.anchorIndex,
                toTile: pushTarget,
                instance: occ.instance,
                heroId: heroOnTile
            });
            markAdjacencyDirty(pushTarget);

            if (heroOnTile) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: pushTarget, heroId: heroOnTile });
        } else {
            // No free adjacent cell available — return to Tray with particle fly
            if (!BoardState.hasTraySpace()) {
                return refuse('No room in the Tray for the displaced Token(s)');
            }

            displacedToken = occ.instance;
            forfeitCycle(displacedToken);
            displacedToken.isLanding = true;
            BoardState.addToTray(displacedToken);
            BoardState.setToken(occ.anchorIndex, null);

            const col = colOf(occ.anchorIndex);
            const row = rowOf(occ.anchorIndex);
            const x = col * TILE_STEP_PX + TILE_STEP_PX / 2;
            const y = row * TILE_STEP_PX + TILE_STEP_PX / 2;

            EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                kind: 'token',
                refId: displacedToken.typeId,
                quantity: 1,
                x,
                y,
                destination: 'tray',
                trayX: displacedToken.x,
                trayY: displacedToken.y,
                instanceId: displacedToken.id
            });

            // The hero who worked it keeps their flag; their claim finds the
            // Token gone on the next tick and they choose again (1.4b).
        }
    }

    forfeitCycle(instance);
    BoardState.setToken(index, instance);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: index, typeId: instance.typeId });
    markAdjacencyDirty(index);
    EventBus.publish('state_changed');

    return { success: true, displacedToken };
}

/**
 * Move a Token from one tile to another.
 *
 * ⭐ **A moved Token keeps its progress and carries its hero** (FP-68). The
 * hero's claim is keyed by the Token instance, so it follows on its own — even
 * outside their flag's radius — and this only has to stop `placeToken`'s
 * forfeit and say that the hero moved.
 */
export function moveToken(from, to) {
    if (from === to) return refuse('Already there');
    const occ = BoardState.getOccupyingToken(from);
    if (!occ) return refuse('No Token there');
    const moving = occ.instance;
    const fromAnchor = occ.anchorIndex;
    const progress = moving.cycleElapsedMs || 0;
    const heroId = BoardState.workerOfTile(fromAnchor);

    // Lifted off first: placing the Token can shove a neighbour (and its
    // fight) onto the tile this one is vacating (FPP-4).
    const fight = BoardCombat.detachFight(fromAnchor);

    BoardState.setToken(fromAnchor, null);

    const result = placeToken(to, moving);
    if (!result.success) {
        // Roll back
        BoardState.setToken(fromAnchor, moving);
        BoardCombat.attachFight(fight, fromAnchor);
        return result;
    }

    // Still on the board as itself (not absorbed into a matching copy, not
    // bounced to the Tray): it keeps the cycle it was part-way through — and an
    // enemy keeps its fight, so its HP (FPP-4). Gone from the board, the fight
    // against it is over.
    const landed = BoardState.findTokenById(moving.id);
    if (landed) {
        moving.cycleElapsedMs = progress;
        BoardCombat.attachFight(fight, landed.anchor);
    }

    for (const t of occ.footprint) {
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: null });
    }
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: BoardState.displayTileOf(heroId), heroId });
    markAdjacencyDirty(occ.footprint);
    return result;
}

/**
 * Lift a Token off the board and back into the Tray.
 */
export function returnTokenToTray(index, position = null) {
    const occ = BoardState.getOccupyingToken(index);
    if (!occ) return refuse('No Token there');
    if (isPermanentToken(occ.instance?.typeId, occ.instance)) {
        const tName = tokenName(occ.instance?.typeId) || 'Guild Hall';
        EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            tile: occ.anchorIndex,
            severity: 'disallow',
            type: 'drop_rejected',
            name: tName,
            title: 'Guild Hall cannot be removed from the playmat.',
            rulesText: null,
            message: 'Guild Hall cannot be removed from the playmat.'
        });
        return refuse('Guild Hall cannot be removed from the playmat.');
    }

    const instance = occ.instance;
    forfeitCycle(instance);
    if (position == null) {
        instance.isLanding = true;
    }
    if (!BoardState.addToTray(instance, undefined, position)) {
        return refuse('No room in the Tray');
    }

    // Asked before the Token leaves: afterwards nobody works that tile.
    const heroId = BoardState.workerOfTile(occ.anchorIndex);
    BoardState.setToken(occ.anchorIndex, null);

    if (position == null) {
        const col = colOf(occ.anchorIndex);
        const row = rowOf(occ.anchorIndex);
        const x = col * TILE_STEP_PX + TILE_STEP_PX / 2;
        const y = row * TILE_STEP_PX + TILE_STEP_PX / 2;

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
    }

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
    if (isPermanentToken(occ.instance?.typeId, occ.instance)) {
        const tName = tokenName(occ.instance?.typeId) || 'Guild Hall';
        EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            tile: occ.anchorIndex,
            severity: 'disallow',
            type: 'drop_rejected',
            name: tName,
            title: 'Guild Hall cannot be removed from the playmat.',
            rulesText: null,
            message: 'Guild Hall cannot be removed from the playmat.'
        });
        return refuse('Guild Hall cannot be removed from the playmat.');
    }

    if (!QuestManager.isTokenVaultSendUnlocked()) {
        return refuse('Token Vault storage unlocks after completing "Place a Dropped Token".');
    }

    const instance = occ.instance;
    if (getTokenType(instance.typeId)?.mapId) {
        return refuse('Maps cannot be stored — open it.');
    }

    // The Vault is where a station's recipe memory ends (concept §2.1). The
    // Vault stores a copy as charges alone, so this is belt and braces — but it
    // is also what makes the rule readable at the place it applies.
    forfeitCycle(instance);
    StationRecipe.clearSelection(instance);
    if (!TokenBank.deposit(instance)) {
        return refuse('No room in the Vault');
    }

    // Asked before the Token leaves: afterwards nobody works that tile.
    const heroId = BoardState.workerOfTile(occ.anchorIndex);
    BoardState.setToken(occ.anchorIndex, null);

    for (const t of occ.footprint) {
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: t, typeId: null });
    }
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: occ.anchorIndex, heroId });
    markAdjacencyDirty(occ.footprint);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
}

// ---------------------------------------------------------------------------
// Heroes — the bridge to flags (Free Playmat slice 1.4b)
// ---------------------------------------------------------------------------

/**
 * Drop a hero on a tile — plants their flag there.
 *
 * It plants the hero's flag at the centre of whatever is there (a 2×2 Token's
 * footprint centre) or the tile's own centre, and the flag chooses at once by
 * the hero's rules (FP-71). Dropping on a Token the hero can work therefore
 * works it unless a better-priority Token is runnable in range — within one
 * priority it is the nearest thing to the flag (FP-49, FP-72) — and otherwise
 * the hero works something else in range, or idles at the flag.
 *
 * ⚠️ **Nobody is displaced any more.** Two heroes can plant on one tile; only
 * one works the Token (FP-25). Passive Tokens no longer refuse a drop: the flag
 * simply finds nothing to work there.
 */
export function placeHero(heroId, index) {
    if (!heroId) return refuse('No hero');
    if (!isPlaceable(index)) {
        return refuse('Not a tile');
    }

    const occ = BoardState.getOccupyingToken(index);
    const point = positionOf(index);

    // `Flags.plant` announces `hero_deployed` itself, for every route (1.5).
    const planted = Flags.plant(heroId, point);
    if (!planted.success) return planted;
    if (planted.unchanged) return { success: true, workedTile: BoardState.workTileOf(heroId) };

    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, workedTile: BoardState.workTileOf(heroId) };
}

/**
 * Drag a pennant onto a tile — **move only the flag** (slice 1.5, FPP-15).
 *
 * On today's grid this lands exactly where dropping the hero would: it just
 * moves the flag's point, and the hero's rules decide the rest (FP-71). The
 * difference is that a pennant always belongs to a planted flag, so a hero in
 * the Dock cannot be sent out this way.
 */
export function moveFlag(heroId, index) {
    if (!heroId) return refuse('No hero');
    if (!BoardState.flagOf(heroId)) return refuse('That hero has no flag planted');
    return placeHero(heroId, index);
}

/**
 * Recall whoever is on a tile: the hero working its Token, else one waiting
 * there for a restock, else one whose flag is drawn there. Forfeits the cycle
 * (D-131, FP-68).
 */
export function recallHero(index) {
    const occ = BoardState.getOccupyingToken(index);
    const anchor = occ ? occ.anchorIndex : index;

    let heroId = BoardState.workerOfTile(anchor);
    if (heroId == null) {
        const onBoard = BoardState.heroesOnBoard();
        heroId = onBoard.find(([id, tile]) => BoardState.waitOfHero(id) && tile === anchor)?.[0]
            ?? onBoard.find(([, tile]) => tile === anchor || tile === index)?.[0]
            ?? null;
    }
    if (!heroId) return refuse('Nobody is standing on that tile');

    return recallHeroById(heroId);
}

/**
 * Take a hero's flag down and bring them to the Dock, by id.
 */
export function recallHeroById(heroId) {
    if (!heroId) return refuse('No hero');
    const tile = BoardState.displayTileOf(heroId);
    if (!Flags.furl(heroId, 'recall')) return { success: true, heroId };

    if (tile != null) {
        const col = colOf(tile);
        const row = rowOf(tile);
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'hero',
            refId: heroId,
            heroId,
            quantity: 1,
            x: col * TILE_STEP_PX + TILE_STEP_PX / 2,
            y: row * TILE_STEP_PX + TILE_STEP_PX / 2,
            destination: 'dock'
        });
    }

    EventBus.publish('heroes_updated', { source: 'board_recall' });
    EventBus.publish('state_changed');

    return { success: true, heroId };
}
