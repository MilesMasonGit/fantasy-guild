import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { BOARD_PX } from './boardConstants.js';
import { PixelArt, tokenSizeFor, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { tokenName, tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import { playLootArc, playAbsorptionSlide } from '../../utils/lootArc.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { QuestManager } from '../../../systems/quests/QuestManager.js';

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
            fromX: s.fromX, fromY: s.fromY, bornAt: s.bornAt,
            targetStackId: s.targetStackId, absorbAt: s.absorbAt
        })),
        [BOARD_EVENTS.SPRITES_CHANGED, 'state_changed'],
        null
    );

    const collect = useCallback((id) => { SpriteLayer.collectSprite(id); }, []);

    if (!sprites?.length) return null;

    return (
        <div
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, zIndex: 80 }}
        >
            {sprites.map(sprite => (
                <LootSprite key={sprite.id} sprite={sprite} allSprites={sprites} onCollect={collect} />
            ))}
        </div>
    );
};

/**
 * Items come from a 32px source and render 2x (64px) on the floor.
 * Tokens render at full 128px (or 256px for 2x2) floor size via TOKEN_SURFACE.FLOOR.
 */
const FLOOR_ITEM_PX = 64;

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
const LootSprite = ({ sprite, allSprites = [], onCollect }) => {
    const isToken = sprite.kind === 'token';
    const { isDragging: isAnyDragging, activePayload } = useActiveDrag();
    const [isHovered, setIsHovered] = React.useState(false);
    const [isAbsorbingPulse, setIsAbsorbingPulse] = React.useState(false);
    const elementRef = React.useRef(null);

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

    const isThisDragging = isToken && (drag.isDragging || activePayload?.from?.spriteId === sprite.id);

    React.useEffect(() => {
        if (!justThrown(sprite)) return;
        const fx = Math.round((sprite.fromX ?? sprite.x) - sprite.x);
        const fy = Math.round((sprite.fromY ?? sprite.y) - sprite.y);
        if (elementRef.current && (fx !== 0 || fy !== 0)) {
            playLootArc(elementRef.current, fx, fy, { centered: true });
        }
    }, [sprite.fromX, sprite.fromY, sprite.x, sprite.y]);

    React.useEffect(() => {
        if (!sprite.targetStackId) return;
        const parent = allSprites.find(s => s.id === sprite.targetStackId);
        if (!parent) return;

        const elapsed = Date.now() - (sprite.bornAt ?? 0);
        const delay = Math.max(0, 800 - elapsed);

        const timer = setTimeout(() => {
            if (elementRef.current) {
                const dx = Math.round(parent.x - sprite.x);
                const dy = Math.round(parent.y - sprite.y);
                playAbsorptionSlide(elementRef.current, dx, dy, 300);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [sprite.targetStackId, sprite.bornAt, sprite.x, sprite.y, allSprites]);

    React.useEffect(() => {
        const unsub = EventBus.subscribe(BOARD_EVENTS.SPRITE_ABSORBED, (payload) => {
            if (payload?.parentId === sprite.id) {
                setIsAbsorbingPulse(true);
                setTimeout(() => setIsAbsorbingPulse(false), 400);
            }
        });
        return unsub;
    }, [sprite.id]);

    const setNodeRef = (node) => {
        elementRef.current = node;
        if (isToken) drag.setNodeRef(node);
    };

    const art = isToken
        ? tokenSpritePath(sprite.refId)
        : resolveSpritePath(getItem(sprite.refId) || sprite.refId);

    const label = isToken ? tokenName(sprite.refId) : (getItem(sprite.refId)?.name || sprite.refId);
    const spriteSize = isToken ? tokenSizeFor(TOKEN_SURFACE.FLOOR, sprite.refId) : FLOOR_ITEM_PX;

    const handlePointerMove = (e) => {
        if (!elementRef.current) return;
        const isOpaque = isElementOpaqueAtPoint(elementRef.current, e.clientX, e.clientY);
        if (!isOpaque && isHovered) {
            setIsHovered(false);
        } else if (isOpaque && !isHovered) {
            setIsHovered(true);
            if (!isToken && !isAnyDragging) onCollect(sprite.id);
        }
    };

    const handleClick = (e) => {
        if (elementRef.current && !isElementOpaqueAtPoint(elementRef.current, e.clientX, e.clientY)) {
            return;
        }
        if (isToken) {
            e.stopPropagation();
        } else {
            e.stopPropagation();
            onCollect(sprite.id);
        }
    };

    const handleContextMenu = (e) => {
        if (elementRef.current && !isElementOpaqueAtPoint(elementRef.current, e.clientX, e.clientY)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (isToken) {
            if (!QuestManager.isTokenVaultSendUnlocked()) {
                NotificationSystem.warning('Token Vault storage unlocks after completing "Place a Dropped Token".');
                return;
            }
            SpriteLayer.sendTokenToVault(sprite.id);
        }
    };

    return (
        <button
            ref={setNodeRef}
            {...(isToken ? drag.handleProps : {})}
            data-item-sprite={!isToken ? "true" : undefined}
            data-token-sprite={isToken ? "true" : undefined}
            data-alpha-test="true"
            type="button"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => {
                setIsHovered(true);
                if (!isToken && !isAnyDragging) onCollect(sprite.id);
            }}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                isToken ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                isThisDragging ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'
            )}
            style={{
                left: sprite.x,
                top: sprite.y,
                width: spriteSize,
                height: spriteSize,
                zIndex: 50,
                opacity: isThisDragging ? 0 : 1,
                visibility: isThisDragging ? 'hidden' : 'visible',
                pointerEvents: isThisDragging ? 'none' : 'auto'
            }}
        >
            <div
                className={cn(
                    'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                    isHovered && isToken && !isAnyDragging && !drag.isDragging && 'brightness-110',
                    isAbsorbingPulse && 'brightness-125 saturate-125'
                )}
            >
                <PixelArt src={art} alt={label} size={spriteSize} hovering />
            </div>
            {!isToken && sprite.quantity > 1 && (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-black/85 text-[9px] font-bold text-white tabular-nums">
                    {sprite.quantity}
                </span>
            )}
        </button>
    );
};

export default SpriteLayerView;
