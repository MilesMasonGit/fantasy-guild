import { useCallback, useState } from 'react';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_GAP_PX, TILE_STEP_PX, TILE_COUNT, colOf, rowOf, tileFootprint, isFootprintInBounds, isTileIndex, GUILD_HALL_TILE, closest2x2Anchor } from './boardConstants.js';
import { BoardTile } from './BoardTile.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { ConnectionLines } from './ConnectionLines.jsx';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { useDndContext } from '@dnd-kit/core';
import { cn } from '../../utils/cn.js';
import { TokenInspectPopup } from './TokenInspectPopup.jsx';

export const Board = ({ onOpenGuildHall, onInspectToken, inspectSelection, onClearInspect }) => {
    const { EventBus } = useEngine();
    const dndContext = useDndContext();

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
            isPreviewValid = isFootprintInBounds(anchorIndex, size) && !previewFootprint.includes(GUILD_HALL_TILE);
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

    /** Report a refusal rather than swallowing it — the player needs the reason. */
    const announce = (result) => {
        if (result && result.success === false && result.reason) {
            NotificationSystem.warning(result.reason);
        }
        return result;
    };

    const handleBurstMap = useCallback((mapId) => {
        const map = BoardState.removeBoardMap(mapId);
        if (!map) return;
        const origin = { x: map.x, y: map.y };
        const result = Cartographer.openMap({ typeId: map.typeId, usesRemaining: map.usesRemaining }, origin);
        if (result.success) {
            NotificationSystem.success(`Burst open — ${result.contents.length} things scattered!`);
        } else {
            BoardState.addBoardMap(map.typeId, map.x, map.y, map.usesRemaining);
        }
        EventBus?.publish('state_changed', {});
    }, [EventBus]);

    const handlePlaceToken = useCallback((index, payload, dropInfo) => {
        const isMap = !!getTokenType(payload?.typeId)?.mapId;

        // If it's a map, position it freely on the playmat without snapping to a grid cell!
        if (isMap) {
            let x = 0;
            let y = 0;
            const originEl = document.querySelector('[data-board-origin]');
            if (dropInfo?.pointer && originEl) {
                const r = originEl.getBoundingClientRect();
                x = Math.max(0, Math.min(BOARD_PX - TILE_PX, Math.round(dropInfo.pointer.x - r.left - TILE_PX / 2)));
                y = Math.max(0, Math.min(BOARD_PX - TILE_PX, Math.round(dropInfo.pointer.y - r.top - TILE_PX / 2)));
            } else {
                const col = colOf(index);
                const row = rowOf(index);
                x = col * TILE_STEP_PX;
                y = row * TILE_STEP_PX;
            }

            if (payload.from?.boardMapId != null) {
                BoardState.setBoardMapPosition(payload.from.boardMapId, x, y);
                EventBus?.publish('state_changed', {});
                return;
            }
            if (payload.from?.traySlot != null) {
                const instance = BoardState.takeFromTray(payload.from.traySlot);
                if (!instance) return;
                BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
                EventBus?.publish('state_changed', {});
                return;
            }
            if (payload.from?.tile != null) {
                const instance = BoardState.takeToken(payload.from.tile);
                if (!instance) return;
                BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
                EventBus?.publish('state_changed', {});
                return;
            }
            BoardState.addBoardMap(payload.typeId, x, y, payload.usesRemaining || 1);
            EventBus?.publish('state_changed', {});
            return;
        }

        // Regular playable tokens snap to grid tile
        let targetIndex = index;
        const size = getTokenType(payload?.typeId)?.size || 1;
        if (size === 2) {
            const originEl = typeof document !== 'undefined' ? document.querySelector('[data-board-origin]') : null;
            if (dropInfo?.pointer && originEl) {
                const r = originEl.getBoundingClientRect();
                const px = dropInfo.pointer.x - r.left;
                const py = dropInfo.pointer.y - r.top;
                targetIndex = closest2x2Anchor(px, py);
            } else {
                const row = Math.min(rowOf(index), BOARD_SIZE - 2);
                const col = Math.min(colOf(index), BOARD_SIZE - 2);
                targetIndex = row * BOARD_SIZE + col;
            }
        }

        if (payload.from?.boardMapId != null) {
            const instance = BoardState.removeBoardMap(payload.from.boardMapId);
            if (!instance) return;
            const result = announce(Placement.placeToken(targetIndex, instance));
            if (!result.success) BoardState.addBoardMap(instance.typeId, 0, 0, instance.usesRemaining);
            return;
        }
        if (payload.from?.tile != null) {
            announce(Placement.moveToken(payload.from.tile, targetIndex));
            return;
        }
        if (payload.from?.spriteId != null) {
            const instance = SpriteLayer.takeTokenSprite(payload.from.spriteId);
            if (!instance) return;
            const result = announce(Placement.placeToken(targetIndex, instance));
            if (!result.success) {
                SpriteLayer.addSprite('token', instance.typeId, 1, targetIndex, instance.usesRemaining);
            }
            return;
        }
        if (payload.from?.traySlot != null) {
            const instance = BoardState.takeFromTray(payload.from.traySlot);
            if (!instance) return;
            const result = announce(Placement.placeToken(targetIndex, instance));
            // Put it back exactly where it came from if the tile refused it
            if (!result.success) BoardState.addToTray(instance);
            return;
        }
        if (payload.from?.vaultTypeId != null) {
            const instance = TokenBank.withdraw(payload.from.vaultTypeId);
            if (!instance) return;
            const result = announce(Placement.placeToken(targetIndex, instance));
            if (!result.success) TokenBank.deposit(instance);
            return;
        }
        if (payload?.typeId) {
            const instance = BoardState.createTokenInstance(payload.typeId, payload.usesRemaining);
            announce(Placement.placeToken(targetIndex, instance));
        }
    }, [EventBus]);

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

    // Connection lines are shown on hover ONLY (D-84)
    const [hoveredTile, setHoveredTile] = useState(null);

    return (
        <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
            <div
                data-board-origin
                className="relative shrink-0"
                style={{ width: BOARD_PX, height: BOARD_PX }}
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
                        onHover={setHoveredTile}
                    />
                ))}
            </div>

            {/* Freely-sitting Map Tokens overtop the playmat */}
            {boardMaps.map(map => (
                <BoardMapToken key={map.id} map={map} onBurst={handleBurstMap} />
            ))}

            <ConnectionLines tile={hoveredTile} />
            <SpriteLayerView />
            {inspectSelection?.type === 'token' && inspectSelection?.source?.tile != null && (
                <TokenInspectPopup 
                    typeId={inspectSelection.id} 
                    tileIndex={inspectSelection.source.tile}
                    onClose={onClearInspect}
                />
            )}
            </div>
        </div>
    );
};


/** Freely placed Map token sitting overtop the playmat */
const BoardMapToken = ({ map, onBurst }) => {
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

    const label = tokenName(map.typeId);

    return (
        <div
            ref={drag.setNodeRef}
            {...drag.handleProps}
            onClick={(e) => {
                e.stopPropagation();
                onBurst?.(map.id);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onBurst?.(map.id);
            }}
            title={`${label} — Click to tear open, or drag to move/store`}
            className={cn(
                'absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none',
                'hover:scale-105 active:scale-95 transition-transform duration-100',
                drag.isDragging && 'opacity-40'
            )}
            style={{
                left: map.x,
                top: map.y,
                width: TILE_PX,
                height: TILE_PX,
                zIndex: 35
            }}
        >
            <TokenSprite
                typeId={map.typeId}
                surface={TOKEN_SURFACE.BOARD}
                alt={label}
                className="w-full h-full"
            />
        </div>
    );
};

export default Board;
