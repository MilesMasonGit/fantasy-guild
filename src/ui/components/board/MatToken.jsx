import React from 'react';
import { cn } from '../../utils/cn.js';
import { artRadius } from '../../../config/matGeometry.js';
import { ALERT_HINT, PAIR_OFFSET_PX } from './boardConstants.js';
import { tokenSkipLines } from './flagText.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, boardScaleAt, tokenSizeFor } from '../base/TokenSprite.jsx';
import { useMatFit } from './MatFitContext.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import { useTokenEvent } from './tokenEvents.js';
import { TokenProgressBar } from './TokenProgressBar.jsx';
import { TokenEventAlert } from './TokenEventAlert.jsx';
import { EffectProcText } from './EffectProcText.jsx';
import {
    TokenChargeBadge, TokenChargeDeltaFloater, TokenNameBadge, AddHeroBadge, StationGearBadge
} from './TokenBadges.jsx';


/** How long a Token takes to slide to a point the game moved it to (a push). */
const SLIDE_MS = 220;
const SLIDE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * ⭐ **One Token on the free playmat** (slice 1.6c-2) — a circle of art at a
 * point, drawn by its **instance id**. It replaced `BoardTile`, which drew a
 * square of the grid and asked a stopgap adapter which tile each event meant.
 *
 * * **A box at `(x − r, y − r)`, `2r` across**, where `r` is the art radius for
 *   its size (1×1: 64 u, 2×2: 144 u — `matGeometry`). A move the game makes (a
 *   push) is a CSS `left`/`top` slide; a move the player makes is not — the
 *   Token is simply where it was let go.
 * * **A drag source and nothing else.** The whole mat is the one drop target
 *   (`dropOnMat`), so a Token no longer accepts drops on itself; dropping a
 *   copy "on" it still restocks it, because the drop point lands on its spot.
 * * **Hit-tested as a circle** (`border-radius`, not `clip-path`, so art that
 *   spills past the circle is drawn rather than cropped), so the corners of the
 *   box belong to whatever is underneath. Which Token the pointer is on is decided once by
 *   `MatBoard` (nearest centre, `Flags.tokenAtPoint`) — this just draws.
 *
 * ## Two boxes, not one
 * The art and the badges are **siblings with explicit z**, not parent and
 * child. A hero stands between them (D-266: hero left, Token right, 48 px
 * apart), and the badges — the progress bar especially — have to stay readable
 * in front of that hero, exactly as they did on the grid. A single box would
 * make its own stacking context and bury the bar under the hero's feet.
 */
