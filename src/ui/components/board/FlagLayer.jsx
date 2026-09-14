import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { BOARD_PX, TILE_STEP_PX, colOf, rowOf } from '../../../config/boardGeometry.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as Placement from '../../../systems/board/Placement.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { GameState } from '../../../state/GameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { PixelArt } from '../base/TokenSprite.jsx';
import { FlagMark } from './FlagMark.jsx';
import { flagTooltip } from './flagText.js';
import { announce } from './placeTokenFromDrag.js';

/**
 * FlagLayer — **flags drawn on today's grid** (Free Playmat slice 1.5, FPP-15).
 *
 * An absolute overlay over the playmat. On the grid, mat units are board
 * pixels, so a flag's `{ x, y }` is drawn where it stands with no conversion.
 *
 * * **Pennant** — a small gold flag at the **top-left corner of the flag's
 *   tile**, clear of the Token art; several flags on one tile fan out 12 px.
 *   Drag it to move only the flag (`DRAG_KIND.FLAG`); hover for status and
 *   skips. A flag has no skill since slice 1.5b (FP-71), so the skill picker is
 *   gone; the rules drawer behind a gear badge is slice 1.5b-ii (FP-73).
 * * **Idle** (FP-29) — the pennant turns grey with a "…" chip, and the idle
 *   hero is drawn small beside it with **no glow** (replacing D-172's bright
 *   idle mark). Working and waiting heroes stay drawn by `BoardTile`, paired
 *   with their Token (D-266).
 * * **Reach ring** (FP-64, A-4) — a dashed gold circle of the live flag radius,
 *   only while that flag or its hero is hovered, dragged or inspected.
 *   Hitboxes and every other ring are never drawn.
 *
 * All of it is provisional (§1.7): cosmetic, and cheap to change once seen.
 */

/** Inset of the first pennant from its tile's top-left corner. */
export const PENNANT_INSET_PX = 6;
/** How far each further flag on the same tile fans out to the right. */
export const PENNANT_FAN_PX = 12;
/** The pennant's size, in board pixels. */
export const PENNANT_PX = 24;
/** An idle hero is drawn at half a tile. */
export const IDLE_HERO_PX = 64;

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
    const out = [];
    for (const [heroId] of BoardState.heroesOnBoard()) {
        const flag = BoardState.flagOf(heroId);
        if (!flag) continue;
        const tile = BoardState.tileAtPoint(flag);
        slots[tile] = (slots[tile] ?? -1) + 1;
        const hero = heroes.find(h => h?.id === heroId);
        out.push({
            heroId,
            x: flag.x,
            y: flag.y,
            tile,
            slot: slots[tile],
            state: Flags.statusOf(heroId).state,
            name: hero?.name || 'Hero',
            sprite: hero?.spriteId || hero?.classId || null
        });
    }
    return out;
}

