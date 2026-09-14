import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { BOARD_PX } from '../../../config/boardGeometry.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { flagColourOf } from '../../../systems/board/FlagColours.js';
import * as Placement from '../../../systems/board/Placement.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { GameState } from '../../../state/GameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { PixelArt } from '../base/TokenSprite.jsx';
import { FlagMark } from './FlagMark.jsx';
import { flagTooltip } from './flagText.js';
import { announce } from './placeTokenFromDrag.js';
import {
    FLAG_PX, IDLE_HERO_PX, MAX_FLAGS_SHOWN, GEAR_PX, GEAR_OFFSET,
    IDLE_CHIP_OFFSET, MORE_CHIP_OFFSET, IDLE_HERO_OFFSET, fannedOrigin
} from './flagGeometry.js';

/**
 * FlagLayer — **flags drawn on today's grid** (Free Playmat slices 1.5 and
 * 1.5b-ii).
 *
 * An absolute overlay over the playmat. On the grid, mat units are board
 * pixels, so a flag's `{ x, y }` needs no conversion. Where each sprite sits is
 * `flagGeometry.js` — free placement changes only `flagOrigin` there.
 *
 * * **Flag** (FP-77, FP-82) — the owner's sprite in the hero's lasting colour,
 *   128 px, its pole at the tile's bottom-left corner (FPP-20). Drag it to move
 *   the flag (`DRAG_KIND.FLAG`); hover for status and skips. It answers **only
 *   on opaque pixels** (`data-alpha-test`, FP-64): a click on the sky around the
 *   cloth reaches the Token underneath. Several flags on one tile fan out 20 px
 *   right, earlier flags in front; past the third a "+N" chip counts the rest.
 * * **Gear badge** (FP-73) — top-right of the cloth, shown while the flag or its
 *   hero is hovered or the hero is inspected. Opens that hero's rules panel
 *   (`ui:open_flag_rules`); it is not part of the drag handle, so a click on it
 *   never starts a drag. The only way into the rules (FPP-20).
 * * **Idle** (FP-29) — the flag keeps its colour; the hero stands beside it at
 *   128 px with **no glow**, and a "…" chip sits near the top of the pole.
 *   Working and waiting heroes stay drawn by `BoardTile`, paired with their
 *   Token (D-266).
 * * **The player never moves a hero** (FP-76) — dragging the idle hero, like
 *   dragging a working hero on a Token, drags their FLAG.
 * * **Reach ring** (FP-64, A-4) — a dashed gold circle of the live flag radius,
 *   only while that flag or its hero is hovered, dragged or inspected.
 */

/** The live flag radius, following the Mat Tuner. */
function useFlagRadius() {
    const [radius, setRadius] = useState(() => Flags.flagRadius());
    useEffect(() => onMatTuningChanged(() => setRadius(Flags.flagRadius())), []);
    return radius;
}

/** A flat, comparable projection of every flag, in planting order. */
function projectFlags() {
    const heroes = GameState.state?.heroes || [];
    const slots = {};
    const counts = {};
    const out = [];
    for (const [heroId] of BoardState.heroesOnBoard()) {
        const flag = BoardState.flagOf(heroId);
        if (!flag) continue;
        const tile = BoardState.tileAtPoint(flag);
        slots[tile] = (slots[tile] ?? -1) + 1;
        counts[tile] = (counts[tile] ?? 0) + 1;
        const hero = heroes.find(h => h?.id === heroId);
        out.push({
            heroId,
            x: flag.x,
            y: flag.y,
            tile,
            slot: slots[tile],
            state: Flags.statusOf(heroId).state,
            name: hero?.name || 'Hero',
            sprite: hero?.spriteId || hero?.classId || null,
            colour: flagColourOf(heroId)
        });
    }
    for (const f of out) f.onTile = counts[f.tile];
    return out;
}

