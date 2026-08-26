import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { TILE_PX, TILE_GAP_PX, TILE_STEP_PX, GUILD_HALL_TILE, colOf, rowOf } from '../../../config/boardGeometry.js';
import { PAIR_OFFSET_PX, HERO_HIT_PX, ALERT_HINT } from './boardConstants.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag, useEntityDrop, useActiveDrag, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TileProgressBar } from './TileProgressBar.jsx';
import { TileEventAlert } from './TileEventAlert.jsx';
import { TokenSprite, PixelArt, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { Infinity as InfinityIcon } from 'lucide-react';

/**
 * TokenChargeBadge — shows remaining charges in the bottom-right of a token on hover.
 * Displays the full formatted number (or Infinity icon for unlimited tokens).
 * Smoothly shifts upward above the progress bar when cycling is active.
 * Hidden when not hovering or when dragging.
 */
export const TokenChargeBadge = ({ tile, usesRemaining, isDragging, isHovered, hasHero = false, alert = null }) => {
    const [localHover, setLocalHover] = useState(false);
    const [eventAlert, setEventAlert] = useState(alert);
    const [heroStationed, setHeroStationed] = useState(hasHero);

    useEffect(() => {
        setHeroStationed(hasHero);
    }, [hasHero]);

    useEffect(() => {
        setEventAlert(alert);
    }, [alert]);

    useEffect(() => {
        if (!EventBus || tile == null) return;

        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => {
                if (p?.tile === tile) {
                    setHeroStationed(!!p?.heroId);
                } else if (p?.from === tile) {
                    setHeroStationed(false);
                }
            }),
            EventBus.subscribe(BOARD_EVENTS.ALERT_CHANGED, (p) => {
                if (p?.tile === tile) {
                    setEventAlert(p?.alert || null);
                }
            }),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
                if (p?.tile === tile) {
                    setEventAlert(null);
                }
            })
        ];
        return () => unsubs.forEach(u => u());
    }, [EventBus, tile]);

    if (isDragging) return null;

    const visible = isHovered || localHover;
    const isUnlimited = usesRemaining == null;
    const displayVal = isUnlimited ? null : Number(usesRemaining).toLocaleString();
    const titleText = isUnlimited ? 'Unlimited charges' : `${displayVal} charges remaining`;
    const hasProgress = heroStationed || !!eventAlert;

    return (
        <div
            onMouseEnter={() => setLocalHover(true)}
            onMouseLeave={() => setLocalHover(false)}
            aria-label={titleText}
            className={cn(
                "absolute right-1.5 z-30 pointer-events-auto",
                hasProgress ? "bottom-5" : "bottom-1.5",
                "flex items-center justify-center px-1.5 py-0.5 rounded",
                "bg-black/95 backdrop-blur-sm border border-gi-gold/50 shadow-[0_0_8px_rgba(251,191,36,0.25)]",
                "text-gi-gold font-mono text-[10px] font-bold tabular-nums leading-none tracking-tight",
                "transition-all duration-150 ease-out cursor-default select-none",
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
        >
            {isUnlimited ? (
                <InfinityIcon size={12} className="shrink-0 text-gi-gold" />
            ) : (
                <span className="text-gi-gold">{displayVal}</span>
            )}
        </div>
    );
};

/**
 * TokenChargeDeltaFloater — displays floating numbers (-1, +50) when charges change on a token.
 * Positioned in the bottom-right right above where the charge badge resides.
 */
export const TokenChargeDeltaFloater = ({ tile, hasHero = false, alert = null }) => {
    const [eventAlert, setEventAlert] = useState(alert);
    const [heroStationed, setHeroStationed] = useState(hasHero);
    const [deltas, setDeltas] = useState([]);

    useEffect(() => {
        setHeroStationed(hasHero);
    }, [hasHero]);

    useEffect(() => {
        setEventAlert(alert);
    }, [alert]);

    useEffect(() => {
        if (!EventBus || tile == null) return;

        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => {
                if (p?.tile === tile) {
                    setHeroStationed(!!p?.heroId);
                } else if (p?.from === tile) {
                    setHeroStationed(false);
                }
            }),
            EventBus.subscribe(BOARD_EVENTS.ALERT_CHANGED, (p) => {
                if (p?.tile === tile) {
                    setEventAlert(p?.alert || null);
                }
            }),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
                if (p?.tile === tile) {
                    setEventAlert(null);
                }
            }),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (p) => {
                if (p?.tile !== tile || p?.delta == null || p?.delta === 0) return;
                const id = Math.random().toString(36).slice(2);
                setDeltas(prev => [...prev, { id, delta: p.delta }]);
                setTimeout(() => {
                    setDeltas(prev => prev.filter(d => d.id !== id));
                }, 3000);
            })
        ];
        return () => unsubs.forEach(u => u());
    }, [EventBus, tile]);

    if (!deltas.length) return null;
    const hasProgress = heroStationed || !!eventAlert;

    return (
        <div
            className={cn(
                "absolute right-1.5 z-40 pointer-events-none",
                hasProgress ? "bottom-7" : "bottom-3.5",
                "transition-all duration-150 ease-out"
            )}
        >
            <AnimatePresence>
                {deltas.map(d => (
                    <motion.div
                        key={d.id}
                        initial={{ opacity: 0, y: 2, scale: 0.95 }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            y: [2, 0, -2, -5],
                            scale: [0.95, 1, 1, 0.98]
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 3.0,
                            times: [0, 0.08, 0.82, 1],
                            ease: 'easeOut'
                        }}
                        className={cn(
                            "absolute right-0 bottom-0 font-mono font-bold text-[12px] tabular-nums leading-none tracking-tight pointer-events-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] whitespace-nowrap",
                            d.delta > 0 ? "text-emerald-300" : "text-amber-200"
                        )}
                        style={{
                            textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000'
                        }}
                    >
                        {d.delta > 0 ? `+${d.delta.toLocaleString()}` : (d.delta < 0 ? `-${Math.abs(d.delta).toLocaleString()}` : `${d.delta}`)}
                    </motion.div>
                ))}
            </AnimatePresence>
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
                "transition-opacity ease-out",
                isHovered ? "opacity-100 duration-500 delay-[1200ms]" : "opacity-0 duration-150 delay-0"
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
 * AddHeroBadge — green plus icon in the bottom-left corner of a token on hover.
 * Appears only when the token accepts a hero and no hero is currently assigned.
 * Clicking it automatically assigns an available idle hero to the token.
 */
