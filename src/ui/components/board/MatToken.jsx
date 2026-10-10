import React from 'react';
import { cn } from '../../utils/cn.js';
import { artRadiusOf, isSmallToken } from '../../../config/matGeometry.js';
import { tokenSkipLines } from './flagText.js';
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
import * as Flags from '../../../systems/board/Flags.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import * as Hand from '../../../systems/board/Hand.js';
import { useTokenEvent } from './tokenEvents.js';
import { useTokenDetail } from './useTokenDetail.js';
import { TokenBubbles } from './TokenBubbles.jsx';
import { HEALTH_BAR_LIFT_U } from './healthBar.js';
import { SMALL_OVERHANG_U, spawnerRing, questRing } from './ringRow.js';
import { TokenNameBadge } from './TokenBadges.jsx';
import { gearStateOf } from './centreAlert.js';
import { TokenHitArt } from './TokenHitArt.jsx';
import { hitSkillOf, strikesLive } from './hitAnimations.js';
import { tokenOutline } from './spriteOutline.js';
import * as TokenGlows from '../../../systems/board/TokenGlows.js';
import { PassiveProductionTooltip } from './PassiveProductionTooltip.jsx';
import * as PassiveProduction from '../../../systems/board/PassiveProduction.js';
import { QuestTooltip } from './QuestTooltip.jsx';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { setTutorialAideTarget } from '../base/TutorialAideOverlay.jsx';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { useDrawn, isDrawn } from '../../dev/perf/drawSwitches.js';
import { QuestPosterItem } from './QuestPoster.jsx';
import { takeSpawn, playSpawn } from './spawnMotion.js';

/**
 * A walking enemy's boxes follow the engine without React. While `on`, each `ENEMIES_WALKED`
 * writes the Token's current point straight into both boxes' `transform` (the same `translate`
 * the render would write; the one-tick linear glide is already on them). MatBoard re-renders
 * only when the walker's place in the stack changes, and any render writes the same live
 * point, so React and this never disagree.
 */
function useWalkerFollow(on, id, boxHalf, artRef, overlayRef) {
    const half = React.useRef(boxHalf);
    half.current = boxHalf;
    // A layout effect, so it listens from the commit on, and catches up at once on any step
    // taken between the render and now.
    React.useLayoutEffect(() => {
        if (!on) return undefined;
        const follow = () => {
            const t = BoardState.getTokenById(id);
            if (!t) return;
            const transform = `translate(${t.x - half.current}px, ${t.y - half.current}px)`;
            if (artRef.current) artRef.current.style.transform = transform;
            if (overlayRef.current) overlayRef.current.style.transform = transform;
        };
        follow();
        return EventBus.subscribe(BOARD_EVENTS.ENEMIES_WALKED, follow, UI_LISTENER);
    }, [on, id, artRef, overlayRef]);
}

/**
 * How wide a Token's box is drawn, in mat units, for art `artPx` across: the Token's own circle,
 * or the art where the art is the larger.
 */
export function tokenBoxPx(typeId, artPx) {
    return Math.max(artRadiusOf(typeId) * 2, artPx);
}

const RECEIVED_MS = 350;