/**
 * @param {string|null} inspectedHeroId the hero whose panel is open
 * @param {string|null} hoverHeroId a hero hovered anywhere on the board
 * @param {(heroId: string|null) => void} onHoverHero
 * @param {{ heroId: string, x: number, y: number }|null} dragRing where a flag
 *   being dragged would plant — the ring follows it
 */
export const FlagLayer = ({ inspectedHeroId = null, hoverHeroId = null, onHoverHero, dragRing = null }) => {
    const flags = useGameState(
        projectFlags,
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.TILE_CHANGED, 'heroes_updated', 'state_changed']
    ) || [];
    const radius = useFlagRadius();

    const rings = new Map();
    for (const id of [inspectedHeroId, hoverHeroId]) {
        const flag = id ? flags.find(f => f.heroId === id) : null;
        if (flag) rings.set(id, { x: flag.x, y: flag.y });
    }
    if (dragRing?.heroId) rings.set(dragRing.heroId, { x: dragRing.x, y: dragRing.y });

    const shown = flags.filter(f => f.slot < MAX_FLAGS_SHOWN);

    /**
     * ⚠️ Two layers. Rings sit just above the Tokens (z 38); **flags and idle
     * heroes sit above the loot sprites** (`SpriteLayerView`, z 80). Loot lands
     * beside the Token that dropped it — often right where a flag stands — and
     * a flag under a pile of Oak Wood could not be clicked or dragged (found
     * while verifying 1.5).
     */
    return (
        <>
        <div
            data-flag-layer
            className="absolute left-0 top-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, zIndex: 38 }}
        >
            {rings.size > 0 && (
                <svg
                    className="absolute left-0 top-0 overflow-visible pointer-events-none"
                    width={BOARD_PX}
                    height={BOARD_PX}
                >
                    {[...rings].map(([heroId, p]) => (
                        <circle
                            key={heroId}
                            data-flag-ring={heroId}
                            cx={p.x}
                            cy={p.y}
                            r={radius}
                            fill="none"
                            stroke="rgb(251, 191, 36)"
                            strokeOpacity={0.4}
                            strokeWidth={1}
                            strokeDasharray="6 5"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </svg>
            )}
        </div>
        <div
            data-flag-pennants
            className="absolute left-0 top-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, zIndex: 85 }}
        >
            {shown.map(f => (
                <Flag
                    key={`flag-${f.heroId}`}
                    flag={f}
                    onHover={onHoverHero}
                    boardHovered={hoverHeroId === f.heroId}
                    inspected={inspectedHeroId === f.heroId}
                />
            ))}
            {shown.filter(f => f.state === 'idle').map(f => (
                <IdleHero key={`idle-${f.heroId}`} flag={f} onHover={onHoverHero} />
            ))}
        </div>
        </>
    );
};

/** How long the gear stays up after the pointer leaves, so it can be reached. */
const GEAR_LINGER_MS = 250;

/**
 * Whether the gear is showing: at once when wanted, and for a moment after —
 * the pointer has to cross from the cloth or the hero onto the gear itself.
 */
function useLingering(wanted) {
    const [shown, setShown] = useState(wanted);
    useEffect(() => {
        if (wanted) { setShown(true); return undefined; }
        const timer = setTimeout(() => setShown(false), GEAR_LINGER_MS);
        return () => clearTimeout(timer);
    }, [wanted]);
    return shown;
}

/** One hero's flag: drag to move it, hover for why, gear for the rules. */
const Flag = ({ flag, onHover, boardHovered = false, inspected = false }) => {
    const ref = useRef(null);
    const [hovered, setHovered] = useState(false);
    const [gearHovered, setGearHovered] = useState(false);
    const { isDragging: anyDrag, activePayload } = useActiveDrag();
    const idle = flag.state === 'idle';

    const drag = useEntityDrag({
        id: `flag-${flag.heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId: flag.heroId, name: flag.name, from: { flag: true } },
        sourceSurface: DND_SURFACE.BOARD
    });

    // Dragged by the flag itself or by its hero (FP-76): either way this flag is in the hand.
    const carried = drag.isDragging
        || (anyDrag && activePayload?.kind === DRAG_KIND.FLAG && activePayload?.heroId === flag.heroId);

    useEffect(() => {
        if (carried) setHovered(false);
    }, [carried]);

    const gearShown = useLingering(!anyDrag && (hovered || gearHovered || boardHovered || inspected));

    const setRefs = (node) => {
        ref.current = node;
        drag.setNodeRef(node);
    };

    const { left, top } = fannedOrigin(flag, flag.tile, flag.slot);
    const zIndex = 10 + (MAX_FLAGS_SHOWN - flag.slot) * 3;
    const more = flag.slot === MAX_FLAGS_SHOWN - 1 ? flag.onTile - MAX_FLAGS_SHOWN : 0;

    // Only opaque pixels are the flag (FP-64). The global alpha manager already
    // passes pointer events through transparent pixels; this is the backstop.
    const handleClick = (e) => {
        if (e.currentTarget && !isElementOpaqueAtPoint(e.currentTarget, e.clientX, e.clientY)) return;
        e.stopPropagation();
    };

    return (
        <>
            <button
                ref={setRefs}
                {...drag.handleProps}
                type="button"
                data-alpha-test="true"
                data-flag={flag.heroId}
                data-flag-state={flag.state}
                data-flag-colour={flag.colour || 'base'}
                aria-label={`${flag.name}’s flag`}
                onMouseEnter={() => { setHovered(true); onHover?.(flag.heroId); }}
                onMouseLeave={() => { setHovered(false); onHover?.(null); }}
                onClick={handleClick}
                className={cn(
                    'absolute pointer-events-auto p-0 m-0 bg-transparent border-0 outline-none',
                    'cursor-grab active:cursor-grabbing',
                    carried && 'opacity-30'
                )}
                style={{ left, top, width: FLAG_PX, height: FLAG_PX, zIndex }}
            >
                <FlagMark colour={flag.colour} size={FLAG_PX} alt={`${flag.name}’s flag`} className="absolute left-0 top-0" />
                {idle && (
                    <span
                        data-flag-idle-chip
                        className="absolute px-1 rounded bg-black/85 border border-white/20 text-[11px] leading-[11px] font-bold text-stone-300 pointer-events-none"
                        style={{ left: IDLE_CHIP_OFFSET.left, top: IDLE_CHIP_OFFSET.top }}
                    >
                        …
                    </span>
                )}
            </button>

            <button
                type="button"
                data-flag-gear={flag.heroId}
                aria-label={`${flag.name}’s rules`}
                title="Rules"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={() => { setGearHovered(true); onHover?.(flag.heroId); }}
                onMouseLeave={() => { setGearHovered(false); onHover?.(null); }}
                onClick={(e) => {
                    e.stopPropagation();
                    EventBus.publish('ui:open_flag_rules', { heroId: flag.heroId });
                }}
                className={cn(
                    'absolute flex items-center justify-center rounded p-0',
                    'bg-black/95 border border-gi-gold/50 text-gi-gold',
                    'hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer',
                    gearShown ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'
                )}
                style={{
                    left: left + GEAR_OFFSET.left,
                    top: top + GEAR_OFFSET.top,
                    width: GEAR_PX,
                    height: GEAR_PX,
                    zIndex: zIndex + 2
                }}
            >
                <Settings size={16} />
            </button>

            {more > 0 && (
                <span
                    data-flag-more={flag.tile}
                    className="absolute px-1.5 rounded-full bg-black/90 border border-gi-gold/50 text-[11px] leading-4 font-bold text-gi-gold pointer-events-none"
                    style={{ left: left + MORE_CHIP_OFFSET.left, top: top + MORE_CHIP_OFFSET.top, zIndex: zIndex + 2 }}
                >
                    +{more}
                </span>
            )}

            {hovered && !anyDrag && <FlagTooltip anchor={ref.current} heroId={flag.heroId} />}
        </>
    );
};

/**
 * An idle hero, standing beside their flag at 128 px, with no glow (FP-29).
 * Dragging them drags their flag (FP-76); click for the hero sheet; right-click
 * recalls. Opaque pixels only, like every hero on the board.
 */
const IdleHero = ({ flag, onHover }) => {
    const drag = useEntityDrag({
        id: `flag-hero-${flag.heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId: flag.heroId, name: flag.name, from: { flag: true, hero: true } },
        sourceSurface: DND_SURFACE.BOARD
    });

    const art = flag.sprite ? resolveSpritePath(flag.sprite) : null;
    const { left, top } = fannedOrigin(flag, flag.tile, flag.slot);
    const opaque = (e) => !e.currentTarget || isElementOpaqueAtPoint(e.currentTarget, e.clientX, e.clientY);

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            data-alpha-test="true"
            data-flag-idle-hero={flag.heroId}
            aria-label={`${flag.name}, idle`}
            onMouseEnter={() => onHover?.(flag.heroId)}
            onMouseLeave={() => onHover?.(null)}
            onClick={(e) => {
                if (!opaque(e)) return;
                e.stopPropagation();
                EventBus.publish('inspect_hero', { heroId: flag.heroId });
            }}
            onContextMenu={(e) => {
                if (!opaque(e)) return;
                e.preventDefault();
                e.stopPropagation();
                announce(Placement.recallHeroById(flag.heroId));
            }}
            className="absolute pointer-events-auto p-0 m-0 bg-transparent border-0 outline-none cursor-grab active:cursor-grabbing"
            style={{
                left: left + IDLE_HERO_OFFSET.left,
                top: top + IDLE_HERO_OFFSET.top,
                width: IDLE_HERO_PX,
                height: IDLE_HERO_PX,
                // In front of its own flag's pole, behind the gear.
                zIndex: 10 + (MAX_FLAGS_SHOWN - flag.slot) * 3 + 1
            }}
        >
            {art && <PixelArt src={art} alt={flag.name} size={IDLE_HERO_PX} className="absolute left-0 top-0" />}
        </button>
    );
};

/** Fixed-position place for a floating panel under an anchor, kept on screen. */
function placeUnder(anchor, width, height = 180) {
    const rect = anchor?.getBoundingClientRect?.();
    if (!rect || typeof window === 'undefined') return { left: 0, top: 0 };
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left));
    const below = rect.bottom + margin;
    const top = below + height > window.innerHeight ? Math.max(margin, rect.top - height - margin) : below;
    return { left, top };
}