export const AddHeroBadge = ({ isHovered, isDragging, onClick }) => {
    if (isDragging) return null;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            aria-label="Assign Hero"
            className={cn(
                "absolute left-1.5 bottom-1.5 z-30 pointer-events-auto",
                "w-6 h-6 flex items-center justify-center p-0",
                "filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]",
                "hover:scale-125 active:scale-95 transition-all duration-150 ease-out cursor-pointer select-none",
                isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
            )}
        >
            <img
                src="/assets/ui/ui_add_green.png"
                alt="Assign Hero"
                className="w-5 h-5 object-contain pointer-events-none"
                style={{ imageRendering: 'pixelated' }}
            />
        </button>
    );
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
    onHover,
    onAutoAssignHero
}) => {
    const isGuildHallToken = token?.typeId === 'token_guild_hall';

    const hasToken = !!token?.typeId;
    const isAnchor = token?.isAnchor !== false;
    const size = token?.size || 1;
    const anchorIndex = token?.anchorTile ?? index;

    const paired = hasToken && !!token?.heroId;
    const offset = (paired && size === 1) ? PAIR_OFFSET_PX : 0;

    const staffed = !!token?.heroId;
    const idle = staffed && (!hasToken || !!token.alert);
    const glow = !staffed ? null : idle ? 'gi-glow-idle' : 'gi-glow-active';
    const isPermanent = token?.cannotLeaveBoard || token?.isGuildHall || token?.typeId === 'token_guild_hall';
    const isFiniteToken = hasToken && !isGuildHallToken && token?.usesRemaining != null;

    const drag = useEntityDrag({
        id: `tile-token-${index}`,
        kind: DRAG_KIND.TOKEN,
        payload: {
            typeId: token?.typeId,
            from: { tile: anchorIndex },
            onMiss: isPermanent ? () => {
                EventBus?.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                    tile: anchorIndex,
                    severity: 'disallow',
                    type: 'drop_rejected',
                    name: 'Guild Hall',
                    title: 'Guild Hall cannot be removed from the playmat.',
                    rulesText: null,
                    message: 'Guild Hall cannot be removed from the playmat.'
                });
                return null;
            } : undefined
        },
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !hasToken
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
            if (p.kind === DRAG_KIND.TOKEN) return true;
            if (p.kind === DRAG_KIND.HERO) {
                return !hasToken || token?.requiresHero !== false;
            }
            return false;
        },
        onDrop: (p, info) => {
            if (p.kind === DRAG_KIND.TOKEN) onPlaceToken?.(index, p, info);
            else if (p.kind === DRAG_KIND.HERO) onPlaceHero?.(anchorIndex, p, info);
        }
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
        : (offset ? `translateX(${offset}px)` : 'translateX(0px)');

    const tokenTransition = isPushing
        ? 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';

    const [tileHovered, setTileHovered] = React.useState(false);

    /**
     * D-114: hovering a tile that cannot work says what is wrong, in a sentence.
     * The bar's two-word label ("Need Items") says something is wrong; this says
     * what to do about it. Lives on the tile root rather than on the bar so it
     * still reaches an `unstocked` tile, which has no Token left to draw a bar on.
     */
    const alertHint = token?.alert ? ALERT_HINT[token.alert] : null;

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (token?.heroId) {
            onPickUp?.(anchorIndex);
        } else if (hasToken && !isGuildHallToken) {
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
            id={`tile-${index}`}
            title={alertHint || undefined}
            data-tile-alert={token?.alert || undefined}
            data-tile-staffed={staffed && hasToken ? "true" : undefined}
            data-tile-has-token={hasToken ? "true" : undefined}
            data-tile-finite-token={isFiniteToken ? "true" : undefined}
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            {...drop.droppableProps}
            {...(hasToken ? drag.handleProps : {})}
            onContextMenu={handleContextMenu}
            onClick={
                hasToken ? (e) => {
                    if (!drag.isDragging) {
                        onInspectToken?.(token.typeId, e.currentTarget.getBoundingClientRect(), anchorIndex);
                    }
                } : undefined
            }
            onDoubleClick={
                hasToken ? (e) => onInspectToken?.(token.typeId, e.currentTarget.getBoundingClientRect(), anchorIndex)
                    : undefined
            }
            onMouseEnter={() => { setTileHovered(true); onHover?.(anchorIndex); }}
            onMouseLeave={() => { setTileHovered(false); onHover?.(null); }}
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
                hasToken && 'cursor-grab active:cursor-grabbing',
                previewRing
            )}
        >

            {hasToken && isAnchor && !drag.isDragging && (
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
                    <div
                        className={cn(
                            'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                            tileHovered && 'gi-token-hover-pulse'
                        )}
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
                    tileHovered={tileHovered}
                />
            )}

            {/* Centered Footprint Overlay Layer (Layered in front of token and hero) */}
            {hasToken && isAnchor && !drag.isDragging && (
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
                        hasHero={!!token?.heroId}
                        alert={token?.alert}
                    />

                    {/* Floating Delta Counter (-1, +50, etc.) */}
                    <TokenChargeDeltaFloater
                        tile={anchorIndex}
                        hasHero={!!token?.heroId}
                        alert={token?.alert}
                    />

                    {/* Add Hero Button in Bottom-Left on hover when unassigned */}
                    {token?.requiresHero !== false && !token?.heroId && (
                        <AddHeroBadge
                            isHovered={tileHovered}
                            isDragging={drag.isDragging}
                            onClick={() => onAutoAssignHero?.(anchorIndex)}
                        />
                    )}

                    {/* Cycle progress bar across bottom of token footprint (centered & in front of hero) */}
                    <TileProgressBar
                        tile={anchorIndex}
                        token={token}
                        isHovered={tileHovered}
                        alert={token?.alert}
                    />
                </div>
            )}

            {/* On-Board Event Notification Alert (Missing Items, Missing Tokens, Token Exhausted) */}
            <TileEventAlert tile={anchorIndex} />
        </div>
    );
};

