import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { BOARD_PX } from './boardConstants.js';
import { PixelArt, tokenSizeFor, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { tokenName, tokenSpritePath, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';

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
 * ## The gestures (UI §6, D-88, D-232)
 * | Gesture | Result |
 * | :-- | :-- |
 * | Hover an **item** | Collected on the way in — goes to the **Bank** |
 * | Hover a **Token** and move away | Collected on the way out — goes to the **Token Vault** |
 * | Click either | Same as hovering |
 * | Drag a Token | Place it **straight onto a tile**, no trip through storage |
 *
 * The last is what makes opening a Map flow into building: burst, grab the two
 * things you want, put them down, let the rest tidy itself away.
 *
 * ⚠️ **Tokens go to the Vault, not the Tray** (D-232, reversing D-158). Sending
 * them to the Tray filled the rack with things the player never chose; the Tray
 * now holds only what was put there deliberately. A **Map** is the exception and
 * needs no code here — `TokenBank.deposit` refuses it (D-156), so it falls
 * through to the Tray on its own.
 */
export const SpriteLayerView = () => {
    const sprites = useGameState(
        state => (state.board?.sprites || []).map(s => ({
            id: s.id, kind: s.kind, refId: s.refId,
            quantity: s.quantity, x: s.x, y: s.y,
            usesRemaining: s.usesRemaining,
            // ⚠️ Needed for the arc (D-235), and easy to miss: this projection is
            // a **flat copy**, not the live sprite (the selector contract at the
            // top of `useGameState` requires that). Anything the view reads has
            // to be listed here or it silently arrives as `undefined` — which is
            // exactly how the flight first shipped doing nothing at all.
            fromX: s.fromX, fromY: s.fromY, bornAt: s.bornAt
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

/**
 * Loose loot renders at the storage size (D-217) — one clean step down from a
 * placed Token, because it is not placed yet. Items come from a 32px source and
 * Tokens from a 64px one, so this is 2× and 1× respectively: both whole numbers.
 */
const FLOOR_PX = tokenSizeFor(TOKEN_SURFACE.FLOOR);

/**
 * Whether a drag is in flight anywhere.
 *
 * `DndKit` stamps `gi-dnd-active` on `<body>` for the life of a drag. Reading it
 * is what stops a Token being collected out from under a drag that has already
 * started — the pointer leaves the sprite on the very first movement, so without
 * this guard grabbing a Token would send it to storage instead.
 */
const isDragActive = () =>
    typeof document !== 'undefined' && document.body.classList.contains('gi-dnd-active');

/**
 * How long after a sprite is created its arc is still worth playing.
 *
 * ⚠️ **This is the guard that stops a loaded board re-throwing its entire
 * floor.** Sprites persist, `fromX`/`fromY` with them, and every one of them
 * mounts fresh on load — so without a check on age, opening a save would fling
 * forty pieces of loot across the grid at once. `bornAt` already existed for the
 * auto-collect clock; this reuses it rather than inventing new state.
 *
 * The same reasoning as the tile landing (D-230), which keys off the placement
 * event for exactly the same reason.
 */
const THROW_WINDOW_MS = 1000;
const justThrown = (sprite) => Date.now() - (sprite.bornAt ?? 0) < THROW_WINDOW_MS;

/** One piece of loot on the floor. */
const LootSprite = ({ sprite, onCollect }) => {
    const isToken = sprite.kind === 'token';

    // Decided once, on mount. Re-evaluating on render would let a re-render
    // mid-flight cancel the arc, and one after the window closes would strip the
    // class while the animation was still playing.
    const [flying] = React.useState(() => justThrown(sprite));

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
            /**
             * Hovering collects (D-88, UI §6) — it was specified from the start
             * and had simply never been built, so until now the only things
             * taking loot off the floor were a click and the auto-sweep.
             *
             * ⚠️ The two kinds collect on opposite edges of the hover:
             * An item is taken on enter; a Token is taken when you move away.
             */
            onMouseEnter={!isToken ? () => onCollect(sprite.id) : undefined}
            onMouseLeave={isToken ? () => { if (!isDragActive()) onCollect(sprite.id); } : undefined}
            title={
                isToken
                    ? `${label} — drag onto a tile, or move away to send it to the Vault`
                    : `${label} ×${sprite.quantity} — hover to collect`
            }
            className={cn(
                'absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                // Flies in along an arc from wherever it came from (D-235)
                flying && 'gi-loot-fly',
                isToken ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                drag.isDragging && 'opacity-40'
            )}
            style={{
                left: sprite.x,
                top: sprite.y,
                width: FLOOR_PX,
                height: FLOOR_PX,
                zIndex: 50,
                // The offset from the landing point BACK to the source
                ...(flying ? {
                    '--gi-fx': `${Math.round((sprite.fromX ?? sprite.x) - sprite.x)}px`,
                    '--gi-fy': `${Math.round((sprite.fromY ?? sprite.y) - sprite.y)}px`
                } : null)
            }}
        >
            <PixelArt src={art} alt={label} size={FLOOR_PX} hovering />
            {!isToken && sprite.quantity > 1 && (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-black/85 text-[9px] font-bold text-white tabular-nums">
                    {sprite.quantity}
                </span>
            )}
        </button>
    );
};

export default SpriteLayerView;
