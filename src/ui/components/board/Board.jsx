import React, { useCallback, useState } from 'react';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_COUNT } from './boardConstants.js';
import { BoardTile } from './BoardTile.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { ConnectionLines } from './ConnectionLines.jsx';
import * as Cartographer from '../../../systems/board/Cartographer.js';
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
 *
 * ## The scroll container's padding is clearance, not decoration
 * A staffed tile draws its hero and its Token as a spread pair that hangs
 * `PAIR_OFFSET_PX` past the grid on **both** sides (D-266). `p-8` is 32px, which
 * covers the 24px spill; the old `p-4` was 16px and would have clipped a hero on
 * column 0 — or summoned a scrollbar for the sake of it. If `PAIR_OFFSET_PX`
 * ever grows past 32, this has to grow with it.
 */
import { TokenInspectPopup } from './TokenInspectPopup.jsx';

export const Board = ({ onOpenGuildHall, onInspectToken, inspectSelection, onClearInspect }) => {
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

    /**
     * Tear a Map open where it sits (D-155). The Token is lifted off the tile
     * first so the scatter lands on a free square, and it is consumed either
     * way — a Map is a single burst, never a dispenser.
     */
    const handleBurstMap = useCallback((index) => {
        const instance = BoardState.getToken(index);
        if (!instance || !Cartographer.isMap(instance)) return;

        BoardState.setToken(index, null);
        const result = Cartographer.openMap(instance, index);
        if (result.success) {
            NotificationSystem.success(`Burst open — ${result.contents.length} things scattered!`);
        } else {
            BoardState.setToken(index, instance);   // never lose it to a failed open
        }
    }, []);

    // Connection lines are shown on hover ONLY (D-84). The board stays clean by
    // default; permanent lines across 48 Tokens would be the unreadable mess
    // that killed the previous spatial playmat.
    const [hoveredTile, setHoveredTile] = useState(null);

    return (
        <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
            {/* `relative` anchors the sprite overlay, which floats ABOVE the
                grid and occupies no tile (D-40).

                `data-board-origin` marks this element as **the** origin for
                board coordinates. The particle overlay converts a collected
                sprite's board position into screen space against it (D-236), and
                it needs an explicit marker rather than a structural guess — the
                first child of the scroll container is a different, larger box,
                so `> *` silently resolved to the wrong element. */}
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
                        onBurstMap={handleBurstMap}
                        onInspectToken={onInspectToken}
                        onClearInspect={onClearInspect}
                        onHover={setHoveredTile}
                    />
                ))}
            </div>
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

export default Board;