/**
 * The hero standing on a Token: drag to redeploy, click to recall.
 */
const HeroBadge = ({ index, heroId, heroName, heroSprite, size = 1, offset, idle, glow, pushTransform, isPushing, onPickUp, tileHovered }) => {
    const drag = useEntityDrag({
        id: `tile-hero-${index}`,
        kind: DRAG_KIND.HERO,
        payload: { heroId, name: heroName, spriteId: heroSprite, from: { tile: index } },
        sourceSurface: DND_SURFACE.BOARD
    });

    const { activePayload, isDragging } = useActiveDrag();
    const isThisHeroDragging = isDragging && activePayload?.heroId === heroId;

    const art = heroSprite ? resolveSpritePath(heroSprite) : null;
    const is2x = size === 2;
    const leftPos = is2x ? (TILE_PX - HERO_HIT_PX) / 2 : (TILE_PX - HERO_HIT_PX) / 2 - offset;
    const topPos = is2x ? TILE_STEP_PX : 0;

    const handleClick = (e) => {
        const btn = e.currentTarget;
        if (btn && !isElementOpaqueAtPoint(btn, e.clientX, e.clientY)) {
            return; // Transparent area: let click reach tile or token underneath
        }
        e.stopPropagation();
        EventBus.publish('inspect_hero', { heroId });
    };

    const handleContextMenu = (e) => {
        const btn = e.currentTarget;
        if (btn && !isElementOpaqueAtPoint(btn, e.clientX, e.clientY)) {
            return; // Transparent area: let contextmenu reach tile or token underneath
        }
        e.preventDefault();
        e.stopPropagation();
        onPickUp?.(index);
    };

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            data-alpha-test="true"
            type="button"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            style={{
                left: leftPos,
                top: topPos,
                width: HERO_HIT_PX,
                height: TILE_PX,
                zIndex: is2x ? 20 : undefined,
                transform: pushTransform ? `translate(${pushTransform.x}px, ${pushTransform.y}px)` : undefined,
                transition: isPushing
                    ? 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                    : 'left 220ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            className={cn(
                'absolute pointer-events-auto',
                'cursor-grab active:cursor-grabbing',
                glow,
                (drag.isDragging || isThisHeroDragging) && 'opacity-0 pointer-events-none'
            )}
        >
            {art && (
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        tileHovered && !drag.isDragging && 'gi-token-hover-pulse'
                    )}
                >
                    <PixelArt
                        src={art}
                        alt={heroName || 'Hero'}
                        size={TILE_PX}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    />
                </div>
            )}
        </button>
    );
};

export default BoardTile;