/**
 * @param {string|null} inspectedHeroId the hero whose panel is open
 * @param {string|null} hoverHeroId a hero hovered anywhere on the board
 * @param {(heroId: string|null) => void} onHoverHero
 * @param {{ heroId: string, x: number, y: number }|null} dragRing where a hero
 *   or pennant being dragged would plant — the ring follows it
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

    /**
     * ⚠️ Two layers. Rings and idle heroes sit just above the Tokens (z 38);
     * **pennants sit above the loot sprites** (`SpriteLayerView`, z 80). Loot
     * lands beside the Token that dropped it — often right on the tile corner
     * where the pennant stands — and a pennant under a pile of Oak Wood could
     * not be clicked or dragged (found while verifying 1.5).
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

            {flags.filter(f => f.state === 'idle').map(f => (
                <IdleHero key={`idle-${f.heroId}`} flag={f} onHover={onHoverHero} />
            ))}
        </div>
        <div
            data-flag-pennants
            className="absolute left-0 top-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, zIndex: 85 }}
        >
            {flags.map(f => (
                <Pennant key={`flag-${f.heroId}`} flag={f} onHover={onHoverHero} />
            ))}
        </div>
        </>
    );
};

function pennantOrigin(flag) {
    return {
        left: colOf(flag.tile) * TILE_STEP_PX + PENNANT_INSET_PX + flag.slot * PENNANT_FAN_PX,
        top: rowOf(flag.tile) * TILE_STEP_PX + PENNANT_INSET_PX
    };
}

/** One flag's pennant: drag to move the flag, hover for why. */
const Pennant = ({ flag, onHover }) => {
    const ref = useRef(null);
    const [hovered, setHovered] = useState(false);
    const { isDragging: anyDrag } = useActiveDrag();
    const idle = flag.state === 'idle';

    const drag = useEntityDrag({
        id: `flag-${flag.heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId: flag.heroId, name: flag.name, from: { flag: true } },
        sourceSurface: DND_SURFACE.BOARD
    });

    useEffect(() => {
        if (drag.isDragging) setHovered(false);
    }, [drag.isDragging]);

    const setRefs = (node) => {
        ref.current = node;
        drag.setNodeRef(node);
    };

    const { left, top } = pennantOrigin(flag);

    return (
        <>
            <button
                ref={setRefs}
                {...drag.handleProps}
                type="button"
                data-flag-pennant={flag.heroId}
                data-flag-state={flag.state}
                aria-label={`${flag.name}’s flag`}
                onMouseEnter={() => { setHovered(true); onHover?.(flag.heroId); }}
                onMouseLeave={() => { setHovered(false); onHover?.(null); }}
                onClick={(e) => { e.stopPropagation(); }}
                className={cn(
                    'absolute pointer-events-auto p-0 m-0 bg-transparent border-0',
                    'cursor-grab active:cursor-grabbing transition-transform duration-150 ease-out hover:scale-110',
                    drag.isDragging && 'opacity-30'
                )}
                style={{ left, top, width: PENNANT_PX, height: PENNANT_PX, zIndex: 2 + flag.slot }}
            >
                <FlagMark size={PENNANT_PX} idle={idle} />
                {idle && (
                    <span
                        data-flag-idle-chip
                        className="absolute -top-2 left-3.5 px-1 rounded bg-black/85 border border-white/20 text-[11px] leading-[11px] font-bold text-stone-300 pointer-events-none"
                    >
                        …
                    </span>
                )}
            </button>
            {hovered && !anyDrag && <FlagTooltip anchor={ref.current} heroId={flag.heroId} />}
        </>
    );
};

/** An idle hero, small beside their flag, with no glow (FP-29). */
const IdleHero = ({ flag, onHover }) => {
    const drag = useEntityDrag({
        id: `flag-hero-${flag.heroId}`,
        kind: DRAG_KIND.HERO,
        payload: { heroId: flag.heroId, name: flag.name, spriteId: flag.sprite, from: { flag: true } },
        sourceSurface: DND_SURFACE.BOARD
    });
    const { activePayload, isDragging } = useActiveDrag();
    const hidden = drag.isDragging || (isDragging && activePayload?.kind === DRAG_KIND.HERO && activePayload?.heroId === flag.heroId);

    const art = flag.sprite ? resolveSpritePath(flag.sprite) : null;
    const { left, top } = pennantOrigin(flag);

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            data-flag-idle-hero={flag.heroId}
            aria-label={`${flag.name}, idle`}
            onMouseEnter={() => onHover?.(flag.heroId)}
            onMouseLeave={() => onHover?.(null)}
            onClick={(e) => { e.stopPropagation(); EventBus.publish('inspect_hero', { heroId: flag.heroId }); }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                announce(Placement.recallHeroById(flag.heroId));
            }}
            className={cn(
                'absolute pointer-events-auto p-0 m-0 bg-transparent border-0 cursor-grab active:cursor-grabbing',
                hidden && 'opacity-0 pointer-events-none'
            )}
            style={{ left: left + PENNANT_PX - 10, top: top - 6, width: IDLE_HERO_PX, height: IDLE_HERO_PX, zIndex: 1 }}
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

const STATE_TONE = {
    working: 'text-emerald-300',
    waiting: 'text-amber-300',
    idle: 'text-stone-300'
};

/**
 * The pennant's hover text: the hero, what they are doing, and up to
 * five Tokens the flag passed over with the reason (FP-48, FP-60). Refreshed
 * twice a second while shown, because skips change without an event.
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