export const MatToken = React.memo(function MatToken({
    id,
    typeId,
    x,
    y,
    size = 1,
    z,
    isHovered = false,
    hasHero = false,
    onInspectToken,
    onClearInspect,
    onAutoAssignHero,
    onOpenRecipes,
    onReturnToVault,
    onRecallHero
}) {
    const r = artRadius(size);

    /**
     * ⭐ FP-99 — how big this Token's art is drawn, in mat units.
     *
     * The mat's transform turns `artPx` mat units into exactly
     * `boardArtSteps(fit) × ART_PX` screen pixels, so the sprite is always a
     * whole multiple of its 64px art and never resampled.
     *
     * ⚠️ The **box** grows to hold the art when the art is the larger of the two,
     * which below 1× it is: the box is the Token's round hit area, and it was
     * once `clip-path`ed, so a box left at the Token's own radius cropped the
     * very spill FPR-6 accepts. A 2×2's
     * 288 u circle is already wider than its 256 u art, and `max` leaves that —
     * and every 1:1 case — exactly as it was.
     *
     * ⚠️ This moves nothing in the engine. `x`/`y`, `hitRadiusOf` and `minGap`
     * are untouched; this is only how much art is painted at the same point.
     */
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, size, artScale);
    const boxPx = Math.max(r * 2, artPx);
    const boxHalf = boxPx / 2;

    const def = getTokenType(typeId);
    const label = tokenName(typeId);
    const isGuildHallToken = typeId === 'token_guild_hall';
    const isPermanent = !!(def?.cannotLeaveBoard || def?.isGuildHall || isGuildHallToken);

    /**
     * This Token's own details, read by id and refreshed only on the events that
     * can change them. ⚠️ Never `board:progress`: that fires every tick for
     * every working Token, and the bar below draws it imperatively instead.
     */
    const detail = useGameState(
        () => {
            const instance = BoardState.getTokenById(id);
            if (!instance) return null;
            const stationSkill = def ? stationSkillOf(def) : null;
            return {
                usesRemaining: instance.usesRemaining ?? null,
                alert: instance.alert || null,
                disallowed: Flags.isDisallowed(instance),
                heroId: BoardState.workerOf(id),
                stationSkill,
                recipe: stationSkill ? StationRecipe.selectedRecipe(instance, def) : null,
                requiresHero: def ? (def.requiresHero !== false) : true
            };
        },
        [
            BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.ALERT_CHANGED,
            BOARD_EVENTS.HERO_MOVED,
            BOARD_EVENTS.TOKEN_CHARGES_CHANGED,
            'state_changed'
        ],
        null,
        { deps: [id] }
    );

    const usesRemaining = detail?.usesRemaining ?? null;
    const alert = detail?.alert ?? null;
    const heroId = detail?.heroId ?? null;
    const staffed = hasHero || !!heroId;
    const isFiniteToken = !isGuildHallToken && usesRemaining != null;

    const drag = useEntityDrag({
        id: `token-${id}`,
        kind: DRAG_KIND.TOKEN,
        payload: {
            typeId,
            from: { instanceId: id },
            onMiss: isPermanent ? () => {
                EventBus?.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                    instanceId: id,
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
        sourceSurface: DND_SURFACE.BOARD
    });

    React.useEffect(() => {
        if (drag.isDragging) onClearInspect?.();
    }, [drag.isDragging, onClearInspect]);

    // ⭐ A Token the player moved simply IS where they let it go (owner,
    // 2026-09-21). The `left`/`top` slide exists for moves the game makes — a
    // push — and used to play on a drop too, so the Token visibly bounced over
    // from its old spot. It is switched off from the moment a drag starts until
    // just after it ends, which covers the drop's own re-render.
    const [skipSlide, setSkipSlide] = React.useState(false);
    React.useEffect(() => {
        if (drag.isDragging) {
            setSkipSlide(true);
            return undefined;
        }
        const timer = setTimeout(() => setSkipSlide(false), SLIDE_MS + 80);
        return () => clearTimeout(timer);
    }, [drag.isDragging]);

    // The landing beat: something arrived here (D-230).
    const [landing, setLanding] = React.useState(false);
    const landingTimer = React.useRef(null);
    useTokenEvent(BOARD_EVENTS.TILE_CHANGED, id, (p) => {
        if (!p?.typeId) return;
        setLanding(true);
        clearTimeout(landingTimer.current);
        landingTimer.current = setTimeout(() => setLanding(false), 400);
    });
    React.useEffect(() => () => clearTimeout(landingTimer.current), []);

    /**
     * FP-60: hovering a Token also says which flags passed it over, and why.
     * Skips change without an event (a flag re-checks every second), so they
     * are read when the pointer arrives rather than kept in the projection.
     */
    const [skipLines, setSkipLines] = React.useState([]);
    React.useEffect(() => {
        if (!isHovered) return;
        setSkipLines(tokenSkipLines(id));
    }, [isHovered, id]);

    const alertHint = alert ? ALERT_HINT[alert] : null;
    const hoverTitle = [
        alertHint,
        detail?.disallowed ? 'Heroes may not work this' : null,
        ...(isHovered ? skipLines : [])
    ].filter(Boolean).join('\n') || undefined;

    // A hero and their Token slide apart on a staffed spot (D-266): hero left,
    // Token right. A 2×2 is big enough to stand on, so only a 1×1 shifts.
    const shift = (staffed && size === 1) ? PAIR_OFFSET_PX : 0;
    const left = x - boxHalf + shift;
    const top = y - boxHalf;
    const boxStyle = {
        left,
        top,
        width: boxPx,
        height: boxPx,
        transition: skipSlide
            ? 'none'
            : `left ${SLIDE_MS}ms ${SLIDE_EASE}, top ${SLIDE_MS}ms ${SLIDE_EASE}`
    };
    const hidden = drag.isDragging;

    const token = React.useMemo(
        () => ({ typeId, instanceId: id, heroId, alert, usesRemaining }),
        [typeId, id, heroId, alert, usesRemaining]
    );

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (heroId) onRecallHero?.(heroId);
        else if (!isGuildHallToken) onReturnToVault?.(id);
    };

    const glow = staffed && !alert ? 'gi-glow-active' : null;

    return (
        <>
            {/* The art, and the only thing the pointer can grab. */}
            <div
                ref={drag.setNodeRef}
                {...drag.handleProps}
                data-token-id={id}
                data-token-art="true"
                data-guild-hall={isGuildHallToken ? 'true' : undefined}
                title={hoverTitle}
                data-tile-alert={alert || undefined}
                data-tile-staffed={staffed ? 'true' : undefined}
                data-tile-has-token="true"
                data-tile-finite-token={isFiniteToken ? 'true' : undefined}
                onContextMenu={handleContextMenu}
                onClick={(e) => {
                    if (drag.isDragging) return;
                    onInspectToken?.(typeId, e.currentTarget.getBoundingClientRect(), id);
                }}
                onDoubleClick={(e) => onInspectToken?.(typeId, e.currentTarget.getBoundingClientRect(), id)}
                style={{
                    ...boxStyle,
                    zIndex: z,
                    // Rounded, not clipped: the corners of the box do not catch
                    // the pointer, and art that spills past the circle is not
                    // cropped (owner feedback, slice 1.9 work).
                    borderRadius: '50%',
                    visibility: hidden ? 'hidden' : 'visible'
                }}
                className={cn(
                    'absolute select-none pointer-events-auto cursor-grab active:cursor-grabbing',
                    glow
                )}
            >
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        isHovered && 'gi-token-hover-pulse'
                    )}
                >
                    <TokenSprite
                        typeId={typeId}
                        surface={TOKEN_SURFACE.BOARD}
                        scale={artScale}
                        alt={label}
                        className={cn('absolute inset-0 m-auto', landing && 'gi-token-land')}
                    />
                </div>
            </div>

            {/* Everything written on the Token, in front of any hero on it. */}
            <div
                data-token-id={id}
                data-token-overlay={id}
                className="absolute pointer-events-none"
                style={{ ...boxStyle, zIndex: z + 2, visibility: hidden ? 'hidden' : 'visible' }}
            >
                <TokenNameBadge name={label} isDragging={hidden} isHovered={isHovered} />

                <TokenChargeBadge
                    usesRemaining={usesRemaining}
                    isDragging={hidden}
                    isHovered={isHovered}
                    hasHero={staffed}
                    alert={alert}
                />

                <TokenChargeDeltaFloater instanceId={id} hasHero={staffed} alert={alert} />

                {detail?.stationSkill && (
                    <StationGearBadge
                        isHovered={isHovered}
                        isDragging={hidden}
                        recipe={detail?.recipe}
                        onClick={() => onOpenRecipes?.(id)}
                    />
                )}

                {/* Disallowed (FP-35): a dim ⊘ in the bottom-left, always shown (FPP-8) */}
                {detail?.disallowed && (
                    <div
                        data-tile-disallowed="true"
                        aria-label="Heroes may not work this"
                        className="absolute left-1.5 bottom-1 z-30 pointer-events-none select-none text-[26px] leading-none font-bold text-stone-200/55"
                        style={{ textShadow: '0 1px 2px #000, 0 0 3px #000' }}
                    >
                        ⊘
                    </div>
                )}

                {detail?.requiresHero !== false && !staffed && !detail?.disallowed && (
                    <AddHeroBadge
                        isHovered={isHovered}
                        isDragging={hidden}
                        onClick={() => onAutoAssignHero?.(id)}
                    />
                )}

                <TokenProgressBar
                    instanceId={id}
                    token={token}
                    isHovered={isHovered}
                    alert={alert}
                />

                <TokenEventAlert instanceId={id} />
                <EffectProcText instanceId={id} />
            </div>
        </>
    );
});

export default MatToken;
