import React, { useCallback, useRef, useState } from 'react';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_GAP_PX, TILE_COUNT, colOf, rowOf, tileFootprint, isFootprintInBounds, isTileIndex, tileCentre } from '../../../config/boardGeometry.js';
import { closest2x2Anchor } from './boardConstants.js';
import { placeTokenFromDrag, announce } from './placeTokenFromDrag.js';
import { BoardTile } from './BoardTile.jsx';
import { FlagLayer } from './FlagLayer.jsx';
import { centreOf } from '../../../systems/board/nearby.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { GameState } from '../../../state/GameState.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { TerrainCanvas } from './TerrainCanvas.jsx';
import { TERRAIN_ENABLED } from '../../../config/registries/terrainRegistry.js';

/** Shared empty terrain, so a dormant board's selector returns a stable value. */
const NO_TERRAIN = Object.freeze({});
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { useDndContext } from '@dnd-kit/core';
import { cn } from '../../utils/cn.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { playLootArc } from '../../utils/lootArc.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import { bandStationRecipes } from '../../../systems/board/RecipeBands.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import { StationRecipeModal } from './StationRecipeModal.jsx';

/**
 * A hero dragged **from the Dock** (or the hero sheet) dropped on a tile:
 * plants their flag there (slice 1.5). The only drag that sends a hero out.
 */
export function dropHeroOnTile(index, payload) {
    if (!payload?.heroId) return null;
    return announce(Placement.placeHero(payload.heroId, index));
}

/**
 * A FLAG drag dropped on a tile — the flag itself, or a hero picked up on the
 * board, which drags their flag (FP-76): **moves the flag**, and the hero goes
 * to their next job by their rules.
 */
export function dropFlagOnTile(index, payload) {
    if (!payload?.heroId) return null;
    return announce(Placement.moveFlag(payload.heroId, index));
}

