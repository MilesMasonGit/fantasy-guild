import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { BOARD_PX } from './boardConstants.js';
import { tokenName, tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';

/**
 * SpriteLayerView — loot floating **above** the grid (D-40).
 *
 * Sprites occupy no tile, which is why this is an absolutely-positioned overlay
 * rather than anything the grid knows about. It sits over the board and below
 * the HUD.
 *
 * ## Loot has mass
 * Items pop out on an arc and **settle with a bounce** (UI §5). That physicality
 * is not decoration: D-142 asks the Map burst to be the game's headline reward
 * beat, and a burst is only 3–6 things (D-167), so **the spectacle rests on
 * presentation, not volume**. If a four-item burst reads as flat in testing, the
 * lever is here first and quantity second.
 *
 * ## Two gestures, deliberately different (UI §6)
 * | Gesture | Result |
 * | :-- | :-- |
 * | Click a sprite | Collect it — item to the Bank, Token to the Tray (D-158) |
 * | Drag a Token sprite | Place it **straight onto a tile**, no trip through storage |
 *
 * The second is what makes opening a Map flow into building: burst, grab the two
 * things you want, put them down, let the rest tidy itself away.
 */
export const SpriteLayerView = () => {
    const sprites = useGameState(
        state => (state.board?.sprites || []).map(s => ({
            id: s.id, kind: s.kind, refId: s.refId,
            quantity: s.quantity, x: s.x, y: s.y,
            usesRemaining: s.usesRemaining
        })),
        [BOARD_EVENTS.SPRITES_CHANGED, 'state_changed'],
        // ⚠️ eventFilter, not a default value — see Board.jsx.
        null
    );

    const collect = useCallback((id) => { SpriteLayer.collectSprite(id); }, []);

    if (!sprites?.length) return null;

    return (
        <div
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, zIndex: 50 }}
        >
            {sprites.map(sprite => (
                <LootSprite key={sprite.id} sprite={sprite} onCollect={collect} />
            ))}
        </div>
    );
};

/** One piece of loot on the floor. */
const LootSprite = ({ sprite, onCollect }) => {
    const isToken = sprite.kind === 'token';

    // Only Tokens are draggable: an item's destination is never in doubt (it
    // goes to the Bank), but a Token might be wanted on a tile right now.
    const drag = useEntityDrag({
        id: `sprite-${sprite.id}`,
        kind: DRAG_KIND.TOKEN,
        payload: {
            typeId: sprite.refId,
            from: { spriteId: sprite.id },
            usesRemaining: sprite.usesRemaining
        },
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !isToken
    });

    const art = isToken
        ? tokenSpritePath(sprite.refId)
        : resolveSpritePath(getItem(sprite.refId) || sprite.refId);

    const label = isToken ? tokenName(sprite.refId) : (getItem(sprite.refId)?.name || sprite.refId);

    return (
        <button
            ref={isToken ? drag.setNodeRef : undefined}
            {...(isToken ? drag.handleProps : {})}
            type="button"
            onClick={(e) => { e.stopPropagation(); onCollect(sprite.id); }}
            title={
                isToken
                    ? `${label} — drag onto a tile, or click to send to the Tray`
                    : `${label} ×${sprite.quantity} — click to collect`
            }
            className={cn(
                'absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2',
                'flex items-center justify-center rounded',
                'gi-loot-drop',                       // arc-in + settle bounce
                isToken
                    ? 'cursor-grab active:cursor-grabbing ring-2 ring-gi-primary/70 bg-black/50'
                    : 'cursor-pointer hover:scale-110 transition-transform',
                drag.isDragging && 'opacity-40'
            )}
            style={{ left: sprite.x, top: sprite.y, width: isToken ? 44 : 32, height: isToken ? 44 : 32 }}
        >
            {art && (
                <img
                    src={art}
                    alt={label}
                    draggable={false}
                    className="pointer-events-none"
                    style={{ width: isToken ? 36 : 26, height: isToken ? 36 : 26, imageRendering: 'pixelated' }}
                />
            )}
            {/* Same-type items merge into counted stacks (UI §6), so the count
                matters more than the individual icon once a board is producing. */}
            {!isToken && sprite.quantity > 1 && (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-black/85 text-[9px] font-bold text-white tabular-nums">
                    {sprite.quantity}
                </span>
            )}
        </button>
    );
};

export default SpriteLayerView;
