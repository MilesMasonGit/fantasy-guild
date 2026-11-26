import React from 'react';
import { cn } from '../../utils/cn.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useDraggable } from '@dnd-kit/core';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, boardScaleAt, tokenSizeFor } from '../base/TokenSprite.jsx';
import { AnimatedEnemySprite } from './AnimatedEnemySprite.jsx';
import { resolveEnemyAnimationPath } from '../../../utils/AssetManager.js';
import { useMatFit } from './MatFitContext.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as Hand from '../../../systems/board/Hand.js';
import * as FixedTokens from '../../../systems/board/FixedTokens.js';
import * as Landmarks from '../../../systems/board/Landmarks.js';
import { MAP_MODE, isProtectedFromDemolition } from '../../hooks/useMapMode.js';
import { useTokenEvent } from './tokenEvents.js';
import { useTokenDetail } from './useTokenDetail.js';
import { TokenBubbles } from './TokenBubbles.jsx';
import { nameFootOf } from './matMarks.js';
import { TokenNameBadge } from './TokenBadges.jsx';
import { gearStateOf } from './centreAlert.js';
import { TokenHitArt } from './TokenHitArt.jsx';
import { hitSkillOf, strikesLive } from './hitAnimations.js';
import { tokenOutline } from './spriteOutline.js';
import * as TokenGlows from '../../../systems/board/TokenGlows.js';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { useDrawn, isDrawn } from '../../dev/perf/drawSwitches.js';
import { takeSpawn, playSpawn } from './spawnMotion.js';
import { FX_FRAME_MS, playPoses } from './fx/pixelSteps.js';
import { takeSettle, playSettle } from './fx/regionSettle.js';
import { takeArrival, playEventArrival } from './fx/eventArrival.js';
import { useSupportLit } from './supportLit.js';
import { useOrderLit } from './orderLit.js';
import { walkerGlide } from './walkerGlide.js';

/**
 * A walking enemy's boxes follow the engine without React. While `on`, each `ENEMIES_WALKED`
 * writes the Token's current point straight into both boxes' `transform` (the same `translate`
 * the render would write), with the glide for that step (`walkerGlide`: whole screen pixels at
 * `pxPerUnit`, or none while `still`). MatBoard re-renders only when the walker's place in the
 * stack changes, and any render writes the same live point and the same glide (returned here),
 * so React and this never disagree.
 */
function useWalkerFollow({ on, id, boxHalf, pxPerUnit, still, px, py, artRef, overlayRef }) {
    const live = React.useRef(null);
    live.current = { boxHalf, pxPerUnit, still };
    // Where the boxes were last sent, and the glide they carry for that step.
    const sentTo = React.useRef(null);
    const glide = React.useRef(null);
    // What the steps last wrote on both boxes since the last render. A write equal to it is
    // skipped: each is a CSS parse and a restyle inside the tick, and a stroll keeps one glide for
    // many steps. Forgotten on every render, which writes the boxes itself.
    const written = React.useRef({ transition: null, transform: null });
    // A layout effect, so it listens from the commit on, and catches up at once on any step
    // taken between the render and now.
    React.useLayoutEffect(() => {
        if (!on) return undefined;
        const follow = () => {
            const t = BoardState.getTokenById(id);
            if (!t) return;
            const from = sentTo.current;
            const { boxHalf: half, pxPerUnit: unit } = live.current;
            const transition = live.current.still || !from ? 'none' : walkerGlide(t.x - from.x, t.y - from.y, unit);
            sentTo.current = { x: t.x, y: t.y };
            glide.current = transition;
            const transform = `translate(${t.x - half}px, ${t.y - half}px)`;
            const last = written.current;
            const newGlide = transition !== last.transition;
            const newPlace = transform !== last.transform;
            last.transition = transition;
            last.transform = transform;
            if (!newGlide && !newPlace) return;
            for (const el of [artRef.current, overlayRef.current]) {
                if (!el) continue;
                if (newGlide) el.style.transition = transition;
                if (newPlace) el.style.transform = transform;
            }
        };
        follow();
        const unsubscribe = EventBus.subscribe(BOARD_EVENTS.ENEMIES_WALKED, follow, UI_LISTENER);
        return () => {
            unsubscribe();
            glide.current = null;
        };
    }, [on, id, artRef, overlayRef]);
    // After the effect above, so a walk's first step glides from where the boxes stood.
    React.useLayoutEffect(() => {
        sentTo.current = { x: px, y: py };
        written.current.transition = null;
        written.current.transform = null;
    });
    if (!on) return null;
    if (glide.current != null) return glide.current;
    const from = sentTo.current;
    return still || !from ? 'none' : walkerGlide(px - from.x, py - from.y, pxPerUnit);
}

