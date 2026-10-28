import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag, useActiveDrag, useDragPointer } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { matW, matH, clampToMat, artRadiusOf } from '../../../config/matGeometry.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z } from './matLayers.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { GameState } from '../../../state/GameState.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } from '../base/TokenSprite.jsx';
import { FlagMark } from './FlagMark.jsx';
import { flagOutline } from './spriteOutline.js';
import { flagTooltip } from './flagText.js';
import { FloatingTip } from '../base/Tooltip.jsx';
import { pointerToMat, matRectForDrag } from './matPoint.js';
import { useMatFit } from './MatFitContext.jsx';
import { useTokenDragLanding } from './MatRings.jsx';
import { FLAG_PX, PENNANT_ART_PX, POLE_BASE, pinnedFlagPoint } from './flagGeometry.js';
import { workableInReach } from './flagWorkable.js';
import { pixelRingPath } from './pixelRing.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * FlagLayer: flags standing freely on the playmat, an absolute overlay in mat units.
 * - **Flag**: the pennant, the same for every hero, 64 px at the mat's natural fit, its pole
 * foot standing exactly on the flag's point. Drag it to move the flag (`DRAG_KIND.FLAG`); hover for the hard
 * outline, the hero's name, status and skips, and the reach ring. Nothing else sits on it: the
 * work rules open from the hero bar, and an idle hero says 'No work in range.' themselves. It
 * answers on its drawn square, which the pennant fills (there is no opaque-pixel test), except
 * over a Token (below). Flags may stand very close together or overlap, and never push, nudge or hide
 * each other; later flags draw in front of earlier ones.
 * - **Idle**: the flag looks the same. The hero standing beside it, like every hero on the mat
 * in every state, is drawn by `MatBoard`, so a hero walking back to their flag is never handed
 * from one layer to another.
 * - **The player never moves a hero**: dragging any hero drags their FLAG.
 * - **Reach ring**: a gold circle of the live flag radius drawn in whole art pixels over a hard
 * black shadow (`pixelRing.js`), only while that flag or its hero is hovered, dragged or
 * inspected, or while a dragged Token would land inside it. While a flag is dragged, every Token
 * inside it the hero could work shows a green dot at its centre.
 * - **No hitbox over Tokens, but the cloth**: wherever the pointer is on a Token's art circle,
 * every flag lets it through (`yieldToTokens`, set by `MatBoard`), so a flag never eats a
 * Token's hover, click or grab with its pole or empty corners. A flag is grabbed by the part
 * of it over bare mat, or by its cloth where it is drawn in front of the Token (`flagCloth.js`),
 * so a flag standing among Tokens can always be picked up.
 * - **Pinned**: a flag pinned to a Token is drawn with its pole planted at the top of that
 * Token (`pinnedFlagPoint`), carries `data-flag-pinned`, shows no reach ring (the radius does
 * not apply) and says 'Working only X' on hover.
 */

const NO_DOTS = Object.freeze([]);

/** The reach ring: one art pixel of gold over a solid black copy one art pixel down-right. */
const RING_GOLD = 'var(--color-gi-gold)';
const RING_SHADOW = '#000';

/** A workable Token's green dot, as a share of the art size. */
const WORKABLE_DOT_SCALE = 0.05;

/** The live flag radius, following the Mat Tuner and the Scouting Flags upgrade. */
function useFlagRadius() {
    const [radius, setRadius] = useState(() => Flags.flagRadius());
    useEffect(() => {
        const refresh = () => setRadius(Flags.flagRadius());
        const offTuning = onMatTuningChanged(refresh);
        const offUpgrade = EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, refresh, UI_LISTENER);
        return () => { offTuning?.(); offUpgrade?.(); };
    }, []);
    return radius;
}

