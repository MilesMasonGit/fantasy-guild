import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { TILE_PX, TILE_GAP_PX, TILE_STEP_PX, GUILD_HALL_TILE, PAIR_OFFSET_PX, HERO_HIT_PX, colOf, rowOf } from './boardConstants.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TileProgressBar } from './TileProgressBar.jsx';
import { TokenSprite, PixelArt, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { ALERT } from '../../../systems/board/BoardRunner.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { Infinity as InfinityIcon } from 'lucide-react';

/**
 * TokenChargeBadge — shows remaining charges in the bottom-right of a token on hover.
 * Displays the full formatted number (or Infinity icon for unlimited tokens).
 * Smoothly shifts upward above the progress bar when cycling is active.
 * Hidden when not hovering or when dragging.
 */
export const TokenChargeBadge = ({ tile, usesRemaining, isDragging, isHovered }) => {
    const [localHover, setLocalHover] = useState(false);
    const [hasProgress, setHasProgress] = useState(false);

    useEffect(() => {
        if (!EventBus || tile == null) return;

        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => {
                if (p?.tile !== tile) return;
                const percent = Math.max(0, Math.min(100, p?.percent || 0));
                setHasProgress(percent > 0);
            }),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
                if (p?.tile === tile) setHasProgress(false);
            })
        ];
        return () => unsubs.forEach(u => u());
    }, [EventBus, tile]);

    if (isDragging) return null;

    const visible = isHovered || localHover;
    const isUnlimited = usesRemaining == null;
    const displayVal = isUnlimited ? null : Number(usesRemaining).toLocaleString();
    const titleText = isUnlimited ? 'Unlimited charges' : `${displayVal} charges remaining`;

    return (
        <div
            onMouseEnter={() => setLocalHover(true)}
            onMouseLeave={() => setLocalHover(false)}
            title={titleText}
            className={cn(
                "absolute right-1.5 z-30 pointer-events-auto",
                hasProgress ? "bottom-5" : "bottom-1.5",
                "flex items-center justify-center px-1.5 py-0.5 rounded",
                "bg-black/95 backdrop-blur-sm border border-yellow-400/50 shadow-[0_0_8px_rgba(234,179,8,0.25)]",
                "text-yellow-100 font-mono text-[10px] font-bold tabular-nums leading-none tracking-tight",
                "transition-all duration-150 ease-out cursor-default select-none",
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
        >
            {isUnlimited ? (
                <InfinityIcon size={12} className="shrink-0 text-yellow-300" />
            ) : (
                <span className="text-yellow-200">{displayVal}</span>
            )}
        </div>
    );
};
/**
 * TokenNameBadge — shows the token's name at the top of the token on hover.
 * Clean, outlined text with wrapping support across multiple lines.
 * Hidden when not hovering or when dragging.
 */
export const TokenNameBadge = ({ name, isDragging, isHovered }) => {
    if (!name || isDragging) return null;

    return (
        <div
            className={cn(
                "absolute top-1 left-1 right-1 z-30 pointer-events-none",
                "flex items-start justify-center text-center select-none",
                "transition-opacity duration-150 ease-out",
                isHovered ? "opacity-100" : "opacity-0"
            )}
        >
            <span
                className="text-[10px] font-bold text-white leading-tight tracking-tight px-1 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]"
                style={{
                    textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000'
                }}
            >
                {name}
            </span>
        </div>
    );
};

/**
 * What the red mark means, in the player's words. Hovering states exactly what
 * is wrong (D-114) — there is no aggregate supply dashboard, so diagnosis
 * happens tile by tile.
 */
const ALERT_HINT = {
    [ALERT.INPUTS]: 'Waiting for materials — nothing in the Bank or on the board',
    [ALERT.ACCESS]: 'This hero’s skill is too low to work this Token',
    [ALERT.UNSKILLED]: 'This hero doesn’t have the skill for this work — levelling won’t help',
    [ALERT.CONFLICT]: 'Two schematics beside this station want different things — remove one',
    [ALERT.NO_RECIPE]: 'Nothing beside this station tells it what to make',
    unstocked: 'This tile ran dry and the Vault has no replacement — restock it'
};

/** Floor sprites, cycled so the surface has texture rather than one flat tile. */
const FLOOR = [
    'pm_board_guild_hall_1', 'pm_board_guild_hall_2', 'pm_board_guild_hall_3',
    'pm_board_guild_hall_4', 'pm_board_guild_hall_5'
];
const floorFor = (i) => `/assets/playmat/tiles/${FLOOR[i % FLOOR.length]}.png`;

export const BoardTile = ({
    index,
    token,
    heroName,
    heroSprite,
    isFootprintPreview,
    isPreviewValid,
    onPlaceToken,
    onPlaceHero,
    onPickUp,
    onReturnTokenToTray,
    onOpenGuildHall,
    onInspectToken,
    onClearInspect,
    onHover
}) => {
    const isGuildHall = index === GUILD_HALL_TILE;

    const hasToken = !!token?.typeId;
    const isAnchor = token?.isAnchor !== false;
    const size = token?.size || 1;
    const anchorIndex = token?.anchorTile ?? index;

    const paired = hasToken && !!token?.heroId;
    const offset = (paired && size === 1) ? PAIR_OFFSET_PX : 0;

    const staffed = !!token?.heroId;
    const idle = staffed && (!hasToken || !!token.alert);
    const glow = !staffed ? null : idle ? 'gi-glow-idle' : 'gi-glow-active';

    const drag = useEntityDrag({
        id: `tile-token-${index}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: token?.typeId, from: { tile: anchorIndex } },
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !hasToken || isGuildHall
    });

    React.useEffect(() => {
        if (drag.isDragging) {
            onClearInspect?.();
        }
    }, [drag.isDragging, onClearInspect]);

    const drop = useEntityDrop({
        id: `tile-${index}`,
        surface: DND_SURFACE.BOARD,
        accepts: (p) => {
            if (isGuildHall) return false;
            if (p.kind === DRAG_KIND.TOKEN) return true;
            if (p.kind === DRAG_KIND.HERO) {
                return !hasToken || token?.requiresHero !== false;
            }
            return false;
        },
        onDrop: (p, info) => {
            if (p.kind === DRAG_KIND.TOKEN) onPlaceToken?.(index, p, info);
            else if (p.kind === DRAG_KIND.HERO) onPlaceHero?.(anchorIndex, p, info);
        },
        disabled: isGuildHall
    });

    const [landing, setLanding] = React.useState(false);
    React.useEffect(() => {
        if (!EventBus) return;
        let timer = null;
        const unsub = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
            if (p?.tile !== anchorIndex || !p?.typeId) return;
            setLanding(true);
            clearTimeout(timer);
            timer = setTimeout(() => setLanding(false), 400);
        });
        return () => { clearTimeout(timer); unsub(); };
    }, [EventBus, anchorIndex]);

    // Smooth slide animation when pushed by a 2x2 cascade
    const [pushTransform, setPushTransform] = React.useState(null);
    const [isPushing, setIsPushing] = React.useState(false);

    React.useEffect(() => {
        if (!EventBus) return;
        const unsub = EventBus.subscribe(BOARD_EVENTS.TILE_PUSHED, (p) => {
            if (p?.toTile !== anchorIndex) return;
            const dCol = colOf(p.fromTile) - colOf(p.toTile);
            const dRow = rowOf(p.fromTile) - rowOf(p.toTile);
            const startX = dCol * TILE_STEP_PX;
            const startY = dRow * TILE_STEP_PX;

            setPushTransform({ x: startX, y: startY });
            setIsPushing(false);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsPushing(true);
                    setPushTransform({ x: 0, y: 0 });
                });
            });
        });
        return () => unsub();
    }, [EventBus, anchorIndex]);

    React.useEffect(() => {
        if (!isPushing) return;
        const timer = setTimeout(() => {
            setIsPushing(false);
            setPushTransform(null);
        }, 260);
        return () => clearTimeout(timer);
    }, [isPushing]);

    const label = hasToken ? tokenName(token.typeId) : null;

    // Drop highlight styles (supports both single tile drop and 2x2 footprint preview)
    const showPreviewHighlight = isFootprintPreview;
    const previewRing = showPreviewHighlight
        ? (isPreviewValid ? 'ring-2 ring-inset ring-gi-success/80' : 'ring-2 ring-inset ring-gi-danger/80')
        : (drop.valid ? 'ring-2 ring-inset ring-gi-success/80' : (drop.invalid ? 'ring-2 ring-inset ring-gi-danger/80' : null));

    const tokenContainerTransform = pushTransform
        ? `translate(${pushTransform.x + offset}px, ${pushTransform.y}px)`
        : (offset ? `translateX(${offset}px)` : undefined);

    const tokenTransition = isPushing ? 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined;

    const [tileHovered, setTileHovered] = React.useState(false);

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (token?.heroId) {
            onPickUp?.(anchorIndex);
        } else if (hasToken && !isGuildHall) {
            onReturnTokenToTray?.(anchorIndex);
        }
    };

    // Worked/staffed tiles and hovered tiles are elevated so their shifted sprites render in front of adjacent tiles
    const tileZIndex = drag.isDragging ? 40
        : tileHovered ? 30
        : (staffed || paired) ? 20
        : (isAnchor && size > 1) ? 10
        : 1;

    return (
        <div
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            {...drop.droppableProps}
            {...(hasToken && !isGuildHall ? drag.handleProps : {})}
            onClick={
                isGuildHall ? () => onOpenGuildHall?.()
                    : undefined
            }
            onContextMenu={handleContextMenu}
            onDoubleClick={
                hasToken ? (e) => onInspectToken?.(token.typeId, e.currentTarget.getBoundingClientRect())
                    : undefined
            }
            onMouseEnter={() => { setTileHovered(true); onHover?.(anchorIndex); }}
            onMouseLeave={() => { setTileHovered(false); onHover?.(null); }}
            title={
                isGuildHall ? 'Guild Hall — click to open the upgrade tree'
                    : hasToken
                    ? `${label} — ${token.usesRemaining == null ? 'unlimited use' : `${token.usesRemaining} uses left`}`
                    : `Tile ${index}`
            }
            style={{
                width: TILE_PX,
                height: TILE_PX,
                backgroundImage: `url(${floorFor(index)})`,
                backgroundSize: 'cover',
                imageRendering: 'pixelated',
                zIndex: tileZIndex
            }}
            className={cn(
                'relative select-none',
                isGuildHall && 'cursor-pointer',
                hasToken && !isGuildHall && 'cursor-grab active:cursor-grabbing',
                previewRing,
                drag.isDragging && 'opacity-40'
            )}
        >
            {isGuildHall && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="text-[10px] font-bold tracking-wide text-white/80 text-center leading-tight">
                        GUILD<br />HALL
                    </span>
                </div>
            )}

            {hasToken && isAnchor && (
                <div
                    className={cn('absolute top-0 left-0 pointer-events-none', glow)}
                    style={{
                        width: size === 2 ? TILE_PX * 2 + TILE_GAP_PX : TILE_PX,
                        height: size === 2 ? TILE_PX * 2 + TILE_GAP_PX : TILE_PX,
                        zIndex: size === 2 ? 10 : undefined,
                        transform: tokenContainerTransform,
                        transition: tokenTransition
                    }}
                >
                    <TokenSprite
                        typeId={token.typeId}
                        surface={TOKEN_SURFACE.BOARD}
                        alt={label}
                        className={cn(
                            'absolute inset-0 m-auto pointer-events-auto',
                            landing && 'gi-token-land'
                        )}
                    />
                </div>
            )}

            {/* Working Hero Badge */}
            {token?.heroId && isAnchor && (
                <HeroBadge
                    index={anchorIndex}
                    heroId={token.heroId}
                    heroName={heroName}
                    heroSprite={heroSprite}
                    size={size}
                    offset={offset}
                    idle={idle}
                    glow={glow}
                    pushTransform={pushTransform}
                    isPushing={isPushing}
                    onPickUp={onPickUp}
                />
            )}

            {/* Centered Footprint Overlay Layer (Layered in front of token and hero) */}
            {hasToken && isAnchor && (
                <div
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{
                        width: size === 2 ? TILE_PX * 2 + TILE_GAP_PX : TILE_PX,
                        height: size === 2 ? TILE_PX * 2 + TILE_GAP_PX : TILE_PX,
                        zIndex: 25,
                        transform: pushTransform
                            ? `translate(${pushTransform.x}px, ${pushTransform.y}px)`
                            : undefined,
                        transition: tokenTransition
                    }}
                >
                    {/* Token Name at top of footprint on hover */}
                    <TokenNameBadge
                        name={label}
                        isDragging={drag.isDragging}
                        isHovered={tileHovered}
                    />

                    {/* Token Charges Badge in Bottom-Right (moves up above progress bar when cycling) */}
                    <TokenChargeBadge
                        tile={anchorIndex}
                        usesRemaining={token.usesRemaining}
                        isDragging={drag.isDragging}
                        isHovered={tileHovered}
                    />

                    {/* Cycle progress bar across bottom of token footprint (centered & in front of hero) */}
                    <TileProgressBar
                        tile={anchorIndex}
                        token={token}
                        isHovered={tileHovered}
                        alert={token?.alert}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * The hero standing on a Token: drag to redeploy, click to recall.
 */
const HeroBadge = ({ index, heroId, heroName, heroSprite, size = 1, offset, idle, glow, pushTransform, isPushing, onPickUp }) => {
    const drag = useEntityDrag({
        id: `tile-hero-${index}`,
        kind: DRAG_KIND.HERO,
        payload: { heroId, name: heroName, spriteId: heroSprite, from: { tile: index } },
        sourceSurface: DND_SURFACE.BOARD
    });

    const art = heroSprite ? resolveSpritePath(heroSprite) : null;
    const is2x = size === 2;
    const leftPos = is2x ? (TILE_PX - HERO_HIT_PX) / 2 : (TILE_PX - HERO_HIT_PX) / 2 - offset;
    const topPos = is2x ? TILE_STEP_PX : 0;

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            onClick={(e) => { e.stopPropagation(); onPickUp?.(index); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onPickUp?.(index); }}
            title={
                idle
                    ? `${heroName || 'Hero'} has nothing to do — move them, or restock this tile`
                    : `${heroName || 'Hero'} — drag to another tile, or click to recall`
            }
            style={{
                left: leftPos,
                top: topPos,
                width: HERO_HIT_PX,
                height: TILE_PX,
                zIndex: is2x ? 20 : undefined,
                transform: pushTransform ? `translate(${pushTransform.x}px, ${pushTransform.y}px)` : undefined,
                transition: isPushing ? 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined
            }}
            className={cn(
                'absolute pointer-events-auto',
                'cursor-grab active:cursor-grabbing',
                glow,
                drag.isDragging && 'opacity-40'
            )}
        >
            {art && (
                <PixelArt
                    src={art}
                    alt={heroName || 'Hero'}
                    size={TILE_PX}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                />
            )}
        </button>
    );
};

export default BoardTile;
