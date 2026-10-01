import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z } from './matLayers.js';
import { PixelArt } from '../base/TokenSprite.jsx';
import { lootSpriteMatPx } from '../../utils/lootFlight.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import { playLootArc, playAbsorptionSlide } from '../../utils/lootArc.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { useMatFit } from './MatFitContext.jsx';

/**
 * SpriteLayerView — item loot floating **above** the mat (D-40).
 *
 * An absolutely-positioned overlay over the mat and below the HUD.
 *
 * ## Loot has mass
 * Items pop out on an arc and **settle with a bounce** (UI §5).
 *
 * ## The gestures (UI §6, D-88, TL-9)
 * | Gesture | Result |
 * | :-- | :-- |
 * | Hover an item | Collected on the way in — banked, and flies to the **Guild Hall** (FB-16) |
 * | Click it | Same as hovering |
 *
 * ⭐ **Items only** since Token Lifecycle 9.3. Token loot (drag it onto the mat,
 * or hover or right-click it into the Token Vault) went with the Vault: a
 * Token a recipe makes now stands on the mat beside its station (TL-8).
 */
export const SpriteLayerView = () => {
    const mat = useMatSize();
    const sprites = useGameState(
        state => (state.board?.sprites || []).filter(s => s.kind !== 'token').map(s => ({
            id: s.id, kind: s.kind, refId: s.refId,
            quantity: s.quantity, x: s.x, y: s.y,
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
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.LOOT }}
        >
            {sprites.map(sprite => (
                <LootSprite key={sprite.id} sprite={sprite} allSprites={sprites} onCollect={collect} />
            ))}
        </div>
    );
};

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

/** One piece of item loot on the floor. */
const LootSprite = React.memo(function LootSprite({ sprite, allSprites = [], onCollect }) {
    const { isDragging: isAnyDragging } = useActiveDrag();
    const [isHovered, setIsHovered] = React.useState(false);
    const [isAbsorbingPulse, setIsAbsorbingPulse] = React.useState(false);
    const elementRef = React.useRef(null);
    const fit = useMatFit();

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

    const art = resolveSpritePath(getItem(sprite.refId) || sprite.refId);
    const label = getItem(sprite.refId)?.name || sprite.refId;
    // Items come from 32px art and render at half a Token's board scale; the
    // flight to the Hall draws at this same on-screen size (FB-17).
    const spriteSize = lootSpriteMatPx(fit);

    const handlePointerMove = () => {
        if (!elementRef.current) return;
        if (!isHovered) {
            setIsHovered(true);
            if (!isAnyDragging) onCollect(sprite.id);
        }
    };

    const handleClick = (e) => {
        e.stopPropagation();
        onCollect(sprite.id);
    };

    return (
        <button
            ref={elementRef}
            data-item-sprite="true"
            type="button"
            onClick={handleClick}
            onMouseEnter={() => {
                setIsHovered(true);
                if (!isAnyDragging) onCollect(sprite.id);
            }}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                'cursor-pointer pointer-events-auto'
            )}
            style={{
                left: sprite.x,
                top: sprite.y,
                width: spriteSize,
                height: spriteSize,
                borderRadius: '50%',
                zIndex: 50
            }}
        >
            <div
                className={cn(
                    'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                    isAbsorbingPulse && 'brightness-125 saturate-125'
                )}
            >
                <PixelArt src={art} alt={label} size={spriteSize} hovering />
            </div>
            {sprite.quantity > 1 && (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-black/85 text-[9px] font-bold text-white tabular-nums">
                    {sprite.quantity}
                </span>
            )}
        </button>
    );
});

export default SpriteLayerView;
