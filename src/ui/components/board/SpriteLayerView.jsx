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
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { useMatFit } from './MatFitContext.jsx';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { isDrawn } from '../../dev/perf/drawSwitches.js';

/**
 * SpriteLayerView: item loot floating **above** the mat. An absolutely-positioned overlay over
 * the mat and below the HUD.
 * Loot has mass: items pop out on an arc and **settle with a bounce**.
 * The gestures:
 * | Gesture | Result |
 * | :-- | :-- |
 * | Hover an item | Collected on the way in: banked, and flies to the **Guild Hall** |
 * | Click it | Same as hovering |
 * Items only: a Token a recipe makes stands on the mat beside its station.
 */
export const SpriteLayerView = () => {
    const mat = useMatSize();
    const sprites = useGameState(
        selectFloorLoot,
        [BOARD_EVENTS.SPRITES_CHANGED, ENGINE_EVENTS.STATE_CHANGED],
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
                <LootSprite key={sprite.id} {...sprite} onCollect={collect} />
            ))}
        </div>
    );
};

/**
 * The floor's loot as flat records of primitives, handed to each sprite as its own props.
 * ⚠️ Every field a sprite reads must be a primitive here, the stack it is sliding into
 * included (`parentX`/`parentY`): an object or the list itself would be new on every change
 * and redraw every sprite on the floor for one sprite's drop, pickup or count.
 */
function selectFloorLoot(state) {
    const list = (state.board?.sprites || []).filter(s => s.kind !== 'token');
    const byId = list.some(s => s.targetStackId) ? new Map(list.map(s => [s.id, s])) : null;
    return list.map(s => {
        const parent = s.targetStackId ? byId.get(s.targetStackId) : null;
        return {
            id: s.id, refId: s.refId, quantity: s.quantity,
            x: s.x, y: s.y, fromX: s.fromX, fromY: s.fromY, bornAt: s.bornAt,
            targetStackId: s.targetStackId ?? null,
            parentX: parent ? parent.x : null,
            parentY: parent ? parent.y : null
        };
    });
}

/**
 * Whether a drag is in flight anywhere. `DndKit` stamps `gi-dnd-active` on `<body>` for the
 * life of a drag. Reading it is what stops a Token being collected out from under a drag that
 * has already started: the pointer leaves the sprite on the very first movement, so without
 * this guard grabbing a Token would send it to storage instead.
 */
const isDragActive = () =>
    typeof document !== 'undefined' && document.body.classList.contains('gi-dnd-active');

/**
 * How long after a sprite is created its arc is still worth playing.
 * ⚠️ This is the guard that stops a loaded board re-throwing its entire floor. Sprites
 * persist, `fromX`/`fromY` with them, and every one of them mounts fresh on load, so without a
 * check on age, opening a save would fling every piece of loot across the mat at once.
 * `bornAt` already existed for the auto-collect clock; this reuses it rather than inventing
 * new state.
 * The same reasoning as the tile landing, which keys off the placement event.
 */
const THROW_WINDOW_MS = 1000;
const justThrown = (bornAt) => Date.now() - (bornAt ?? 0) < THROW_WINDOW_MS;

/**
 * One piece of item loot on the floor. Its props are its own record's primitives
 * (`selectFloorLoot`), so a change elsewhere on the floor leaves it alone.
 */
const LootSprite = React.memo(function LootSprite({
    id, refId, quantity, x, y, fromX, fromY, bornAt, targetStackId, parentX, parentY, onCollect
}) {
    const { isDragging: isAnyDragging } = useActiveDrag();
    const [isHovered, setIsHovered] = React.useState(false);
    const [isAbsorbingPulse, setIsAbsorbingPulse] = React.useState(false);
    const elementRef = React.useRef(null);
    const fit = useMatFit();

    React.useEffect(() => {
        if (!justThrown(bornAt) || !isDrawn('itemFlight')) return;
        const fx = Math.round((fromX ?? x) - x);
        const fy = Math.round((fromY ?? y) - y);
        if (elementRef.current && (fx !== 0 || fy !== 0)) {
            playLootArc(elementRef.current, fx, fy);
        }
    }, [fromX, fromY, x, y]);

    React.useEffect(() => {
        if (!targetStackId || parentX == null || parentY == null) return;

        const elapsed = Date.now() - (bornAt ?? 0);
        const delay = Math.max(0, 800 - elapsed);

        const timer = setTimeout(() => {
            if (elementRef.current && isDrawn('itemFlight')) {
                const dx = Math.round(parentX - x);
                const dy = Math.round(parentY - y);
                playAbsorptionSlide(elementRef.current, dx, dy, 300);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [targetStackId, bornAt, x, y, parentX, parentY]);

    React.useEffect(() => {
        const unsub = EventBus.subscribe(BOARD_EVENTS.SPRITE_ABSORBED, (payload) => {
            if (payload?.parentId === id) {
                setIsAbsorbingPulse(true);
                setTimeout(() => setIsAbsorbingPulse(false), 400);
            }
        }, UI_LISTENER);
        return unsub;
    }, [id]);

    const art = resolveSpritePath(getItem(refId) || refId);
    const label = getItem(refId)?.name || refId;
    // Items come from 32px art and render at half a Token's board scale; the flight to the
    // Hall draws at this same on-screen size.
    const spriteSize = lootSpriteMatPx(fit);

    const handlePointerMove = () => {
        if (!elementRef.current) return;
        if (!isHovered) {
            setIsHovered(true);
            if (!isAnyDragging) onCollect(id);
        }
    };

    const handleClick = (e) => {
        e.stopPropagation();
        onCollect(id);
    };

    return (
        <button
            ref={elementRef}
            data-item-sprite="true"
            type="button"
            onClick={handleClick}
            onMouseEnter={() => {
                setIsHovered(true);
                if (!isAnyDragging) onCollect(id);
            }}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                'cursor-pointer pointer-events-auto'
            )}
            style={{
                left: x,
                top: y,
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
            {quantity > 1 && (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-black/85 ui-text-body font-bold text-white tabular-nums">
                    {quantity}
                </span>
            )}
        </button>
    );
});

export default SpriteLayerView;
