// Fantasy Guild — Placement and displacement (7×7 Playmat rework, Phase 2)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { neighboursOf, neighboursOfFootprint } from './adjacency.js';
import { isPlaceable, GUILD_HALL_TILE, TILE_PX, TILE_STEP_PX, colOf, rowOf, tileFootprint, isFootprintInBounds, BOARD_SIZE, quadrantPushVectors, getTilePushVectors } from '../../config/boardGeometry.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import * as Restrictions from './Restrictions.js';
import { QuestManager } from '../quests/QuestManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';

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
 * @returns {{success: boolean, reason?: string, displacedToken?: object, displacedHeroId?: string}}
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
        const cascadeCheck = Restrictions.checkPlacement(index, instance.typeId, {
            remove: trayDisplacements.map(d => d.anchor),
            shifts
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
        EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: index, typeId: instance.typeId });
        markAdjacencyDirty(Array.from(dirtyTiles));
        EventBus.publish('state_changed');

        return { success: true, displacedToken: primaryDisplacedToken, displacedHeroId: primaryDisplacedHeroId };
    }

    // 1x1 Standard Placement
    const occ = BoardState.getOccupyingToken(index);
    let displacedToken = null;
    let displacedHeroId = null;

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
    const check = Restrictions.checkPlacement(index, instance.typeId, {
        remove: occ ? [occ.anchorIndex] : []
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
        const heroOnTile = BoardState.heroOnTile(occ.anchorIndex) || BoardState.heroOnTile(index);

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

                    const pushCheck = Restrictions.checkPlacement(nextIndex, instance.typeId, {
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
                const currentTrayLength = BoardState.getTray().length;
                if (currentTrayLength + 1 > BoardState.TRAY_CAPACITY) {
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

                const pushCheck = Restrictions.checkPlacement(nextIndex, occ.instance.typeId, {
                    remove: [occ.anchorIndex]
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
                        const nextHero = BoardState.heroOnTile(nextOcc.anchorIndex);
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
                            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: nextPushTarget, typeId: nextOcc.instance.typeId });
                            EventBus.publish(BOARD_EVENTS.TILE_PUSHED, { fromTile: nextIndex, toTile: nextPushTarget, instance: nextOcc.instance, heroId: nextHero });
                            if (nextHero) {
                                BoardState.setHeroTile(nextHero, nextPushTarget);
                                EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: nextPushTarget, heroId: nextHero });
                            }
                            markAdjacencyDirty(nextPushTarget);
                        } else {
                            forfeitCycle(nextOcc.instance);
                            nextOcc.instance.isLanding = true;
                            BoardState.addToTray(nextOcc.instance);
                            BoardState.setToken(nextIndex, null);
                            if (nextHero) {
                                BoardState.setHeroTile(nextHero, null);
                                EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: nextHero });
                            }
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
            // Push covered token into adjacent empty cell
            forfeitCycle(occ.instance);
            BoardState.setToken(occ.anchorIndex, null);
            BoardState.setToken(pushTarget, occ.instance);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: pushTarget, typeId: occ.instance.typeId });
            EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: pushTarget, typeId: occ.instance.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_PUSHED, {
                fromTile: occ.anchorIndex,
                toTile: pushTarget,
                instance: occ.instance,
                heroId: heroOnTile
            });
            markAdjacencyDirty(pushTarget);

            if (heroOnTile) {
                BoardState.setHeroTile(heroOnTile, pushTarget);
                EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: pushTarget, heroId: heroOnTile });
            }
        } else {
            // No free adjacent cell available — return to Tray with particle fly
            const currentTrayLength = BoardState.getTray().length;
            if (currentTrayLength + 1 > BoardState.TRAY_CAPACITY) {
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

            if (heroOnTile) {
                BoardState.setHeroTile(heroOnTile, null);
                EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: heroOnTile });
                EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                    kind: 'hero',
                    refId: heroOnTile,
                    heroId: heroOnTile,
                    quantity: 1,
                    x,
                    y,
                    destination: 'dock'
                });
                displacedHeroId = heroOnTile;
            }
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
    EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { tile: index, typeId: instance.typeId });
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

    BoardState.setToken(occ.anchorIndex, null);
    const heroId = BoardState.heroOnTile(occ.anchorIndex);

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
        return refuse('Not a tile');
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
        }
    }

    // If another hero was standing here, push them to a nearby cell or return them to Dock
    const displacedHeroId = BoardState.heroOnTile(targetAnchor);
    let heroPushTarget = null;

    if (displacedHeroId) {
        const pushVectors = getTilePushVectors(targetAnchor);
        for (const vec of pushVectors) {
            if (!vec) continue;
            const nextRow = rowOf(targetAnchor) + vec.dRow;
            const nextCol = colOf(targetAnchor) + vec.dCol;
            if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) continue;
            const nextIndex = nextRow * BOARD_SIZE + nextCol;
            if (BoardState.heroOnTile(nextIndex)) continue;

            const nextOcc = BoardState.getOccupyingToken(nextIndex);
            if (nextOcc?.instance) {
                const nextDef = getTokenType(nextOcc.instance.typeId);
                if (nextDef?.requiresHero === false) continue;
            }

            heroPushTarget = nextIndex;
            break;
        }

        if (heroPushTarget != null) {
            // Push old hero to adjacent free cell
            BoardState.setHeroTile(displacedHeroId, heroPushTarget);
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: heroPushTarget, heroId: displacedHeroId });
            EventBus.publish(BOARD_EVENTS.TILE_PUSHED, {
                fromTile: targetAnchor,
                toTile: heroPushTarget,
                heroId: displacedHeroId
            });
            const nextOcc = BoardState.getOccupyingToken(heroPushTarget);
            if (nextOcc?.instance) {
                EventBus.publish('hero_deployed', { tile: heroPushTarget, heroId: displacedHeroId, typeId: nextOcc.instance.typeId });
            }
        } else {
            // No free adjacent cell available — return hero to Dock with particle fly
            BoardState.setHeroTile(displacedHeroId, null);
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: displacedHeroId });
            const col = colOf(targetAnchor);
            const row = rowOf(targetAnchor);
            const x = col * TILE_STEP_PX + TILE_STEP_PX / 2;
            const y = row * TILE_STEP_PX + TILE_STEP_PX / 2;
            EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                kind: 'hero',
                refId: displacedHeroId,
                heroId: displacedHeroId,
                quantity: 1,
                x,
                y,
                destination: 'dock'
            });
        }
    }

    if (target) forfeitCycle(target);
    BoardState.setHeroTile(heroId, targetAnchor);

    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: targetAnchor, heroId });
    if (target) {
        EventBus.publish('hero_deployed', { tile: targetAnchor, heroId, typeId: target.typeId });
    }
    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, displacedHeroId, heroPushTarget, workedTile: target ? targetAnchor : null };
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
    }

    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });

    const tileForCoord = heroActualTile != null ? heroActualTile : targetTile;
    const col = colOf(tileForCoord);
    const row = rowOf(tileForCoord);
    const x = col * TILE_STEP_PX + TILE_STEP_PX / 2;
    const y = row * TILE_STEP_PX + TILE_STEP_PX / 2;

    EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
        kind: 'hero',
        refId: heroId,
        heroId,
        quantity: 1,
        x,
        y,
        destination: 'dock'
    });

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