/** A flat, comparable projection of every flag, in planting order. */
function projectFlags() {
    const heroes = GameState.state?.heroes || [];
    const out = [];
    for (const [heroId] of BoardState.heroesOnBoard()) {
        const flag = BoardState.flagOf(heroId);
        if (!flag) continue;
        const hero = heroes.find(h => h?.id === heroId);
        // A pinned flag is drawn on its Token; a lapsed pin reads as an area flag even before
        // the next tick takes the pin off.
        const pinned = Flags.pinnedTokenOf(heroId);
        const drawn = pinned ? pinnedFlagPoint(pinned, artRadiusOf(pinned.typeId)) : flag;
        out.push({
            heroId,
            x: flag.x,
            y: flag.y,
            drawX: drawn.x,
            drawY: drawn.y,
            pinnedTo: pinned ? pinned.id : null,
            state: Flags.statusOf(heroId).state,
            name: hero?.name || 'Hero',
            sprite: hero?.spriteId || hero?.classId || null
        });
    }
    return out;
}

/**
 * Where a flag being dragged would be planted: under the cursor, exactly. Null unless a flag
 * or a board hero is actually in the hand.
 */
function useFlagDragPoint(matRef) {
    const { activePayload, isDragging } = useActiveDrag();
    const pointer = useDragPointer();

    if (!isDragging || !pointer || !matRef?.current) return null;
    const kind = activePayload?.kind;
    if (kind !== DRAG_KIND.FLAG && kind !== DRAG_KIND.HERO) return null;
    if (!activePayload?.heroId) return null;

    const point = pointerToMat(pointer, matRectForDrag(matRef.current, activePayload));
    if (!point) return null;
    // Off the mat entirely (over a drawer or the dock): nothing to preview.
    if (point.x < 0 || point.y < 0 || point.x > matW() || point.y > matH()) return null;
    // Over a Token this hero would be pinned to: the radius will not apply, so no reach ring.
    const under = Flags.tokenAtPoint(point);
    if (under && !Flags.pinRefusal(activePayload.heroId, under)) return null;
    return { heroId: activePayload.heroId, ...clampToMat(point) };
}

/**
 * @param {string|null} inspectedHeroId the hero whose panel is open
 * @param {string|null} hoverHeroId a hero hovered anywhere on the board
 * @param {(heroId: string|null) => void} onHoverHero
 * @param {{ heroId: string, x: number, y: number }|null} dragRing an explicit plant preview;
 * without one the layer follows the live drag itself
 * @param {{current: HTMLElement|null}} matRef the mat's own element
 * @param {Map<string, number>|null} flagZ each flag's z in the mat's order (`matStackOrder`)
 */