export const Board = ({ onOpenGuildHall, onInspectToken, onClearInspect, inspectedHeroId = null }) => {
    const { EventBus } = useEngine();
    const dndContext = useDndContext();

    // A hero hovered anywhere on the board — their pennant, their idle sprite
    // or their sprite on a Token — shows that flag's reach ring (FP-64).
    const [hoverHeroId, setHoverHeroId] = useState(null);

    // How much the 944px playmat is shrunk to fit this window (CR2-179).
    const fit = useBoardScale();
    const scaleRef = useRef(fit.scale);
    scaleRef.current = fit.scale;

    // Active drag preview footprint computation
    const activeDrag = dndContext?.active?.data?.current;
    const overId = dndContext?.over?.id;
    let previewFootprint = [];
    let isPreviewValid = false;

    if (activeDrag?.kind === DRAG_KIND.TOKEN && overId && String(overId).startsWith('tile-') && !String(overId).startsWith('tile-token-') && !String(overId).startsWith('tile-hero-')) {
        const rawIndex = Number(String(overId).replace('tile-', ''));
        if (isTileIndex(rawIndex)) {
            const size = getTokenType(activeDrag.typeId)?.size || 1;
            let anchorIndex = rawIndex;
            if (size === 2) {
                const pointer = dndContext?.active?.rect?.current?.translated;
                const originEl = typeof document !== 'undefined' ? document.querySelector('[data-board-origin]') : null;
                if (pointer && originEl) {
                    const r = originEl.getBoundingClientRect();
                    const footSpan = 2 * TILE_PX + TILE_GAP_PX;
                    const px = (pointer.left + footSpan / 2) - r.left;
                    const py = (pointer.top + footSpan / 2) - r.top;
                    anchorIndex = closest2x2Anchor(px, py);
                } else {
                    const row = Math.min(rowOf(rawIndex), BOARD_SIZE - 2);
                    const col = Math.min(colOf(rawIndex), BOARD_SIZE - 2);
                    anchorIndex = row * BOARD_SIZE + col;
                }
            }
            previewFootprint = tileFootprint(anchorIndex, size);
            isPreviewValid = isFootprintInBounds(anchorIndex, size);
        }
    }

    // A hero or pennant being dragged over a tile: the reach ring follows the
    // point the flag would be planted at — the Token's centre, else the tile's.
    let dragRing = null;
    if ((activeDrag?.kind === DRAG_KIND.HERO || activeDrag?.kind === DRAG_KIND.FLAG) && activeDrag.heroId
        && overId && /^tile-\d+$/.test(String(overId))) {
        const overTile = Number(String(overId).slice('tile-'.length));
        const occ = BoardState.getOccupyingToken(overTile);
        const point = (occ && centreOf(occ.instance)) || tileCentre(overTile);
        if (point) dragRing = { heroId: activeDrag.heroId, x: point.x, y: point.y };
    }

    // One flat projection of the whole board.
    const tiles = useGameState(
        state => {
            // STOPGAP (deleted in slice 1.6d): the grid is drawn from the tile
            // view over free positions (`gridShim.js`, via BoardState) until the
            // mat renderer replaces it in slice 1.6c.
            const heroes = state.heroes || [];
            const out = {};

            for (const [anchorIndex, t] of BoardState.occupiedTiles()) {
                if (!t) continue;
                const def = getTokenType(t.typeId);
                const size = def?.size || 1;
                const footprint = tileFootprint(anchorIndex, size);

                // A Token is a station because it carries a `Works as` skill
                // statement (R-14). That skill is also its recipe pool, so it
                // is the one flag the gear badge needs.
                const stationSkill = def ? stationSkillOf(def) : null;
                const recipe = stationSkill ? StationRecipe.selectedRecipe(t, def) : null;

                out[anchorIndex] = {
                    typeId: t.typeId,
                    instanceId: t.id || null,
                    // FP-35: the player marked it "heroes may not work this" (⊘, FPP-8).
                    disallowed: Flags.isDisallowed(t),
                    usesRemaining: t.usesRemaining,
                    alert: t.alert || null,
                    stationSkill,
                    recipe,
                    requiresHero: def ? (def.requiresHero !== false) : true,
                    size,
                    isAnchor: true,
                    anchorTile: anchorIndex,
                    footprint,
                    heroId: null,
                    heroName: null
                };

                if (size > 1) {
                    for (const subTile of footprint) {
                        if (subTile === anchorIndex) continue;
                        out[subTile] = {
                            typeId: t.typeId,
                            usesRemaining: t.usesRemaining,
                            alert: null,
                            requiresHero: def ? (def.requiresHero !== false) : true,
                            size,
                            isAnchor: false,
                            anchorTile: anchorIndex,
                            footprint,
                            heroId: null,
                            heroName: null
                        };
                    }
                }
            }

            // A tile awaiting a restock its Manager cannot supply carries the
            // alert itself. `ALERT.UNSTOCKED` is the same constant `Managers`
            // publishes and `ALERT_HINT` is keyed on (CR2-060) — this used to be
            // a third hand-written copy of the string.
            for (const [key, vacancy] of BoardState.vacancies()) {   // STOPGAP tile view — deleted in slice 1.6d
                if (!vacancy?.unstocked) continue;
                out[key] = { ...(out[key] || { typeId: null, usesRemaining: null, size: 1, isAnchor: true, anchorTile: Number(key) }), alert: ALERT.UNSTOCKED };
            }

            // Where each hero is DRAWN goes through the worker seam. A working
            // or waiting hero is drawn here, paired with their Token (D-266);
            // an IDLE hero is drawn small beside their flag by `FlagLayer`
            // (slice 1.5, FP-29), so is skipped. A working hero outranks a
            // waiting one on a shared tile, then planting order (FPP-6).
            const RANK = { working: 0, waiting: 1 };
            const drawn = {};
            for (const [heroId, displayTile] of BoardState.heroesOnBoard()) {
                if (displayTile == null) continue;
                const status = Flags.statusOf(heroId);
                const rank = RANK[status.state];
                if (rank == null) continue;
                const targetKey = out[displayTile]?.anchorTile != null ? out[displayTile].anchorTile : displayTile;
                const key = String(targetKey);
                if (drawn[key] != null && drawn[key] <= rank) continue;
                drawn[key] = rank;
                const hero = heroes.find(h => h.id === heroId);
                out[key] = {
                    ...(out[key] || { typeId: null, usesRemaining: null, alert: null, size: 1, isAnchor: true, anchorTile: targetKey }),
                    heroId,
                    heroName: hero?.name || 'Hero',
                    heroSprite: hero?.spriteId || hero?.classId || null,
                    // Not working productively: waiting for a restock, or on a
                    // Token that is stuck. Such a hero gets no glow — the stuck
                    // Token's red badge says it alone (slice 1.5, FP-29).
                    heroIdle: status.state !== 'working' || !!out[key]?.alert
                };
            }
            return out;
        },
        [
            BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.HERO_MOVED,
            BOARD_EVENTS.TOKEN_DEPLETED,
            BOARD_EVENTS.CYCLE_COMPLETE,
            BOARD_EVENTS.ALERT_CHANGED,
            'heroes_updated',
            'state_changed'
        ],
        null
    );

    const boardMaps = useGameState(
        state => state.board?.maps || [],
        ['state_changed', BOARD_EVENTS.TILE_CHANGED]
    );

    // The painted ground. Re-read on the same events as the tiles themselves,
    // because a Token arriving is exactly what repaints (D-T10) — there is no
    // separate "terrain changed" event and adding one would be a second source
    // of truth for the same moment.
    //
    // While terrain is dormant (FP-10) neither is read: a save that holds
    // terrain keeps it but shows none, and no seed is written into the save.
    const terrain = useGameState(
        state => (TERRAIN_ENABLED ? state.board?.terrain || NO_TERRAIN : NO_TERRAIN),
        ['state_changed', BOARD_EVENTS.TILE_CHANGED]
    );
    // The per-save seed left the board in slice 1.6a (terrain dormant, FP-10).
    const terrainSeed = 0;

    const handleBurstMap = useCallback((mapId) => {
        const map = BoardState.removeBoardMap(mapId);
        if (!map) return;
        const origin = { x: map.x, y: map.y };
        // Same announcer every other board outcome uses, so a refused burst
        // tells the player why instead of the Map just reappearing (CR2-170.1).
        const result = announce(Cartographer.openMap({ typeId: map.typeId, usesRemaining: map.usesRemaining }, origin));
        if (!result.success) {
            BoardState.addBoardMap(map.typeId, map.x, map.y, map.usesRemaining);
        }
        EventBus?.publish('state_changed', {});
    }, [EventBus]);

    // The whole of "a Token was dragged onto tile N" lives in
    // `placeTokenFromDrag`, which the Tray's mini-board calls too, so the two
    // surfaces cannot drift apart again (CR2-160).
    const handlePlaceToken = useCallback((index, payload, dropInfo) => {
        placeTokenFromDrag(index, payload, dropInfo, { scale: scaleRef.current });
    }, []);

    const handlePlaceHero = useCallback((index, payload) => { dropHeroOnTile(index, payload); }, []);

    // A flag, or a board hero (FP-76), dropped on a tile moves the flag.
    const handleMoveFlag = useCallback((index, payload) => { dropFlagOnTile(index, payload); }, []);

    const handleRecallHero = useCallback((index) => {
        announce(Placement.recallHero(index));
    }, []);

    const handleReturnTokenToTray = useCallback((index) => {
        announce(Placement.returnTokenToTray(index));
    }, []);

    const handleAutoAssignHero = useCallback((index) => {
        const heroes = GameState.state?.heroes || [];
        // A hero with no flag is in the Dock and free to send (Free Playmat
        // 1.4b). This also fixes the old truthiness slip that counted a hero
        // on tile 0 as free.
        const idleHero = heroes.find(h => !BoardState.flagOf(h.id));
        if (idleHero) {
            announce(Placement.placeHero(idleHero.id, index));
        } else if (heroes.length === 0) {
            NotificationSystem.warning('No heroes recruited yet');
        } else {
            NotificationSystem.info('All heroes are working on other tiles — drag a hero to reassign');
        }
    }, []);

    // Which station's recipe picker is open, as an anchor tile index. Kept here
    // rather than in the global inspect selection because the picker belongs to
    // one Token instance on one tile, not to a Token type.
    const [recipeTile, setRecipeTile] = useState(null);

    const handleOpenRecipes = useCallback((index) => setRecipeTile(index), []);
    const closeRecipes = useCallback(() => setRecipeTile(null), []);

    const recipeInstance = recipeTile != null ? BoardState.getToken(recipeTile) : null;   // STOPGAP tile lookup — deleted in slice 1.6d
    const recipeDef = recipeInstance ? getTokenType(recipeInstance.typeId) : null;
    const recipeBanding = recipeDef
        ? bandStationRecipes(recipeDef, tiles?.[recipeTile]?.heroId, GameState.state?.heroes || [])
        : null;

    const handleSelectRecipe = useCallback((recipeId) => {
        if (recipeTile == null) return;
        const instance = BoardState.getToken(recipeTile);   // STOPGAP tile lookup — deleted in slice 1.6d
        // `setSelectedRecipe` is the only writer of `selectedRecipeId`, and it
        // refuses any id outside this station's own pool (P2).
        if (!StationRecipe.setSelectedRecipe(instance, recipeId)) return;
        // The tile projection above re-runs on `state_changed`, which is what
        // repaints the gear badge's tooltip with the new recipe.
        EventBus?.publish('state_changed', {});
        setRecipeTile(null);
    }, [recipeTile, EventBus]);

    return (
        // `min-w-0` / `min-h-0` are load-bearing: without them this box grows to
        // its 944px content instead of reporting the space it actually has, and
        // the measurement below would always come back as "everything fits".
        <div
            ref={fit.ref}
            className="w-full h-full min-w-0 min-h-0 flex items-center justify-center p-8 overflow-hidden"
        >
            {/* Outer box reserves the board's ON-SCREEN size, so the surrounding
                layout centres the scaled board rather than the 944px one. */}
            <div className="relative shrink-0" style={{ width: fit.size, height: fit.size }}>
            <div
                data-board-origin
                className="relative shrink-0"
                style={{
                    width: BOARD_PX,
                    height: BOARD_PX,
                    transform: `scale(${fit.scale})`,
                    transformOrigin: 'top left'
                }}
            >
            {TERRAIN_ENABLED && <TerrainCanvas terrain={terrain} seed={terrainSeed} />}
            <div
                className="grid shrink-0 relative"
                style={{
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, ${TILE_PX}px)`,
                    gap: `${TILE_GAP_PX}px`,
                    width: BOARD_PX,
                    height: BOARD_PX,
                    imageRendering: 'pixelated'
                }}
            >
                {Array.from({ length: TILE_COUNT }, (_, i) => (
                    <BoardTile
                        key={i}
                        index={i}
                        token={tiles[i] || null}
                        hasTerrain={!!terrain[i]}
                        heroName={tiles[i]?.heroName}
                        heroSprite={tiles[i]?.heroSprite}
                        isFootprintPreview={previewFootprint.includes(i)}
                        isPreviewValid={isPreviewValid}
                        onPlaceToken={handlePlaceToken}
                        onPlaceHero={handlePlaceHero}
                        onMoveFlag={handleMoveFlag}
                        onHeroHover={setHoverHeroId}
                        onPickUp={handleRecallHero}
                        onReturnTokenToTray={handleReturnTokenToTray}
                        onOpenGuildHall={onOpenGuildHall}
                        onInspectToken={onInspectToken}
                        onClearInspect={onClearInspect}
                        onAutoAssignHero={handleAutoAssignHero}
                        onOpenRecipes={handleOpenRecipes}
                    />
                ))}
            </div>

            {/* Freely-sitting Map Tokens overtop the playmat */}
            {boardMaps.map(map => (
                <BoardMapToken key={map.id} map={map} onBurst={handleBurstMap} />
            ))}

            {/* Flags: pennants, idle heroes and reach rings (slice 1.5) */}
            <FlagLayer
                inspectedHeroId={inspectedHeroId}
                hoverHeroId={hoverHeroId}
                onHoverHero={setHoverHeroId}
                dragRing={dragRing}
            />

            <SpriteLayerView />
            </div>
            </div>

            {/* Mounted only while open. Left mounted, the modal keeps rendering
                after the picker closes — with no tile selected it has no
                station to describe, so it reads as an empty pool for a moment
                before Headless UI's leave transition retires it. */}
            {recipeTile != null && recipeDef && (
            <StationRecipeModal
                isOpen
                onClose={closeRecipes}
                tokenName={recipeInstance ? tokenName(recipeInstance.typeId) : null}
                banding={recipeBanding}
                selectedRecipeId={recipeInstance?.selectedRecipeId || null}
                onSelect={handleSelectRecipe}
            />
            )}
        </div>
    );
};


/** Freely placed Map token sitting overtop the playmat */
const BoardMapToken = ({ map, onBurst }) => {
    const [isHovered, setIsHovered] = useState(false);
    const elementRef = useRef(null);
    const { activePayload, isDragging: isAnyDragging } = useActiveDrag();
    const drag = useEntityDrag({
        id: `board-map-${map.id}`,
        kind: DRAG_KIND.TOKEN,
        payload: {
            typeId: map.typeId,
            from: { boardMapId: map.id },
            usesRemaining: map.usesRemaining
        },
        sourceSurface: DND_SURFACE.BOARD
    });

    const isThisDragging = drag.isDragging || (activePayload?.from?.boardMapId === map.id);

    React.useEffect(() => {
        if (Date.now() - (map.bornAt ?? 0) >= 1500 || map.fromX == null) return;
        const fx = map.fromX;
        const fy = map.fromY ?? 0;
        if (elementRef.current && (fx !== 0 || fy !== 0)) {
            playLootArc(elementRef.current, fx, fy, {
                centered: false,
                duration: 480
            });
        }
    }, [map.bornAt, map.fromX, map.fromY, map.x, map.y]);

    const setNodeRef = (node) => {
        elementRef.current = node;
        drag.setNodeRef(node);
    };

    const label = tokenName(map.typeId);

    const handlePointerMove = (e) => {
        const el = e.currentTarget;
        if (!el) return;
        const isOpaque = isElementOpaqueAtPoint(el, e.clientX, e.clientY);
        if (!isOpaque && isHovered) {
            setIsHovered(false);
        } else if (isOpaque && !isHovered) {
            setIsHovered(true);
        }
    };

    /**
     * ⚠️ **A Map bursts on a SINGLE click here too** — owner ruling 2026-08-24
     * (CR2-158): one click, Tray and board alike. `onDoubleClick` is wired to
     * the same function only so a double-click is not swallowed; its first
     * click has already burst the Map.
     */
    const handleClick = (e) => {
        const el = e.currentTarget;
        if (el && !isElementOpaqueAtPoint(el, e.clientX, e.clientY)) {
            return; // Transparent pixel: pass click to tile underneath
        }
        e.stopPropagation();
        onBurst?.(map.id);
    };

    return (
        <div
            ref={setNodeRef}
            {...drag.handleProps}
            data-board-map-id={map.id}
            data-alpha-test="true"
            onMouseEnter={() => setIsHovered(true)}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            onDoubleClick={handleClick}
            className={cn(
                'absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none',
                isThisDragging && 'opacity-0 pointer-events-none'
            )}
            style={{
                left: map.x,
                top: map.y,
                width: TILE_PX,
                height: TILE_PX,
                zIndex: 35,
                opacity: isThisDragging ? 0 : 1,
                visibility: isThisDragging ? 'hidden' : 'visible'
            }}
        >
            <div
                className={cn(
                    'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                    isHovered && !isAnyDragging && !isThisDragging && 'gi-token-hover-pulse'
                )}
            >
                <TokenSprite
                    typeId={map.typeId}
                    surface={TOKEN_SURFACE.BOARD}
                    alt={label}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
};

export default Board;