/**
 * How wide a Token's box is drawn, in mat units, for art `artPx` across: the Token's own circle,
 * or the art where the art is the larger.
 */
export function tokenBoxPx(typeId, artPx) {
    return Math.max(artRadiusOf(typeId) * 2, artPx);
}

/** The Guild Hall taking in a flying item: it dips one art pixel for this many effect frames. */
const HALL_DIP_FRAMES = 2;
const AT_REST_STYLE = Object.freeze({ willChange: 'contents' });


const SLIDE_MS = 220;
const SLIDE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * One Token on the free playmat: a circle of art at a point, drawn by its instance id.
 * - **A box at `(x - r, y - r)`, `2r` across**, where `r` is the art radius for its size
 * (`matGeometry`). A move the game makes (a push) is a CSS `left`/`top` slide; a move the
 * player makes is not: the Token is simply where it was let go.
 * - **A drag source and nothing else.** The whole mat is the one drop target (`dropOnMat`).
 * - **Pressed by its own circle, not its art.** The box is drawn as big as the art, and the art
 * may spill past the Token's circle onto its neighbours; none of the drawing takes the pointer.
 * Only a round hit area exactly the Token's circle does (`data-token-hit`, the engine's
 * `artRadiusOf`), so overlapping art never takes a press from the Token whose circle is under
 * the pointer. Where two circles overlap, `MatBoard` decides (nearest centre,
 * `Flags.tokenAtPoint`) and routes the press there; this just draws.
 * Two boxes, not one: the art and the badges are siblings with explicit z, not parent and
 * child. A hero stands beside the Token, and the bubbles have to stay
 * readable in front of that hero. A single box would make its own stacking context and bury
 * them under the hero's feet. That z is written onto the boxes by the mat (`stack`,
 * `stackWriter.js`), not rendered here.
 * - **Picked up through the mat's one Token drag source** (`MatTokenGrab`): a press hands this
 * Token to it (`onPress`), and the mat says which Token is in the hand (`dragging`).
 */
