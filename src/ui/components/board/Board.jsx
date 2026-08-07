import React, { useCallback } from 'react';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_COUNT } from './boardConstants.js';
import { BoardTile } from './BoardTile.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';

/**
 * Board — the 7×7 playmat, and the whole game (grid concept §2).
 *
 * **The board is the interface.** Placement *is* configuration: there is no
 * recipe menu and no assignment screen. To change what a station produces you
 * move a Token next to it; to change what a hero does you move the hero.
 *
 * ## Sizing (D-171)
 * 128px tiles — 32px art at 4× — giving an 896px board. Integer scaling is
 * **required, not preferred**: the art is pixel art and fractional scaling
 * blurs it. Everything comes from `boardConstants.js` so a later small mode is
 * a config change rather than a layout rewrite (roadmap G-20).
 *
 * ## Why this re-renders on so few events
 * Board state is mutated in place by `Placement.js` rather than replaced, so
 * this subscribes to the specific board events instead of a broad
 * `state_changed` — with up to 48 live tiles, a whole-board re-render on every
 * global event is the cascade the deck loop's area-scoped events existed to
 * avoid. Same discipline, new scope.
 */
export const Board = () => {
    // One flat projection of the whole board. Tiles are sparse, so this is
    // cheap on an early board and bounded at 48 on a full one.
    const tiles = useGameState(
        state => {
            const map = state.board?.tiles || {};
            const heroes = state.heroes || [];
            const out = {};
            for (const key of Object.keys(map)) {
                const t = map[key];
                if (!t) continue;
                out[key] = {
                    typeId: t.typeId,
                    usesRemaining: t.usesRemaining,
                    alert: t.alert || null,
                    heroId: t.heroId || null,
                    heroName: t.heroId
                        ? (heroes.find(h => h.id === t.heroId)?.name || 'Hero')
                        : null
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

    /** Report a refusal rather than swallowing it — the player needs the reason. */
    const announce = (result) => {
        if (result && result.success === false && result.reason) {
            NotificationSystem.warning(result.reason);
        }
        return result;
    };

    const handlePlaceToken = useCallback((index, payload) => {
        // Three sources, one drop. Every one of them is a single drag:
        //   tile   → a move
        //   tray   → a placement
        //   sprite → grab-and-place, straight off the floor onto a tile with no
        //            trip through storage (UI §6). This is what makes opening a
        //            Map flow directly into building.
        //
        // ⚠️ Tile 0 is falsy, so sources are tested with `!= null`.
        if (payload.from?.tile != null) {
            announce(Placement.moveToken(payload.from.tile, index));
            return;
        }
        if (payload.from?.spriteId != null) {
            const instance = SpriteLayer.takeTokenSprite(payload.from.spriteId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            // Refused: put it back on the floor rather than losing it. D-138's
            // rule holds on this path too.
            if (!result.success) {
                SpriteLayer.addSprite('token', instance.typeId, 1, index, instance.usesRemaining);
            }
            return;
        }
        if (payload.from?.traySlot != null) {
            const instance = BoardState.takeFromTray(payload.from.traySlot);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            // Put it back exactly where it came from if the tile refused it,
            // rather than leaving the player holding nothing.
            if (!result.success) BoardState.addToTray(instance);
        }
    }, []);

    const handlePlaceHero = useCallback((index, payload) => {
        if (!payload.heroId) return;
        announce(Placement.placeHero(payload.heroId, index));
    }, []);

    const handleRecallHero = useCallback((index) => {
        announce(Placement.recallHero(index));
    }, []);

    return (
        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
            {/* `relative` anchors the sprite overlay, which floats ABOVE the
                grid and occupies no tile (D-40). */}
            <div className="relative shrink-0" style={{ width: BOARD_PX, height: BOARD_PX }}>
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
                        onPlaceToken={handlePlaceToken}
                        onPlaceHero={handlePlaceHero}
                        onPickUp={handleRecallHero}
                    />
                ))}
            </div>
            <SpriteLayerView />
            </div>
        </div>
    );
};

export default Board;