const SLIDE_MS = 220;
const SLIDE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * One Token on the free playmat: a circle of art at a point, drawn by its instance id.
 * - **A box at `(x - r, y - r)`, `2r` across**, where `r` is the art radius for its size
 * (`matGeometry`). A move the game makes (a push) is a CSS `left`/`top` slide; a move the
 * player makes is not: the Token is simply where it was let go.
 * - **A drag source and nothing else.** The whole mat is the one drop target (`dropOnMat`);
 * dropping a copy on a Token still restocks it, because the drop point lands on its spot.
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
    selected = false,
    hasHero = false,
    onInspectToken,
    onClearInspect,
    onOpenRecipes,
    onRecallHero,
    disallowMode = false,
    onFlipDisallow,
    dragging = false,
    onPress
}) {
    // Perf draw switches: each only stops DRAWING (see drawSwitches.js).
    const bubblesDrawn = useDrawn('bubbles');
    const tooltipsDrawn = useDrawn('tooltips');
    const walkDrawn = useDrawn('walkDraw');
    // The radius and the art both come from the type (footprint and `artSize` alike), so a
    // small Token is half size here exactly as it is to the engine (`artRadiusOf`).
    const r = artRadiusOf(typeId);
    const small = isSmallToken(typeId);

    /**
     * How big this Token's art is drawn, in mat units. The mat's transform turns `artPx` mat
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
    const label = tokenName(typeId);
    const isGuildHallToken = typeId === 'token_guild_hall';
    const isPermanent = !!(def?.cannotLeaveBoard || def?.isGuildHall || isGuildHallToken);

    // A Token with a registered sheet animates on the board only; everything else, and every
    // other surface, keeps the plain static sprite.
    const enemyAnimSrc = def?.enemy ? resolveEnemyAnimationPath(def.sprite) : null;

    // This Token's own details, by id, refreshed only on the events that can change them
    // (routed to this Token alone).
    const detail = useTokenDetail(id, def);

    // The timer bubble polls this; stable per Token so its poll is not reset. A resting Token
    // counts down to its refill (a regrow has none: it becomes its Sapling at once); a growing
    // one counts down its growth (`everyMs` is the whole growth time); a turning one to its next
    // roll, over the roll cycle (on a turned Token the ORIGINAL's, as the roll itself uses,
    // `turnTimingOf`).
    const readTimer = React.useCallback(() => {
        const instance = BoardState.getTokenById(id);
        const rest = Respawn.nextRespawn(instance);
        if (rest) return rest.mode === 'refill' ? { kind: 'respawn', ...rest, everyMs: rest.totalMs } : null;
        const grow = TimedChanges.nextGrowth(instance);
        if (grow) return { kind: 'grow', ...grow, everyMs: Number(getTokenType(instance.typeId)?.grows?.afterMs) || 0 };
        const roll = TimedChanges.nextTurnRoll(instance);
        return roll ? { kind: 'turn', ...roll, everyMs: TimedChanges.turnTimingOf(instance).everyMs } : null;
    }, [id]);

    const spawnerCounts = detail?.spawnerCounts ?? null;
    const quest = detail?.quest ?? null;
    const spawnerBubble = React.useMemo(
        () => spawnerRing(spawnerCounts),
        [spawnerCounts?.count, spawnerCounts?.cap]   // eslint-disable-line react-hooks/exhaustive-deps
    );
    const questBubble = React.useMemo(
        () => questRing(quest),
        [quest?.currentCount, quest?.requiredCount, quest?.title]   // eslint-disable-line react-hooks/exhaustive-deps
    );
    const questDone = !!quest?.done;

    const usesRemaining = detail?.usesRemaining ?? null;
    const resting = !!detail?.resting;
    const alert = detail?.alert ?? null;
    const heroId = detail?.heroId ?? null;
    const staffed = hasHero || !!heroId;
    const isFiniteToken = !isGuildHallToken && usesRemaining != null;

    React.useEffect(() => {
        if (dragging) onClearInspect?.();
    }, [dragging, onClearInspect]);

    // While it is in the player's hand, a Token is paused (see `Hand.js`): it does not work,
    // fight, grow or run out, any of which could take it off the mat mid-drag and lose the move.
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

    /**
     * Hovering a Token also says which flags passed it over, and why. Skips change without an
     * event (a flag re-checks every second), so they are read when the pointer arrives rather
     * than kept in the projection.
     */
    const [skipLines, setSkipLines] = React.useState([]);
    React.useEffect(() => {
        if (!isHovered) return;
        setSkipLines(tokenSkipLines(id));
    }, [isHovered, id]);

    // A Token with Passive Production (the Guild Hall) shows what it pays in a game-styled
    // tooltip with a live next-in, not the native title. Read only while hovered.
    const showPassive = isHovered && PassiveProduction.hasPassiveProduction(BoardState.getTokenById(id));

    // Hovering a quest Token reads it (`QuestTooltip`), and a tutorial step still to do lights
    // its target (`TutorialAideOverlay`).
    const showQuestTip = isHovered && !!quest;
    const aideStep = isHovered && quest?.tutorial && !questDone ? quest.id : null;
    React.useEffect(() => {
        if (!aideStep) return undefined;
        setTutorialAideTarget(aideStep);
        return () => setTutorialAideTarget(null);
    }, [aideStep]);

    const hoverTitle = [
        detail?.disallowed ? 'Heroes may not work this' : null,
        ...(isHovered ? skipLines : [])
    ].filter(Boolean).join('\n') || undefined;

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
    // ⚠️ Never add `will-change` to these boxes (3x slower).
    const [walker] = React.useState(() => !!def?.enemy);
    const boxStyle = walker ? {
        left: 0,
        top: 0,
        transform: `translate(${left}px, ${top}px)`,
        width: boxPx,
        height: boxPx,
        transition: skipSlide || (walking && !walkDrawn)
            ? 'none'
            : walking
                ? `transform ${TICK_INTERVAL_MS}ms linear`
                : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`
    } : {
        left,
        top,
        width: boxPx,
        height: boxPx,
        transition: skipSlide
            ? 'none'
            : walking
                ? `left ${TICK_INTERVAL_MS}ms linear, top ${TICK_INTERVAL_MS}ms linear`
                : `left ${SLIDE_MS}ms ${SLIDE_EASE}, top ${SLIDE_MS}ms ${SLIDE_EASE}`
    };
    const hidden = dragging;

    const artRef = React.useRef(null);
    const overlayRef = React.useRef(null);
    const setArtRef = React.useCallback((el) => {
        artRef.current = el;
        stack?.attach(id, 'art', el);
    }, [stack, id]);
    // A press anywhere this Token takes one (its circle, a bubble) picks it up.
    const dragProps = React.useMemo(
        () => ({ onPointerDown: (e) => onPress?.(e, { id, typeId, permanent: isPermanent }, artRef.current) }),
        [onPress, id, typeId, isPermanent]
    );
    const setOverlayRef = React.useCallback((el) => {
        overlayRef.current = el;
        stack?.attach(id, 'badges', el);
    }, [stack, id]);
    useWalkerFollow(walker && walking && x == null, id, boxHalf, artRef, overlayRef);

    // Just spawned: pops out of its spawner and slides to its spot, on both boxes alike. Read once,
    // at mount, so a Token already on the mat never replays it.
    React.useLayoutEffect(() => {
        const from = takeSpawn(id);
        if (!from || !isDrawn('spawnMotion')) return;
        const dx = from.x - px;
        const dy = from.y - py;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        playSpawn(artRef.current, dx, dy);
        playSpawn(overlayRef.current, dx, dy);
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    const token = React.useMemo(
        () => ({ typeId, instanceId: id, heroId, alert, usesRemaining }),
        [typeId, id, heroId, alert, usesRemaining]
    );

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // In disallow mode a Token only flips; nothing is recalled.
        if (disallowMode) return;
        if (heroId) onRecallHero?.(heroId);
    };

    // The skill whose hit animation this Token plays when struck.
    const hitSkill = React.useMemo(() => hitSkillOf(def), [def]);

    // A Token that has just become this one glows as it appears. The glow was raised under
    // this (new) id before it was drawn (`TokenGlows`).
    const [transformGlow, setTransformGlow] = React.useState(() => TokenGlows.glowOf(id));
    React.useEffect(() => {
        if (!transformGlow) return undefined;
        const timer = setTimeout(() => setTransformGlow(null), transformGlow.remainingMs);
        return () => clearTimeout(timer);
    }, [transformGlow]);
    const glowDelay = transformGlow ? `-${TokenGlows.GLOW_MS - transformGlow.remainingMs}ms` : undefined;

    const [received, setReceived] = React.useState(false);
    const receivedTimer = React.useRef(null);
    const isHall = isGuildHallToken || !!def?.isGuildHall;
    React.useEffect(() => {
        if (!isHall) return undefined;
        const unsub = EventBus.subscribe(UI_EVENTS.PARTICLE_LANDED, (p) => {
            if (p?.landsOn !== 'hall') return;
            setReceived(true);
            clearTimeout(receivedTimer.current);
            receivedTimer.current = setTimeout(() => setReceived(false), RECEIVED_MS);
        }, UI_LISTENER);
        return () => { unsub?.(); clearTimeout(receivedTimer.current); };
    }, [isHall]);

    // A sharp coloured outline: white hovered or selected, red in alert, green worked
    // (`spriteOutline.js`). It is a generated picture under the art, not a filter.
    const outline = tokenOutline({ hovered: isHovered, selected, alert: !!alert, working: staffed });
    const gearState = gearStateOf(detail || {});
    const gear = React.useMemo(
        () => (gearState.show ? {
            show: true,
            pulsing: gearState.pulsing,
            recipe: detail?.recipe,
            isFoundation: !!detail?.isFoundation,
            onClick: () => (disallowMode ? onFlipDisallow?.(id) : onOpenRecipes?.(id))
        } : null),
        [gearState.show, gearState.pulsing, detail?.recipe, detail?.isFoundation, disallowMode, onFlipDisallow, onOpenRecipes, id]
    );

    return (
        <>
            <div
                ref={setArtRef}
                {...dragProps}
                data-token-id={id}
                data-token-art="true"
                data-token-type={typeId}
                data-token-small={small ? 'true' : undefined}
                data-guild-hall={isHall ? 'true' : undefined}
                data-hall-received={received ? 'true' : undefined}
                data-quest-claimable={questDone ? 'true' : undefined}
                title={hoverTitle}
                data-tile-alert={alert || undefined}
                data-tile-staffed={staffed ? 'true' : undefined}
                data-outline={outline || undefined}
                data-tile-has-token="true"
                data-tile-finite-token={isFiniteToken ? 'true' : undefined}
                data-token-resting={resting ? 'true' : undefined}
                onContextMenu={handleContextMenu}
                onClick={(e) => {
                    if (dragging) return;
                    // In disallow mode a click flips the Token allowed/disallowed and does
                    // nothing else; it never claims a quest.
                    if (disallowMode) { onFlipDisallow?.(id); return; }
                    // Click a done quest to claim it. The engine drops the reward as loot and
                    // removes the Token. `skipSlide` is still on just after a drop, so the
                    // drop's own click never claims. A quest not yet done inspects.
                    if (questDone) {
                        if (skipSlide) return;
                        const result = QuestTokens.claimQuest(id);
                        if (result && result.success === false && result.reason) {
                            NotificationSystem.warning(result.reason);
                        }
                        return;
                    }
                    onInspectToken?.(typeId, e.currentTarget.getBoundingClientRect(), id);
                }}
                onDoubleClick={(e) => {
                    if (disallowMode) return;
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
                    disallowMode || questDone ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
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
                {/**
                 * A done quest glows until claimed: the transform glow's gold, held as a halo
                 * behind the art that breathes (`gi-quest-ready`), spilling past it.
                 */}
                {questDone && (
                    <div
                        aria-hidden="true"
                        data-quest-glow="true"
                        className="gi-quest-ready absolute pointer-events-none"
                        style={{ inset: '-22%' }}
                    />
                )}
                <div
                    className={cn(
                        'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                        isHovered && 'gi-token-hover-hop',
                        received && 'brightness-125 saturate-125',
                        resting && 'gi-token-resting'
                    )}
                >
                    <TokenHitArt
                        instanceId={id}
                        skill={hitSkill}
                        heroId={heroId}
                        active={strikesLive(heroId, alert)}
                        tokenX={x}
                        className={transformGlow ? 'gi-transform-flash' : null}
                    >
                        {enemyAnimSrc ? (
                            <AnimatedEnemySprite
                                src={enemyAnimSrc}
                                heroId={heroId}
                                walkFacing={walkFacing}
                                alt={label}
                                size={artPx}
                                outline={outline}
                                className={cn('absolute inset-0 m-auto', landing && 'gi-token-land')}
                            />
                        ) : (
                            <TokenSprite
                                typeId={typeId}
                                surface={TOKEN_SURFACE.BOARD}
                                scale={artScale}
                                alt={label}
                                outline={outline}
                                className={cn('absolute inset-0 m-auto', landing && 'gi-token-land')}
                            />
                        )}
                    </TokenHitArt>
                    {quest?.itemId && (
                        <QuestPosterItem itemId={quest.itemId} boxPx={boxPx} artPx={artPx} fit={fit} />
                    )}
                </div>
                {transformGlow && (
                    <div
                        aria-hidden="true"
                        data-transform-glow="true"
                        className="gi-transform-glow absolute inset-0 pointer-events-none"
                        style={glowDelay ? { animationDelay: glowDelay } : undefined}
                    />
                )}
            </div>

            <div
                ref={setOverlayRef}
                data-token-id={id}
                data-token-overlay={id}
                data-quest-token={quest ? id : undefined}
                data-quest-done={quest ? String(questDone) : undefined}
                className="absolute pointer-events-none"
                style={{ ...boxStyle, visibility: hidden ? 'hidden' : 'visible' }}
            >
                <TokenNameBadge name={label} isDragging={hidden} isHovered={isHovered} lift={Math.max(small ? SMALL_OVERHANG_U : 0, def?.enemy ? HEALTH_BAR_LIFT_U : 0)} />

                {/**
                 * The bubbles, each in its own spot inside the Token's box: timer, gear, spawner
                 * count, disallow mark, cycle, quest progress, charges. A small Token keeps
                 * FULL-size bubbles and they hang off its box. They carry the -1 floater.
                 */}
                {bubblesDrawn && <TokenBubbles
                    instanceId={id}
                    token={isGuildHallToken ? { ...token, usesRemaining: null } : token}
                    isHovered={isHovered}
                    isDragging={hidden}
                    boxPx={boxPx}
                    small={small}
                    spawner={spawnerBubble}
                    quest={questBubble}
                    readTimer={detail?.turns || detail?.grows || resting ? readTimer : null}
                    gear={gear}
                    disallowed={!!detail?.disallowed}
                    dragProps={dragProps}
                />}

            </div>

            {tooltipsDrawn && showPassive && !hidden && <PassiveProductionTooltip instanceId={id} />}
            {tooltipsDrawn && showQuestTip && !hidden && <QuestTooltip instanceId={id} quest={quest} />}
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

export default MatToken;