export const MatToken = React.memo(function MatToken({
    id,
    typeId,
    x,
    y,
    walkFacing = null,
    stack = null,
    isHovered = false,
    isRested = false,
    selected = false,
    hasHero = false,
    onInspectToken,
    onClearInspect,
    onOpenRecipes,
    mapMode = null,
    onModeClick,
    dragging = false,
    fightBarHost = null,
    held = false,
    found = null,
    onPress
}) {
    // Perf draw switches: each only stops DRAWING (see drawSwitches.js).
    const bubblesDrawn = useDrawn('bubbles');
    const walkDrawn = useDrawn('walkDraw');
    // The radius and the art both come from the type's footprint, as they do to the engine
    // (`artRadiusOf`).
    const r = artRadiusOf(typeId);

    /**
     * How big this Token's art is drawn, in mat units. The mat's zoom turns `artPx` mat
     * units into exactly `boardArtSteps(fit) × ART_PX` screen pixels, so the sprite is always
     * a whole multiple of its 64px art and never resampled.
     * The box grows to hold the art when the art is the larger of the two, so the spill the
     * art step accepts is drawn, not cropped. The hit area does not grow with it: it stays the
     * Token's own circle, `2r` across, centred in the box.
     * ⚠️ This moves nothing in the engine: `x`/`y`, `hitRadiusOf` and `minGap` are untouched;
     * this is only how much art is painted at the same point.
     */
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, artScale);
    const boxPx = tokenBoxPx(typeId, artPx);
    const boxHalf = boxPx / 2;

    const def = getTokenType(typeId);
    // An unbuilt Foundation floats as floor loot does: it can still be moved. Building on it makes a
    // new Token of another type, which rests.
    const floats = !!def?.foundation;
    const label = tokenName(typeId);
    const isGuildHallToken = typeId === 'token_guild_hall';
    const isPermanent = Placement.isPermanentToken(typeId);
    // Read once per instance: nothing that decides it (the fixture mark, origin, type) changes
    // while the instance lives, except the dev layout tool, which lifts landmarks and the camp's
    // fixtures while it is on. A fixed Token is never picked up.
    // ⚠️ Hovered, a Token only shows its white outline (`tokenOutline`): nothing on it moves.
    const layoutEditing = React.useSyncExternalStore(Landmarks.onLayoutEditingChange, Landmarks.isLayoutEditing);
    const fixed = React.useMemo(
        () => FixedTokens.isFixed(BoardState.getTokenById(id)),
        [id, layoutEditing]   // eslint-disable-line react-hooks/exhaustive-deps
    );
    // Demolish mode dims a Token the engine will not let go, read once per mode change.
    const demolishProtected = React.useMemo(
        () => mapMode === MAP_MODE.DEMOLISH && isProtectedFromDemolition(BoardState.getTokenById(id)),
        [mapMode, id, typeId]   // eslint-disable-line react-hooks/exhaustive-deps
    );

    // A Token with a registered sheet animates on the board only; everything else, and every
    // other surface, keeps the plain static sprite.
    const enemyAnimSrc = def?.enemy ? resolveEnemyAnimationPath(def.sprite) : null;

    // This Token's own details, by id, refreshed only on the events that can change them
    // (routed to this Token alone).
    const detail = useTokenDetail(id, def);

    const usesRemaining = detail?.usesRemaining ?? null;
    const resting = !!detail?.resting;
    // Drawn by its state: a Field empty, growing or ripe, or a resting Token that names a resting
    // sprite. A resting Token with none is its own art greyed (`gi-token-resting`).
    const stateSprite = detail?.stateSprite ?? null;
    const alert = detail?.alert ?? null;
    const heroId = detail?.heroId ?? null;
    const staffed = hasHero || !!heroId;
    const isFiniteToken = !isGuildHallToken && usesRemaining != null;

    React.useEffect(() => {
        if (dragging) onClearInspect?.();
    }, [dragging, onClearInspect]);

    // While it is in the player's hand, a Token is paused (see `Hand.js`): it does not work,
    // grow or run out, any of which could take it off the mat mid-drag and lose the move; a fought
    // enemy's fight ends instead.
    // Released after the drop has been handled, which runs before this clean-up, so whatever
    // waited happens where it was put down.
    React.useEffect(() => {
        if (!dragging) return undefined;
        Hand.setInHand(id, true);
        return () => Hand.setInHand(id, false);
    }, [dragging, id]);

    // A Token the player moved simply IS where they let it go. The `left`/`top` slide exists
    // for moves the game makes (a push); on a drop it would make the Token visibly bounce over
    // from its old spot. It is switched off from the moment a drag starts until just after it
    // ends, which covers the drop's own re-render.
    const [skipSlide, setSkipSlide] = React.useState(false);
    React.useEffect(() => {
        if (dragging) {
            setSkipSlide(true);
            return undefined;
        }
        const timer = setTimeout(() => setSkipSlide(false), SLIDE_MS + 80);
        return () => clearTimeout(timer);
    }, [dragging]);

    const still = skipSlide;

    const [landing, setLanding] = React.useState(false);
    const landingTimer = React.useRef(null);
    const land = () => {
        setLanding(true);
        clearTimeout(landingTimer.current);
        landingTimer.current = setTimeout(() => setLanding(false), 400);
    };
    useTokenEvent(BOARD_EVENTS.TILE_CHANGED, id, (p) => {
        if (p?.typeId) land();
    });
    // A refilled Token hops as it comes back, as a Token does when it lands.
    useTokenEvent(BOARD_EVENTS.TOKEN_RESPAWNED, id, land);
    React.useEffect(() => () => clearTimeout(landingTimer.current), []);

    // The Token stays exactly where it is: its hero walks up and stands beside it
    // (`HeroMotion.standingSpot`). An enemy walking by its spawner steps once a tick, so it
    // glides linearly over one tick, as a walking hero does (`MatHero`). The art, the badges,
    // the bubbles and the alerts all ride in these boxes.
    const walking = walkFacing != null;
    // While it walks, MatBoard does not hand a walker its point (`x` is null, so its steps do
    // not redraw the mat). It is read live here, and each step moves the boxes directly
    // (`useWalkerFollow`, below).
    const livePoint = walking && x == null ? BoardState.getTokenById(id) : null;
    const px = livePoint ? livePoint.x : x;
    const py = livePoint ? livePoint.y : y;
    const left = px - boxHalf;
    const top = py - boxHalf;
    // A Token that can walk (an enemy) is placed and glides by `transform`; every other Token
    // stays on left/top, because a transform on every Token of a busy mat cost more in
    // compositing than it saved. Decided once, at mount, by kind: a box switching styles
    // mid-life would slide in from the mat's corner.
    // ⚠️ Never add `will-change: transform` to these boxes (3x slower). A walker's boxes carry
    // `will-change: contents`, so its glide and its knockback run on the main thread: on the
    // compositor either redrew every Token in front of it soft (tailwind.css, at `.gi-token-land`).
    // So its walk glides in whole screen pixels (`walkerGlide`), or the main thread repaints on
    // every frame of every step.
    const [walker] = React.useState(() => !!def?.enemy);
    const artRef = React.useRef(null);
    const overlayRef = React.useRef(null);
    const walkGlide = useWalkerFollow({
        on: walker && walking && x == null,
        id,
        boxHalf,
        pxPerUnit: fit * (globalThis.devicePixelRatio || 1),
        still: still || !walkDrawn,
        px,
        py,
        artRef,
        overlayRef
    });
    const boxStyle = walker ? {
        left: 0,
        top: 0,
        transform: `translate(${left}px, ${top}px)`,
        willChange: 'contents',
        width: boxPx,
        height: boxPx,
        transition: still || (walking && !walkDrawn)
            ? 'none'
            : walking
                ? (walkGlide ?? 'none')
                : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`
    } : {
        left,
        top,
        width: boxPx,
        height: boxPx,
        transition: still
            ? 'none'
            : walking
                ? `left ${TICK_INTERVAL_MS}ms linear, top ${TICK_INTERVAL_MS}ms linear`
                : `left ${SLIDE_MS}ms ${SLIDE_EASE}, top ${SLIDE_MS}ms ${SLIDE_EASE}`
    };
    const hidden = dragging;
    // In a fight the enemy's bar draws in the fight layer (`FightBarHost`), placed by this box's corner.
    const fightBar = React.useMemo(
        () => (fightBarHost && x != null && y != null ? { host: fightBarHost, left: x - boxHalf, top: y - boxHalf } : null),
        [fightBarHost, x, y, boxHalf]
    );

    const setArtRef = React.useCallback((el) => {
        artRef.current = el;
        stack?.attach(id, 'art', el);
    }, [stack, id]);
    // A press anywhere this Token takes one (its circle, a bubble) picks it up, unless it is
    // fixed.
    const dragProps = React.useMemo(
        () => (fixed ? {} : { onPointerDown: (e) => onPress?.(e, { id, typeId, permanent: isPermanent }, artRef.current) }),
        [fixed, onPress, id, typeId, isPermanent]
    );
    const setOverlayRef = React.useCallback((el) => {
        overlayRef.current = el;
        stack?.attach(id, 'badges', el);
    }, [stack, id]);

    // Arriving in a Region: out of sight until its turn, then it drops in (`fx/regionSettle.js`). A
    // Token drawn before the arrival (the Hall) is told; one drawn after asks as it mounts.
    const settle = () => {
        const wait = takeSettle(id);
        if (wait != null && isDrawn('tokenFx')) playSettle([artRef.current, overlayRef.current], wait);
    };
    useTokenEvent(UI_EVENTS.UI_TOKEN_FX, id, (p) => {
        if (p?.fx === 'settle') settle();
    });
    React.useLayoutEffect(settle, []);   // eslint-disable-line react-hooks/exhaustive-deps

    // Just spawned: pops out of its spawner and slides to its spot, on both boxes alike. Read once,
    // at mount, so a Token already on the mat never replays it.
    React.useLayoutEffect(() => {
        const from = takeSpawn(id);
        if (!from || !isDrawn('spawnMotion')) return;
        const dx = from.x - px;
        const dy = from.y - py;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        // Over the top of the spawner's picture: half its drawn size above its point.
        const over = from.typeId ? tokenSizeFor(TOKEN_SURFACE.BOARD, from.typeId, artScale) / 2 : 0;
        playSpawn(artRef.current, dx, dy, { unit: artScale, over });
        playSpawn(overlayRef.current, dx, dy, { unit: artScale, over });
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    // An event just landed here: its arrival by kind (`fx/eventArrival.js`), read once, at mount.
    React.useLayoutEffect(() => {
        const kind = takeArrival(id);
        if (!kind || !isDrawn('tokenFx')) return;
        playEventArrival([artRef.current, overlayRef.current], kind, { unit: artScale, instanceId: id });
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    const token = React.useMemo(
        () => ({ typeId, instanceId: id, heroId, alert, usesRemaining }),
        [typeId, id, heroId, alert, usesRemaining]
    );

    // The skill whose hit animation this Token plays when struck.
    const hitSkill = React.useMemo(() => hitSkillOf(def), [def]);

    // A Token that has just become this one flashes its white outline as it appears. The glow
    // was raised under this (new) id before it was drawn (`TokenGlows`); read once, at mount.
    const [flashOnMount] = React.useState(() => !!TokenGlows.glowOf(id));

    // The Hall dips a pixel as each flying item lands on it (effect 5): a transform written to its
    // art, no filter and no React render.
    const innerRef = React.useRef(null);
    const isHall = isGuildHallToken || !!def?.isGuildHall;
    const artScaleRef = React.useRef(artScale);
    artScaleRef.current = artScale;
    React.useEffect(() => {
        if (!isHall) return undefined;
        return EventBus.subscribe(UI_EVENTS.PARTICLE_LANDED, (p) => {
            if (p?.landsOn !== 'hall' || !isDrawn('tokenFx')) return;
            playPoses(innerRef.current, [{ ms: HALL_DIP_FRAMES * FX_FRAME_MS, y: 1 }], { unit: artScaleRef.current });
        }, UI_LISTENER);
    }, [isHall]);

    // A sharp coloured outline: gold while its card is open, white hovered, red in alert
    // (`spriteOutline.js`); a worked Token has its task ring instead. It is a generated picture
    // under the art, not a filter.
    // In a map mode the hovered Token takes the mode's colour, or muted grey where the mode cannot
    // act on it.
    const modeUnavailable = isHovered && mapMode ? demolishProtected : false;
    const lit = useSupportLit(id);
    // A carried hero could be ordered here (green), or the hovered hero's job is this (white).
    const orderLit = useOrderLit(id);
    const outline = orderLit === 'workable' && !isHovered
        ? 'work'
        : tokenOutline({ hovered: isHovered, selected, lit: lit || orderLit === 'job' || found === 'match', alert: !!alert, mode: mapMode, unavailable: modeUnavailable });
    const gearState = gearStateOf(detail || {});
    const gear = React.useMemo(
        () => (gearState.show ? {
            show: true,
            pulsing: gearState.pulsing,
            recipe: detail?.recipe,
            isFoundation: !!detail?.isFoundation,
            isField: !!detail?.isField,
            isHideout: !!detail?.isHideout,
            isLaboratory: !!detail?.isLaboratory,
            // The gear covers the middle of the Token, so in a map mode it is the Token's click.
            onClick: () => (mapMode ? onModeClick?.(id) : onOpenRecipes?.(id))
        } : null),
        [gearState.show, gearState.pulsing, detail?.recipe, detail?.isFoundation, detail?.isField, detail?.isHideout, detail?.isLaboratory, mapMode, onModeClick, onOpenRecipes, id]
    );

    // The art, kept as the same element while nothing it draws from changes: a Token redraws
    // on every change to its charges, alert or hero, and its art (hit loop, sprite, its layers)
    // drew again each time for nothing.
    const strikes = strikesLive(heroId, alert);
    const art = React.useMemo(() => {
        const spriteClass = cn('absolute inset-0 m-auto', landing && 'gi-token-land');
        return (
            <TokenHitArt
                instanceId={id}
                skill={hitSkill}
                heroId={heroId}
                active={strikes}
                tokenX={x}
                unit={artScale}
                flashOnMount={flashOnMount}
            >
                {enemyAnimSrc ? (
                    <AnimatedEnemySprite
                        src={enemyAnimSrc}
                        heroId={heroId}
                        walkFacing={walkFacing}
                        alt={label}
                        size={artPx}
                        outline={outline}
                        className={spriteClass}
                    />
                ) : (
                    <TokenSprite
                        typeId={typeId}
                        sprite={stateSprite}
                        surface={TOKEN_SURFACE.BOARD}
                        scale={artScale}
                        hovering={floats}
                        alt={label}
                        outline={outline}
                        className={spriteClass}
                    />
                )}
            </TokenHitArt>
        );
    }, [id, hitSkill, heroId, strikes, x, flashOnMount, enemyAnimSrc, walkFacing, label, artPx, outline, landing, typeId, artScale, stateSprite, floats]);

    return (
        <>
            <div
                ref={setArtRef}
                {...dragProps}
                data-token-id={id}
                data-token-art="true"
                data-token-type={typeId}
                data-guild-hall={isHall ? 'true' : undefined}
                data-tile-alert={alert || undefined}
                data-tile-staffed={staffed ? 'true' : undefined}
                data-outline={outline || undefined}
                data-tile-has-token="true"
                data-tile-finite-token={isFiniteToken ? 'true' : undefined}
                data-token-resting={resting ? 'true' : undefined}
                data-token-state-sprite={stateSprite || undefined}
                data-token-fixed={fixed ? 'true' : undefined}
                data-token-protected={demolishProtected ? 'true' : undefined}
                data-find={found || undefined}
                // A plain click acts only in a map mode; orders are given by drag alone.
                onClick={mapMode ? () => { if (!dragging) onModeClick?.(id); } : undefined}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (mapMode || dragging) return;
                    onInspectToken?.(typeId, e.currentTarget.getBoundingClientRect(), id);
                }}
                style={{
                    ...boxStyle,
                    // The drawing takes no pointer; presses reach these listeners from the hit
                    // circle inside.
                    pointerEvents: 'none',
                    visibility: hidden ? 'hidden' : 'visible'
                }}
                className={cn(
                    'absolute select-none',
                    mapMode || fixed ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                )}
            >
                <div
                    data-token-hit={id}
                    className="absolute"
                    style={{
                        left: boxHalf - r,
                        top: boxHalf - r,
                        width: r * 2,
                        height: r * 2,
                        borderRadius: '50%',
                        pointerEvents: 'auto'
                    }}
                />
                {/* At rest its dip (the Hall taking in loot), its resting greying and landing hop play
                    among the resting Tokens: on the main thread, as tailwind.css explains at
                    `.gi-token-land`. A worked Token is drawn in front of them all. */}
                <div
                    ref={innerRef}
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        resting && !stateSprite && 'gi-token-resting',
                        demolishProtected && 'gi-token-protected',
                        held && !resting && 'gi-token-held'
                    )}
                    style={staffed ? undefined : AT_REST_STYLE}
                >
                    {art}
                </div>
            </div>

            <div
                ref={setOverlayRef}
                data-token-id={id}
                data-token-overlay={id}
                // In a map mode a click on any bubble over the Token (the demolition mark) is a
                // click on the Token: the bubbles take the pointer for their tips.
                onClick={mapMode ? () => { if (!dragging) onModeClick?.(id); } : undefined}
                className="absolute pointer-events-none"
                style={{ ...boxStyle, visibility: hidden ? 'hidden' : 'visible' }}
            >
                <TokenNameBadge
                    name={label}
                    isDragging={hidden}
                    shown={isRested}
                    foot={boxHalf + nameFootOf(typeId, fit)}
                />

                {/**
                 * The '!', the gear and the player's marks in the Token's centre, the recipe
                 * bubble over it while the pointer rests on it, and an enemy's health bar. A worked
                 * Token's cycle is its work bar (`WorkBarLayer`).
                 */}
                {bubblesDrawn && <TokenBubbles
                    instanceId={id}
                    token={isGuildHallToken ? { ...token, usesRemaining: null } : token}
                    isHovered={isRested}
                    pointerOn={isHovered}
                    isDragging={hidden}
                    boxPx={boxPx}
                    artPx={artPx}
                    artUnit={artScale}
                    x={x}
                    y={y}
                    gear={gear}
                    marked={!!detail?.marked}
                    fightBar={fightBar}
                    dragProps={dragProps}
                />}

            </div>

        </>
    );
});

/**
 * A Guild Hall let go anywhere but the mat flies back and says why. A UI-only alert:
 * TILE_EVENT_ALERT is the engine's.
 */
function guildHallMiss(id) {
    return () => {
        EventBus?.publish(UI_EVENTS.UI_TOKEN_ALERT, {
            instanceId: id,
            severity: 'disallow',
            type: 'drop_rejected',
            name: 'Guild Hall',
            title: 'Guild Hall cannot be removed from the playmat.',
            rulesText: null,
            message: 'Guild Hall cannot be removed from the playmat.'
        });
        return null;
    };
}

/**
 * The one drag source every Token on the mat shares. A press on a Token says which Token it is
 * (`pressedRef`) and points the source at that Token's art; the drag that may follow carries
 * that Token.
 * ⚠️ One for all on purpose: dnd-kit re-renders every holder of a drag hook at each drag start,
 * end and change of target (several times per pickup and per drop), and on a busy mat a hook
 * per Token was a hundred components, three hundred on the torture board. This draws nothing.
 * The payload reads the pressed Token when dnd-kit asks for it; the drag provider keeps a copy
 * of it at the drag's start (`DeckDndProvider`).
 * No keyboard sensor exists, so dnd-kit's tabIndex, role and press-space text are not handed
 * to the Tokens: a mat Token is not a Tab stop.
 */
export function MatTokenGrab({ pressedRef, grabRef }) {
    const data = React.useMemo(() => ({
        kind: DRAG_KIND.TOKEN,
        sourceSurface: DND_SURFACE.BOARD,
        get typeId() { return pressedRef.current?.typeId; },
        get from() { return { instanceId: pressedRef.current?.id }; },
        get onMiss() { return pressedRef.current?.permanent ? guildHallMiss(pressedRef.current.id) : undefined; }
    }), [pressedRef]);
    const { setNodeRef, listeners } = useDraggable({ id: MAT_TOKEN_DRAG_ID, data });
    grabRef.current = { setNodeRef, listeners };
    return null;
}

/** The mat Tokens' shared drag source's id. */
export const MAT_TOKEN_DRAG_ID = 'mat-token';
