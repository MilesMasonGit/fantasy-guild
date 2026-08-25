import React, { useCallback, useRef, useState } from 'react';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_GAP_PX, TILE_COUNT, colOf, rowOf, tileFootprint, isFootprintInBounds, isTileIndex } from '../../../config/boardGeometry.js';
import { closest2x2Anchor } from './boardConstants.js';
import { placeTokenFromDrag, announce } from './placeTokenFromDrag.js';
import { BoardTile } from './BoardTile.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { GameState } from '../../../state/GameState.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
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

export const Board = ({ onOpenGuildHall, onInspectToken, inspectSelection, onClearInspect }) => {
    const { EventBus } = useEngine();
    const dndContext = useDndContext();

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

    // One flat projection of the whole board.
    const tiles = useGameState(
        state => {
            const map = state.board?.tiles || {};
            const standing = state.board?.heroTiles || {};
            const vacancies = state.board?.vacancies || {};
            const heroes = state.heroes || [];
            const out = {};

            for (const key of Object.keys(map)) {
                const t = map[key];
                if (!t) continue;
                const def = getTokenType(t.typeId);
                const size = def?.size || 1;
                const anchorIndex = Number(key);
                const footprint = tileFootprint(anchorIndex, size);

                out[anchorIndex] = {
                    typeId: t.typeId,
                    usesRemaining: t.usesRemaining,
                    alert: t.alert || null,
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

            // A tile awaiting a restock its Manager cannot supply carries the alert itself
            for (const key of Object.keys(vacancies)) {
                if (!vacancies[key]?.unstocked) continue;
                out[key] = { ...(out[key] || { typeId: null, usesRemaining: null, size: 1, isAnchor: true, anchorTile: Number(key) }), alert: 'unstocked' };
            }

            for (const heroId of Object.keys(standing)) {
                const rawKey = Number(standing[heroId]);
                const hero = heroes.find(h => h.id === heroId);
                const targetKey = out[rawKey]?.anchorTile != null ? out[rawKey].anchorTile : rawKey;
                const key = String(targetKey);
                out[key] = {
                    ...(out[key] || { typeId: null, usesRemaining: null, alert: null, size: 1, isAnchor: true, anchorTile: targetKey }),
                    heroId,
                    heroName: hero?.name || 'Hero',
                    heroSprite: hero?.spriteId || hero?.classId || null
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

    const handleBurstMap = useCallback((mapId) => {
        const map = BoardState.removeBoardMap(mapId);
        if (!map) return;
        const origin = { x: map.x, y: map.y };
        const result = Cartographer.openMap({ typeId: map.typeId, usesRemaining: map.usesRemaining }, origin);
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

    const handlePlaceHero = useCallback((index, payload) => {
        if (!payload.heroId) return;
        announce(Placement.placeHero(payload.heroId, index));
    }, []);

    const handleRecallHero = useCallback((index) => {
        announce(Placement.recallHero(index));
    }, []);

    const handleReturnTokenToTray = useCallback((index) => {
        announce(Placement.returnTokenToTray(index));
    }, []);

    const handleAutoAssignHero = useCallback((index) => {
        const heroes = GameState.state?.heroes || [];
        const heroTiles = GameState.state?.board?.heroTiles || {};
        const idleHero = heroes.find(h => !heroTiles[h.id]);
        if (idleHero) {
            announce(Placement.placeHero(idleHero.id, index));
        } else if (heroes.length === 0) {
            NotificationSystem.warning('No heroes recruited yet');
        } else {
            NotificationSystem.info('All heroes are working on other tiles — drag a hero to reassign');
        }
    }, []);

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
            <div
                className="grid shrink-0"
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
                        heroName={tiles[i]?.heroName}
                        heroSprite={tiles[i]?.heroSprite}
                        isFootprintPreview={previewFootprint.includes(i)}
                        isPreviewValid={isPreviewValid}
                        onPlaceToken={handlePlaceToken}
                        onPlaceHero={handlePlaceHero}
                        onPickUp={handleRecallHero}
                        onReturnTokenToTray={handleReturnTokenToTray}
                        onOpenGuildHall={onOpenGuildHall}
                        onInspectToken={onInspectToken}
                        onClearInspect={onClearInspect}
                        onAutoAssignHero={handleAutoAssignHero}
                    />
                ))}
            </div>

            {/* Freely-sitting Map Tokens overtop the playmat */}
            {boardMaps.map(map => (
                <BoardMapToken key={map.id} map={map} onBurst={handleBurstMap} />
            ))}

            <SpriteLayerView />
            </div>
            </div>
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
