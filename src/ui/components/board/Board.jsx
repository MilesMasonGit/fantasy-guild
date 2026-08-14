import React, { useCallback, useState } from 'react';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_COUNT, colOf, rowOf } from './boardConstants.js';
import { BoardTile } from './BoardTile.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { ConnectionLines } from './ConnectionLines.jsx';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { cn } from '../../utils/cn.js';
import { TokenInspectPopup } from './TokenInspectPopup.jsx';

export const Board = ({ onOpenGuildHall, onInspectToken, inspectSelection, onClearInspect }) => {
    const { EventBus } = useEngine();
    // One flat projection of the whole board. Tiles are sparse, so this is
    // cheap on an early board and bounded at 48 on a full one.
    // ⚠️ Tokens and heroes are projected SEPARATELY, and both can exist without
    // the other. A hero standing on a bare tile is a real, visible state since
    // Phase 7 — it is what a depleted Token leaves behind (D-60) and what a
    // Manager restocks underneath (D-151) — so iterating only `tiles` would
    // make those people vanish from the board while still being on it.
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
                out[key] = {
                    typeId: t.typeId,
                    usesRemaining: t.usesRemaining,
                    alert: t.alert || null,
                    heroId: null,
                    heroName: null
                };
            }

            // A tile awaiting a restock its Manager cannot supply carries the
            // alert itself, with no Token to hang it on (D-133). The mark is the
            // ONLY cue that the Bank ran dry, which is what risk 15 turns on.
            for (const key of Object.keys(vacancies)) {
                if (!vacancies[key]?.unstocked) continue;
                out[key] = { ...(out[key] || { typeId: null, usesRemaining: null }), alert: 'unstocked' };
            }

            for (const heroId of Object.keys(standing)) {
                const key = String(standing[heroId]);
                const hero = heroes.find(h => h.id === heroId);
                out[key] = {
                    ...(out[key] || { typeId: null, usesRemaining: null, alert: null }),
                    heroId,
                    heroName: hero?.name || 'Hero',
                    // The portrait id, not a path: the tile resolves it, exactly as
                    // the Dock and the drag ghost do. `classId` is the fallback
                    // because `HeroGenerator` seeds `spriteId` from it, so an older
                    // save that predates portraits still draws a person rather than
                    // an empty tile (D-57 — the hero is the mark you scan for).
                    heroSprite: hero?.spriteId || hero?.classId || null
                };
            }
            return out;
        },
        [
            BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.HERO_MOVED,
            BOARD_EVENTS.TOKEN_DEPLETED,
            BOARD_EVENTS.ALERT_CHANGED,
            'heroes_updated',
            'state_changed'
        ],
        // ⚠️ Third argument is `eventFilter`, NOT a default value. Passing `{}`
        // or `[]` here is truthy, so the hook calls it as a function and every
        // subscription throws — the board then silently never updates.
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
        const result = Cartographer.openMap({ typeId: map.typeId, usesRemaining: map.usesRemaining }, null);
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
                x = col * TILE_PX;
                y = row * TILE_PX;
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
        if (payload.from?.boardMapId != null) {
            const instance = BoardState.removeBoardMap(payload.from.boardMapId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) BoardState.addBoardMap(instance.typeId, 0, 0, instance.usesRemaining);
            return;
        }
        if (payload.from?.tile != null) {
            announce(Placement.moveToken(payload.from.tile, index));
            return;
        }
        if (payload.from?.spriteId != null) {
            const instance = SpriteLayer.takeTokenSprite(payload.from.spriteId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) {
                SpriteLayer.addSprite('token', instance.typeId, 1, index, instance.usesRemaining);
            }
            return;
        }
        if (payload.from?.traySlot != null) {
            const instance = BoardState.takeFromTray(payload.from.traySlot);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            // Put it back exactly where it came from if the tile refused it
            if (!result.success) BoardState.addToTray(instance);
        }
    }, [EventBus]);

    const handlePlaceHero = useCallback((index, payload) => {
        if (!payload.heroId) return;
        announce(Placement.placeHero(payload.heroId, index));
    }, []);

    const handleRecallHero = useCallback((index) => {
        announce(Placement.recallHero(index));
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
                        onPlaceToken={handlePlaceToken}
                        onPlaceHero={handlePlaceHero}
                        onPickUp={handleRecallHero}
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
