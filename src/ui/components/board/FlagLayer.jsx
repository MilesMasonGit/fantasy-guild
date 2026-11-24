import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z } from './matLayers.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { GameState } from '../../../state/GameState.js';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { FlagMark } from './FlagMark.jsx';
import { flagOutline } from './spriteOutline.js';
import { useMatFit } from './MatFitContext.jsx';
import { markerBox, sideSlot, MARKER_PULSE_EVERY_MS } from './flagGeometry.js';
import { REACH_DOT_PULSE } from './reachDot.js';
import { usePosePulse } from './fx/posePulse.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * FlagLayer: the flag that marks each hero's order (`FlagMark`, in the hero's own colour), an
 * absolute overlay in mat units. **A flag shows only while its hero is hovered** (on the mat or
 * their hero bar tab), or, for a Token order, while that Token is hovered; it pulses while shown
 * (`usePosePulse`). Every other flag is hidden.
 * - **A Token order**: the flag stands in the Token's middle (`markerBox`), one z above the Token
 * (`tokenZ`, or over the Token brought forward while its card is open), so the Token's art never hides it. Several heroes on one Token stand side by side in
 * roster order (`sideSlot`), each in the same place whichever of them is shown. It never takes the
 * pointer: the Token's middle stays the Token's. It has no tooltip: nothing on the mat has one
 * (the Hero drawer says what the hero is doing).
 * - **A spot order** ("go here"): the flag stands its pole foot on the spot. It fades out when the
 * hover ends, and the pointer can still reach it while it fades.
 * - **No order** (at home by the Guild Hall), or a job gone for good: no flag.
 * - Dragging a spot's flag is dragging its hero (`DRAG_KIND.FLAG`): the drop gives a new order
 * (`Orders.orderAt`). A hero in the hand keeps
 * their flag drawn, faint.
 * - **No hitbox over Tokens, but the cloth**: wherever the pointer is on a Token's art circle,
 * every spot's flag lets it through (`yieldToTokens`, set by `MatBoard`), except its cloth where it
 * is drawn in front of that Token (`flagCloth.js`).
 */

/** How long a spot's flag takes to fade once its hover ends, in ms. */
export const FLAG_FADE_MS = 700;

/** A flat, comparable projection of every flag, in planting order. */
function projectFlags() {
    const heroes = GameState.state?.heroes || [];
    const out = [];
    for (const [heroId] of BoardState.heroesOnBoard()) {
        const flag = BoardState.flagOf(heroId);
        if (!flag) continue;
        const hero = heroes.find(h => h?.id === heroId);
        // A lapsed order reads as a job gone even before the next tick takes the pin off.
        const pinned = Flags.pinnedTokenOf(heroId);
        const status = Flags.statusOf(heroId);
        const order = pinned ? 'token' : (flag.needsJob || !Flags.isSpot(flag) ? null : 'spot');
        if (!order) continue;
        out.push({
            heroId,
            x: flag.x,
            y: flag.y,
            // Where it is drawn: the pinned Token's centre.
            pinX: pinned ? pinned.x : null,
            pinY: pinned ? pinned.y : null,
            pinnedTo: pinned ? pinned.id : null,
            order,
            state: status.state,
            name: hero?.name || 'Hero',
            colour: hero?.flagColour || null,
            roster: heroes.indexOf(hero),
            slot: 0
        });
    }
    // Several heroes on one Token: their flags stand side by side, in roster order.
    const byToken = new Map();
    for (const f of out) {
        if (!f.pinnedTo) continue;
        if (!byToken.has(f.pinnedTo)) byToken.set(f.pinnedTo, []);
        byToken.get(f.pinnedTo).push(f);
    }
    for (const group of byToken.values()) {
        if (group.length < 2) continue;
        group.sort((a, b) => a.roster - b.roster).forEach((f, rank) => { f.slot = sideSlot(rank, group.length); });
    }
    return out;
}

/**
 * @param {string|null} inspectedHeroId the hero whose panel is open
 * @param {string|null} hoverHeroId a hero hovered on the mat or on their roster tab
 * @param {string|null} hoveredTokenId the Token hovered on the mat
 * @param {(heroId: string|null) => void} onHoverHero
 * @param {Map<string, number>|null} flagZ each spot flag's z in the mat's order (`matStackOrder`)
 * @param {Map<string, number>|null} tokenZ each Token's z in the mat's order
 * @param {string|null} inspectedTokenId the Token whose card is open (`MAT_Z.INSPECTED_TOKEN`)
 */
export const FlagLayer = ({
    inspectedHeroId = null, hoverHeroId = null, hoveredTokenId = null, onHoverHero,
    flagZ = null, tokenZ = null, inspectedTokenId = null, yieldToTokens = false
}) => {
    const flags = useGameState(
        projectFlags,
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    ) || [];
    const mat = useMatSize();
    const fit = useMatFit();
    // On the same art-pixel grid as the Tokens.
    const artScale = boardScaleAt(fit);

    /**
     * ⚠️ Flags sort in among the Tokens: their box must NOT have a z-index of its own, or every
     * flag would sit above or below every Token together. Each carries its own z (`flagZ`).
     */
    return (
        <div
            data-flag-layer
            className="absolute left-0 top-0 pointer-events-none"
            style={flagZ ? { width: mat.w, height: mat.h } : { width: mat.w, height: mat.h, zIndex: MAT_Z.FLAGS }}
        >
            {flags.map((f, i) => {
                const onTokenZ = !f.pinnedTo ? undefined
                    : f.pinnedTo === inspectedTokenId ? MAT_Z.INSPECTED_TOKEN : tokenZ?.get(f.pinnedTo);
                return (
                    <Flag
                        key={`flag-${f.heroId}`}
                        flag={f}
                        z={onTokenZ != null ? onTokenZ + 1 : (flagZ?.get(f.heroId) ?? i * 3)}
                        artScale={artScale}
                        onHover={onHoverHero}
                        boardHovered={hoverHeroId === f.heroId}
                        tokenHovered={f.pinnedTo != null && f.pinnedTo === hoveredTokenId}
                        inspected={inspectedHeroId === f.heroId}
                        yieldToTokens={yieldToTokens}
                    />
                );
            })}
        </div>
    );
};

/**
 * One hero's flag: drag it to give a new order, hover for what they are doing.
 * ⚠️ Two components on purpose. dnd-kit re-renders every component holding a drag hook at each
 * drag start, end and change of target; the hook lives in this thin shell, and the flag
 * (`FlagBody`) is memoised on what it draws, so a drag elsewhere does not redraw it.
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

    // Dragged by the flag itself or by its hero: either way this hero is in the hand.
    const carried = drag.isDragging
        || (anyDrag && activePayload?.kind === DRAG_KIND.FLAG
            && activePayload?.heroId === flag.heroId);

    useEffect(() => {
        if (carried) setHovered(false);
    }, [carried]);

    return (
        <FlagBody
            {...props}
            hovered={hovered}
            onHoverChange={setHovered}
            carried={carried}
            dragRef={drag.setNodeRef}
            dragProps={drag.handleProps}
        />
    );
});

const FlagBody = memo(function FlagBody({
    flag, z = 0, artScale, onHover, boardHovered = false, tokenHovered = false,
    inspected = false, yieldToTokens = false, hovered, onHoverChange, carried, dragRef, dragProps
}) {
    const ref = useRef(null);
    const pulseRef = useRef(null);
    const setRefs = useCallback((node) => {
        ref.current = node;
        dragRef?.(node);
    }, [dragRef]);

    const onToken = flag.pinX != null;
    const box = markerBox(onToken ? { x: flag.pinX, y: flag.pinY } : flag, onToken, artScale, flag.slot);
    const flagPx = box.size;

    const shown = boardHovered || tokenHovered || (!onToken && hovered);
    // A spot's flag fades when the hover ends; while it fades the pointer can still bring it back.
    const down = !shown && !carried;
    const [gone, setGone] = useState(down);
    useEffect(() => {
        if (!down) { setGone(false); return undefined; }
        if (onToken) { setGone(true); return undefined; }
        const timer = setTimeout(() => setGone(true), FLAG_FADE_MS);
        return () => clearTimeout(timer);
    }, [down, onToken]);

    usePosePulse(pulseRef, shown && !carried, PULSE_FOR[artScale] ?? pulseFor(artScale));

    // A Token's flag that is not shown is not drawn at all: nothing of it sits on the Token.
    if (onToken && down) return null;

    return (
        <>
            <button
                ref={setRefs}
                {...dragProps}
                type="button"
                data-flag={flag.heroId}
                data-flag-state={flag.state}
                data-flag-order={flag.order}
                data-flag-pinned={flag.pinnedTo || undefined}
                data-flag-down={down ? 'true' : undefined}
                data-flag-gone={gone ? 'true' : undefined}
                aria-label={`${flag.name}’s flag`}
                onMouseEnter={() => { onHoverChange(true); onHover?.(flag.heroId); }}
                onMouseLeave={() => { onHoverChange(false); onHover?.(null); }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    'absolute p-0 m-0 bg-transparent border-0 outline-none transition-opacity ease-out',
                    // A Token's flag never takes the pointer; over a Token a spot's flag gives it to
                    // the Token; a flag that has faded takes none.
                    onToken || yieldToTokens || gone ? 'pointer-events-none' : 'pointer-events-auto',
                    'cursor-grab active:cursor-grabbing',
                    carried && 'opacity-30',
                    down && 'opacity-0',
                    gone && 'invisible'
                )}
                // ⚠️ `will-change: contents`: the fade (the hover ending, the 30 % in the hand) runs
                // on the main thread. Flags sort in among the Tokens, and on the compositor it put
                // every Token drawn after the flag on a layer of its own, soft and a pixel off until
                // it ended (`tailwind.css`, at `.gi-token-land`).
                style={{
                    left: box.left,
                    top: box.top,
                    width: flagPx,
                    height: flagPx,
                    zIndex: z,
                    transitionDuration: `${FLAG_FADE_MS}ms`,
                    willChange: 'contents'
                }}
            >
                <span ref={pulseRef} data-flag-pulse className="absolute left-0 top-0 block" style={{ width: flagPx, height: flagPx }}>
                    <FlagMark
                        size={flagPx}
                        colour={flag.colour}
                        alt={`${flag.name}’s flag`}
                        outline={flagOutline({ hovered: hovered || boardHovered, selected: inspected, carried })}
                        className="absolute left-0 top-0"
                    />
                </span>
            </button>
        </>
    );
});

/** The pulse's options at an art scale, kept per scale so the pulse is not restarted by a redraw. */
const PULSE_FOR = {};
function pulseFor(artScale) {
    PULSE_FOR[artScale] = { poses: REACH_DOT_PULSE, everyMs: MARKER_PULSE_EVERY_MS, unit: artScale };
    return PULSE_FOR[artScale];
}