export const FlagLayer = ({ inspectedHeroId = null, hoverHeroId = null, onHoverHero, dragRing = null, matRef = null, flagZ = null, yieldToTokens = false }) => {
    const flags = useGameState(
        projectFlags,
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    ) || [];
    const radius = useFlagRadius();
    const mat = useMatSize();
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, artScale);
    // The pennant on the same art-pixel grid as the Tokens.
    const flagPx = PENNANT_ART_PX * artScale;
    const liveDragRing = useFlagDragPoint(matRef);
    const ring = dragRing || liveDragRing;

    const rings = new Map();
    // A pinned flag has no reach to show.
    for (const id of [inspectedHeroId, hoverHeroId]) {
        const flag = id ? flags.find(f => f.heroId === id) : null;
        if (flag && !flag.pinnedTo) rings.set(id, { x: flag.x, y: flag.y });
    }
    if (ring?.heroId) rings.set(ring.heroId, { x: ring.x, y: ring.y });

    // While a flag is carried, a green dot on every Token its hero could work from there. Worked
    // out when the drop point moves, not every frame.
    const workable = useMemo(
        () => (ring?.heroId ? workableInReach(ring.heroId, ring) : NO_DOTS),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ring?.heroId, ring?.x, ring?.y]
    );
    const dotR = Math.max(4, Math.round(artPx * WORKABLE_DOT_SCALE));
    const ringPixels = Math.round(radius / artScale);
    const ringPath = useMemo(() => pixelRingPath(ringPixels), [ringPixels]);

    // While a Token is dragged, every flag it would land inside shows its reach, whatever the
    // Token is.
    const landing = useTokenDragLanding(matRef);
    if (landing) {
        for (const flag of flags) {
            if (!flag.pinnedTo && !rings.has(flag.heroId) && Flags.flagReaches(flag, landing)) {
                rings.set(flag.heroId, { x: flag.x, y: flag.y });
            }
        }
    }

    /**
     * ⚠️ Two layers. Rings sit above the Tokens.
     * Flags sort in among the Tokens: a flag standing higher on the mat than a Token is drawn
     * behind it, like any Token. For that the pennants' box must NOT have a z-index of its
     * own: a z-index would make it one stacking layer, and every flag in it would sit above or
     * below every Token together. Each flag carries its own z (`flagZ`), and the idle hero
     * beside it is one above (`MatBoard`).
     * Loot is collected the moment the pointer touches it, so a pile never stays in the way of
     * grabbing a flag.
     */
    return (
        <>
        <div
            data-flag-layer
            className="absolute left-0 top-0 pointer-events-none"
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.RINGS }}
        >
            {rings.size > 0 && (
                <svg
                    className="absolute left-0 top-0 overflow-visible pointer-events-none"
                    width={mat.w}
                    height={mat.h}
                >
                    {[...rings].map(([heroId, p]) => {
                        // Snapped to the art-pixel grid, so every cell lands on whole screen pixels.
                        const ox = Math.round(p.x / artScale - 0.5) * artScale;
                        const oy = Math.round(p.y / artScale - 0.5) * artScale;
                        return (
                            <g
                                key={heroId}
                                data-flag-ring={heroId}
                                data-r={radius}
                                data-cx={p.x}
                                data-cy={p.y}
                                shapeRendering="crispEdges"
                            >
                                <path
                                    d={ringPath}
                                    transform={`translate(${ox + artScale} ${oy + artScale}) scale(${artScale})`}
                                    fill={RING_SHADOW}
                                />
                                <path
                                    d={ringPath}
                                    transform={`translate(${ox} ${oy}) scale(${artScale})`}
                                    fill={RING_GOLD}
                                />
                            </g>
                        );
                    })}
                    {workable.map(t => (
                        <circle
                            key={t.id}
                            data-workable-dot={t.id}
                            cx={t.x}
                            cy={t.y}
                            r={dotR}
                            fill="rgb(52, 211, 153)"
                            stroke="#000"
                            strokeWidth={1.5}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </svg>
            )}
        </div>
        <div
            data-flag-pennants
            className="absolute left-0 top-0 pointer-events-none"
            style={flagZ ? { width: mat.w, height: mat.h } : { width: mat.w, height: mat.h, zIndex: MAT_Z.FLAGS }}
        >
            {flags.map((f, i) => (
                <Flag
                    key={`flag-${f.heroId}`}
                    flag={f}
                    z={flagZ?.get(f.heroId) ?? i * 3}
                    flagPx={flagPx}
                    onHover={onHoverHero}
                    boardHovered={hoverHeroId === f.heroId}
                    inspected={inspectedHeroId === f.heroId}
                    yieldToTokens={yieldToTokens}
                />
            ))}
        </div>
        </>
    );
};

/**
 * One hero's flag: drag to move it, hover for why.
 * ⚠️ Two components on purpose. dnd-kit re-renders every component holding a drag hook at each
 * drag start, end and change of target; the hook lives in this thin shell, which works out what
 * the flag draws from a drag (carried, its tooltip), and the flag (`FlagBody`) is memoised on
 * those, so a drag elsewhere does not redraw it.
 */
const Flag = memo(function Flag(props) {
    const { flag } = props;
    const [hovered, setHovered] = useState(false);
    const { isDragging: anyDrag, activePayload } = useActiveDrag();

    const drag = useEntityDrag({
        id: `flag-${flag.heroId}`,
        kind: DRAG_KIND.FLAG,
        payload: { heroId: flag.heroId, name: flag.name, from: { flag: true } },
        sourceSurface: DND_SURFACE.BOARD
    });

    // Dragged by the flag itself or by its hero: either way this flag is in the hand.
    const carried = drag.isDragging
        || (anyDrag && activePayload?.kind === DRAG_KIND.FLAG && activePayload?.heroId === flag.heroId);

    useEffect(() => {
        if (carried) setHovered(false);
    }, [carried]);

    return (
        <FlagBody
            {...props}
            hovered={hovered}
            onHoverChange={setHovered}
            carried={carried}
            tipShown={hovered && !anyDrag}
            dragRef={drag.setNodeRef}
            dragProps={drag.handleProps}
        />
    );
});

const FlagBody = memo(function FlagBody({
    flag, z = 0, flagPx, onHover, boardHovered = false, inspected = false, yieldToTokens = false,
    hovered, onHoverChange, carried, tipShown, dragRef, dragProps
}) {
    const ref = useRef(null);
    const setRefs = useCallback((node) => {
        ref.current = node;
        dragRef?.(node);
    }, [dragRef]);

    const scaleFactor = flagPx / FLAG_PX;
    const originLeft = (flag.drawX ?? flag.x ?? 0) - POLE_BASE.x * scaleFactor;
    const originTop = (flag.drawY ?? flag.y ?? 0) - POLE_BASE.y * scaleFactor;

    const handleClick = (e) => {
        e.stopPropagation();
    };

    return (
        <>
            <button
                ref={setRefs}
                {...dragProps}
                type="button"
                data-flag={flag.heroId}
                data-flag-state={flag.state}
                data-flag-pinned={flag.pinnedTo || undefined}
                aria-label={`${flag.name}’s flag`}
                onMouseEnter={() => { onHoverChange(true); onHover?.(flag.heroId); }}
                onMouseLeave={() => { onHoverChange(false); onHover?.(null); }}
                onClick={handleClick}
                className={cn(
                    'absolute p-0 m-0 bg-transparent border-0 outline-none',
                    // Over a Token the pointer goes to the Token.
                    yieldToTokens ? 'pointer-events-none' : 'pointer-events-auto',
                    'cursor-grab active:cursor-grabbing',
                    carried && 'opacity-30'
                )}
                style={{
                    left: originLeft,
                    top: originTop,
                    width: flagPx,
                    height: flagPx,
                    zIndex: z
                }}
            >
                <FlagMark
                    size={flagPx}
                    alt={`${flag.name}’s flag`}
                    outline={flagOutline({ hovered: hovered || boardHovered, selected: inspected, carried })}
                    className="absolute left-0 top-0"
                />
            </button>

            {tipShown && <FlagTooltip anchor={ref.current} heroId={flag.heroId} />}
        </>
    );
});


export const STATE_TONE = {
    working: 'text-emerald-300',
    idle: 'text-stone-300'
};

/**
 * The flag's hover text: the hero, what they are doing, and up to five Tokens the flag passed
 * over with the reason. Refreshed twice a second while shown, because skips change without an
 * event.
 */
export const FlagTooltip = ({ anchor, heroId }) => {
    const [, refresh] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => refresh(n => n + 1), 500);
        return () => clearInterval(timer);
    }, []);
    const tip = flagTooltip(heroId);
    return (
        <FloatingTip
            anchor={anchor}
            title={tip.title}
            maxWidth={256}
            tipProps={{ 'data-flag-tooltip': heroId }}
            content={<>
                {tip.pin && <div data-flag-tooltip-pin className="text-gi-gold/90">{tip.pin}</div>}
                <div className={STATE_TONE[tip.state] || 'text-white/80'}>{tip.status}</div>
                {tip.skips.length > 0 && (
                    <ul className="mt-1 pt-1 border-t border-white/10 flex flex-col gap-0.5 text-white/75">
                        {tip.skips.map((line, i) => <li key={i}>{line}</li>)}
                        {tip.more > 0 && <li className="text-white/50">+{tip.more} more</li>}
                    </ul>
                )}
            </>}
        />
    );
};

export default FlagLayer;
