import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag, useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z } from './matLayers.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { GameState } from '../../../state/GameState.js';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { FlagMark } from './FlagMark.jsx';
import { flagOutline } from './spriteOutline.js';
import { flagTooltip } from './flagText.js';
import { FloatingTip } from '../base/Tooltip.jsx';
import { useMatFit } from './MatFitContext.jsx';
import { FLAG_PX, PENNANT_ART_PX, POLE_BASE, pinnedFlagPoint } from './flagGeometry.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * FlagLayer: the pennant that marks each hero's order, an absolute overlay in mat units.
 * - **A Token order**: the pennant stands at the top of the Token (`pinnedFlagPoint`), its pole
 * planted in the art, and sorts just behind that Token (`MatBoard`), so it is drawn **behind the
 * Token's sprite** and shows through its transparent parts. It stays while the order stands.
 * - **A spot order** ("go here"): the pennant stands on the spot while the hero walks there and
 * fades out once they arrive; hovering the hero (or their roster tab) shows it again.
 * - **No order** (at home by the Guild Hall), or a job gone for good: no pennant.
 * - Dragging the pennant is dragging its hero (`DRAG_KIND.FLAG`): the drop gives a new order
 * (`Orders.orderAt`). Hover for the hero's name and what they are doing.
 * - **No hitbox over Tokens, but the cloth**: wherever the pointer is on a Token's art circle,
 * every pennant lets it through (`yieldToTokens`, set by `MatBoard`), except its cloth where it
 * is drawn in front of that Token (`flagCloth.js`).
 * The radius ring of the old area flags is gone: an order has no reach.
 */

/** How long a spot's pennant takes to fade once its hero arrives, in ms. */
export const PENNANT_FADE_MS = 700;

/** A flat, comparable projection of every pennant, in planting order. */
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
        const order = pinned ? 'token' : (Flags.isSpot(flag) && !flag.needsJob ? 'spot' : null);
        if (!order) continue;
        const drawn = pinned ? pinnedFlagPoint(pinned, artRadiusOf(pinned.typeId)) : flag;
        out.push({
            heroId,
            x: flag.x,
            y: flag.y,
            drawX: drawn.x,
            drawY: drawn.y,
            pinnedTo: pinned ? pinned.id : null,
            order,
            // A spot's pennant is down once the hero stands there.
            arrived: order === 'spot' && status.state === 'idle',
            state: status.state,
            name: hero?.name || 'Hero'
        });
    }
    return out;
}

/**
 * @param {string|null} inspectedHeroId the hero whose panel is open
 * @param {string|null} hoverHeroId a hero hovered on the mat or on their roster tab
 * @param {(heroId: string|null) => void} onHoverHero
 * @param {Map<string, number>|null} flagZ each pennant's z in the mat's order (`matStackOrder`)
 */
export const FlagLayer = ({ inspectedHeroId = null, hoverHeroId = null, onHoverHero, flagZ = null, yieldToTokens = false }) => {
    const flags = useGameState(
        projectFlags,
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.HEROES_WALKED, BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    ) || [];
    const mat = useMatSize();
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    // The pennant on the same art-pixel grid as the Tokens.
    const flagPx = PENNANT_ART_PX * artScale;

    /**
     * ⚠️ Pennants sort in among the Tokens: their box must NOT have a z-index of its own, or every
     * pennant would sit above or below every Token together. Each carries its own z (`flagZ`).
     */
    return (
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
    );
};

/**
 * One hero's pennant: drag it to give a new order, hover for what they are doing.
 * ⚠️ Two components on purpose. dnd-kit re-renders every component holding a drag hook at each
 * drag start, end and change of target; the hook lives in this thin shell, and the pennant
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

    // Dragged by the pennant itself or by its hero: either way this hero is in the hand.
    const carried = drag.isDragging
        || (anyDrag && (activePayload?.kind === DRAG_KIND.FLAG || activePayload?.kind === DRAG_KIND.HERO)
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

    // A spot's pennant fades once its hero is there, and comes back while the hero is hovered.
    const down = flag.arrived && !hovered && !boardHovered && !inspected;
    const [gone, setGone] = useState(down);
    useEffect(() => {
        if (!down) { setGone(false); return undefined; }
        const timer = setTimeout(() => setGone(true), PENNANT_FADE_MS);
        return () => clearTimeout(timer);
    }, [down]);

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
                aria-label={`${flag.name}’s pennant`}
                onMouseEnter={() => { onHoverChange(true); onHover?.(flag.heroId); }}
                onMouseLeave={() => { onHoverChange(false); onHover?.(null); }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    'absolute p-0 m-0 bg-transparent border-0 outline-none transition-opacity ease-out',
                    // Over a Token the pointer goes to the Token; a pennant that is down takes none.
                    yieldToTokens || gone ? 'pointer-events-none' : 'pointer-events-auto',
                    'cursor-grab active:cursor-grabbing',
                    carried && 'opacity-30',
                    down && 'opacity-0',
                    gone && 'invisible'
                )}
                style={{
                    left: originLeft,
                    top: originTop,
                    width: flagPx,
                    height: flagPx,
                    zIndex: z,
                    transitionDuration: `${PENNANT_FADE_MS}ms`
                }}
            >
                <FlagMark
                    size={flagPx}
                    alt={`${flag.name}’s pennant`}
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
 * The pennant's hover text: the hero, what they are doing, and why their Token is passed over
 * (a tool they no longer hold). Refreshed twice a second while shown, because waiting changes
 * without an event.
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