export const STATE_TONE = {
    working: 'text-emerald-300',
    waiting: 'text-amber-300',
    idle: 'text-stone-300'
};

/**
 * The flag's hover text: the hero, what they are doing, and up to five Tokens
 * the flag passed over with the reason (FP-48, FP-60, FPP-21). Refreshed twice
 * a second while shown, because skips change without an event.
 */
export const FlagTooltip = ({ anchor, heroId }) => {
    const [, refresh] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => refresh(n => n + 1), 500);
        return () => clearInterval(timer);
    }, []);
    if (typeof document === 'undefined') return null;

    const tip = flagTooltip(heroId);
    return createPortal(
        <div
            role="tooltip"
            data-flag-tooltip={heroId}
            className="fixed z-[90] w-64 p-2 rounded-lg pointer-events-none bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[11px] leading-snug text-white"
            style={placeUnder(anchor, 256, 64 + tip.skips.length * 16)}
        >
            <div className="font-bold text-gi-gold">{tip.title}</div>
            <div className={STATE_TONE[tip.state] || 'text-white/80'}>{tip.status}</div>
            {tip.skips.length > 0 && (
                <ul className="mt-1 pt-1 border-t border-white/10 flex flex-col gap-0.5 text-white/75">
                    {tip.skips.map((line, i) => <li key={i}>{line}</li>)}
                    {tip.more > 0 && <li className="text-white/50">+{tip.more} more</li>}
                </ul>
            )}
        </div>,
        document.body
    );
};

export default FlagLayer;
