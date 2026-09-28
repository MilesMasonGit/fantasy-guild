import React from 'react';
import { cn } from '../../utils/cn.js';
import { artRadius } from '../../../config/matGeometry.js';
import { ALERT_HINT } from './boardConstants.js';
import { tokenSkipLines } from './flagText.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, boardScaleAt, tokenSizeFor } from '../base/TokenSprite.jsx';
import { AnimatedEnemySprite } from './AnimatedEnemySprite.jsx';
import { resolveEnemyAnimationPath } from '../../../utils/AssetManager.js';
import { useMatFit } from './MatFitContext.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import { useTokenEvent } from './tokenEvents.js';
import { TokenBadgeRow } from './TokenBadgeRow.jsx';
import { ringRowOffset, spawnerRing, questRing } from './ringRow.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import { TokenCentreAlert } from './TokenEventAlert.jsx';
import { EffectProcText } from './EffectProcText.jsx';
import {
    TokenNameBadge, StationGearBadge,
    DisallowBadge
} from './TokenBadges.jsx';
import { gearStateOf } from './centreAlert.js';
import { TokenHitArt } from './TokenHitArt.jsx';
import { hitSkillOf, strikesLive } from './hitAnimations.js';
import * as TokenGlows from '../../../systems/board/TokenGlows.js';
import { TrickleTooltip, hasTrickle } from './TrickleTooltip.jsx';
import { QuestTooltip } from './QuestTooltip.jsx';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { setTutorialAideTarget } from '../base/TutorialAideOverlay.jsx';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/**
 * A quest Token's quest as a flat projection for `detail` (B6.2): what the
 * ring, the glow and the tooltip draw. Rebuilt on every read, so the
 * projection's deep compare sees progress (CR-044). Null for any other Token.
 */
function questProjection(instance) {
    if (!QuestTokens.isQuestToken(instance)) return null;
    const q = instance.quest;
    return {
        id: q.id,
        title: q.title,
        instruction: q.instruction || null,
        type: q.type || null,
        itemId: q.itemId || null,
        enemyId: q.enemyId || null,
        currentCount: q.currentCount || 0,
        requiredCount: q.requiredCount || 1,
        rewardItems: (q.rewardItems || []).map(r => ({ itemId: r.itemId, quantity: r.quantity })),
        tutorial: !!q.tutorial,
        done: !!q.done
    };
}

/** The side the hero working `id` stands on (−1 / 1), or null. */
function sideOfWorker(id) {
    const heroId = BoardState.workerOf(id);
    const side = heroId ? BoardState.heroBodyOf(heroId)?.side : null;
    return side === -1 || side === 1 ? side : null;
}

/** How long the Hall brightens when collected loot lands on it (FB-16). */
const RECEIVED_MS = 350;


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
 * make its own stacking context and bury the bar under the hero's feet. The
 * bar is the ring row now (B1.2, TL-22), and it lives in the badge box for the
 * same reason.
 */
export const MatToken = React.memo(function MatToken({
    id,
    typeId,
    x,
    y,
    size = 1,
    walkFacing = null,
    z,
    isHovered = false,
    hasHero = false,
    onInspectToken,
    onClearInspect,
    onOpenRecipes,
    onRecallHero,
    disallowMode = false,
    onFlipDisallow
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

    // ⭐ Enemy Animations EA-A: a Token with a registered sheet animates on
    // the board only (EA-5); everything else, and every other surface,
    // keeps the plain static sprite (EAP-4).
    const enemyAnimSrc = def?.enemy ? resolveEnemyAnimationPath(def.sprite) : null;

    /**
     * This Token's own details, read by id and refreshed only on the events that
     * can change them. ⚠️ Never `board:progress`: that fires every tick for
     * every working Token, and the bar below draws it imperatively instead.
     */
    const detail = useGameState(
        () => {
            const instance = BoardState.getTokenById(id);
            if (!instance) return null;
            // A Foundation picks its recipe like a station (Token Lifecycle 6.1).
            const stationSkill = def ? (def.foundation?.skill || stationSkillOf(def)) : null;
            const isSpawner = !instance.turnedFrom && SpawnerSystem.isSpawner(def);
            return {
                usesRemaining: instance.usesRemaining ?? null,
                alert: instance.alert || null,
                disallowed: Flags.isDisallowed(instance),
                heroId: BoardState.workerOf(id),
                // The side the working hero stands on (−1 left, 1 right), for
                // the ring row (B1.2). `workerOf` is null until they arrive.
                heroSide: sideOfWorker(id),
                stationSkill,
                recipe: stationSkill ? StationRecipe.selectedRecipe(instance, def) : null,
                // Something to choose from: a station with an empty pool is not
                // waiting on the player, so it gets no gear (FB-7).
                hasPool: stationSkill ? StationRecipe.poolFor(def).length > 0 : false,
                isFoundation: !!def?.foundation,
                isSpawner,
                // FB-5: the family's live count against its cap, `{ count, cap }`
                // — the spawner ring (B1.3).
                spawnerCounts: isSpawner ? SpawnerSystem.spawnerCounts(id) : null,
                // FB-14: a Token that turns (or has turned) counts down to its next roll.
                turns: !!TimedChanges.nextTurnRoll(instance),
                // B6.2 (TL-18): a quest Token's quest — ring, glow, tooltip,
                // click to claim. Progress publishes `state_changed`, so this
                // needs no subscription of its own.
                quest: questProjection(instance)
            };
        },
        [
            BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.ALERT_CHANGED,
            BOARD_EVENTS.HERO_MOVED,
            BOARD_EVENTS.TOKEN_CHARGES_CHANGED,
            BOARD_EVENTS.TOKEN_PLACED,
            'state_changed'
        ],
        null,
        { deps: [id] }
    );

    // The turn ring polls this (B1.3); stable per Token so its timer is not
    // reset. `everyMs` is the roll cycle it empties over — on a turned Token
    // the ORIGINAL's, as the roll itself uses (TL-12, `turnTimingOf`).
    const readTurn = React.useCallback(() => {
        const instance = BoardState.getTokenById(id);
        const roll = TimedChanges.nextTurnRoll(instance);
        return roll ? { ...roll, everyMs: TimedChanges.turnTimingOf(instance).everyMs } : null;
    }, [id]);

    // The spawner's standing ring (FB-5, B1.3), after cycle and charges; a
    // quest's progress ring (B6.2, TL-18) stands in the same place.
    const spawnerCounts = detail?.spawnerCounts ?? null;
    const quest = detail?.quest ?? null;
    const standingRings = React.useMemo(
        () => {
            const ring = spawnerRing(spawnerCounts) || questRing(quest);
            return ring ? [ring] : null;
        },
        [spawnerCounts?.count, spawnerCounts?.cap, quest?.currentCount, quest?.requiredCount, quest?.title]   // eslint-disable-line react-hooks/exhaustive-deps
    );
    const questDone = !!quest?.done;

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

    // While it is in the player's hand, a Token does not grow or turn into
    // something else: that would swap it for a new instance mid-drag and lose
    // the move (FB-12). The change waits and happens where it is put down.
    // Released after the drop has been handled, which runs before this clean-up.
    React.useEffect(() => {
        if (!drag.isDragging) return undefined;
        TimedChanges.setInHand(id, true);
        return () => TimedChanges.setInHand(id, false);
    }, [drag.isDragging, id]);

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

    // FB-30 → FB-52: a Token with a trickle (the Guild Hall) shows what it pays
    // in a game-styled tooltip with a live "next in", not the native title.
    const showTrickle = isHovered && hasTrickle(def);

    // B6.2 (TL-18): hovering a quest Token reads it (`QuestTooltip`), and a
    // tutorial step still to do lights its target, as hovering its sidebar
    // card did (`TutorialAideOverlay`).
    const showQuestTip = isHovered && !!quest;
    const aideStep = isHovered && quest?.tutorial && !questDone ? quest.id : null;
    React.useEffect(() => {
        if (!aideStep) return undefined;
        setTutorialAideTarget(aideStep);
        return () => setTutorialAideTarget(null);
    }, [aideStep]);

    const alertHint = alert ? ALERT_HINT[alert] : null;
    const hoverTitle = [
        detail?.disallowed ? 'Heroes may not work this' : null,
        ...(isHovered ? skipLines : [])
    ].filter(Boolean).join('\n') || undefined;

    // ⭐ The Token stays exactly where it is (HM-2): its hero walks up and
    // stands beside it (`HeroMotion.standingSpot`). D-266's slide-apart went
    // with Hero Movement M1.
    const left = x - boxHalf;
    const top = y - boxHalf;
    // B7.1 (TL-16): an enemy walking by its spawner steps once a tick, so it
    // glides linearly over one tick, as a walking hero does (`MatHero`). The
    // art, the badges, the ring row and the alerts all ride in these boxes.
    const walking = walkFacing != null;
    const boxStyle = {
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
    const hidden = drag.isDragging;

    // B1.2 / TL-22: the ring row, centred under the pair once the hero has
    // arrived (`workerOf` answers only then, FP-26), at their STANDING spot —
    // not their walking position — so the row does not slide while they walk.
    const heroSide = detail?.heroSide ?? null;
    const heroX = heroId && heroSide != null
        ? HeroMotion.standingSpot(typeId, { x, y }, heroSide).x
        : null;
    const row = ringRowOffset({ x, half: boxHalf, heroX });

    const token = React.useMemo(
        () => ({ typeId, instanceId: id, heroId, alert, usesRemaining }),
        [typeId, id, heroId, alert, usesRemaining]
    );

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // B2.3: in disallow mode a Token only flips; nothing is recalled.
        if (disallowMode) return;
        // Recalls the hero working it. (A Token without one used to go to the
        // Vault; the Vault went in Token Lifecycle 9.3.)
        if (heroId) onRecallHero?.(heroId);
    };

    // FB-10: the skill whose hit animation this Token plays when struck.
    const hitSkill = React.useMemo(() => hitSkillOf(def), [def]);

    // FB-11: a Token that has just become this one glows as it appears. The
    // glow was raised under this (new) id before it was drawn (`TokenGlows`).
    const [transformGlow, setTransformGlow] = React.useState(() => TokenGlows.glowOf(id));
    React.useEffect(() => {
        if (!transformGlow) return undefined;
        const timer = setTimeout(() => setTransformGlow(null), transformGlow.remainingMs);
        return () => clearTimeout(timer);
    }, [transformGlow]);
    const glowDelay = transformGlow ? `-${TokenGlows.GLOW_MS - transformGlow.remainingMs}ms` : undefined;

    // FB-16: collected loot flies to the Hall; a subtle brighten as it lands.
    const [received, setReceived] = React.useState(false);
    const receivedTimer = React.useRef(null);
    const isHall = isGuildHallToken || !!def?.isGuildHall;
    React.useEffect(() => {
        if (!isHall) return undefined;
        const unsub = EventBus.subscribe('particle_landed', (p) => {
            if (p?.landsOn !== 'hall') return;
            setReceived(true);
            clearTimeout(receivedTimer.current);
            receivedTimer.current = setTimeout(() => setReceived(false), RECEIVED_MS);
        });
        return () => { unsub?.(); clearTimeout(receivedTimer.current); };
    }, [isHall]);

    const glow = staffed && !alert ? 'gi-glow-active' : null;
    const gear = gearStateOf(detail || {});

    return (
        <>
            {/* The art, and the only thing the pointer can grab. */}
            <div
                ref={drag.setNodeRef}
                {...drag.handleProps}
                data-token-id={id}
                data-token-art="true"
                data-token-type={typeId}
                data-guild-hall={isHall ? 'true' : undefined}
                data-hall-received={received ? 'true' : undefined}
                data-quest-claimable={questDone ? 'true' : undefined}
                title={hoverTitle}
                data-tile-alert={alert || undefined}
                data-tile-staffed={staffed ? 'true' : undefined}
                data-tile-has-token="true"
                data-tile-finite-token={isFiniteToken ? 'true' : undefined}
                onContextMenu={handleContextMenu}
                onClick={(e) => {
                    if (drag.isDragging) return;
                    // B2.3 (FB-32): in disallow mode a click flips the Token
                    // allowed ⇄ disallowed (FP-35) and does nothing else —
                    // it never claims a quest.
                    if (disallowMode) { onFlipDisallow?.(id); return; }
                    // B6.2 (TL-18, FB-41): click a done quest to claim it. The
                    // engine drops the reward as loot and removes the Token.
                    // `skipSlide` is still on just after a drop, so the drop's
                    // own click never claims. A quest not yet done inspects.
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
                    zIndex: z,
                    // Rounded, not clipped: the corners of the box do not catch
                    // the pointer, and art that spills past the circle is not
                    // cropped (owner feedback, slice 1.9 work).
                    borderRadius: '50%',
                    visibility: hidden ? 'hidden' : 'visible'
                }}
                className={cn(
                    'absolute select-none pointer-events-auto',
                    disallowMode || questDone ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                    glow
                )}
            >
                {/* B6.2 (TL-18): a done quest glows until claimed — the
                    transform glow's gold (FB-11), held as a halo behind the
                    art that breathes (`gi-quest-ready`), spilling past it. */}
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
                        isHovered && 'gi-token-hover-pulse',
                        received && 'brightness-125 saturate-125'
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
                                className={cn('absolute inset-0 m-auto', landing && 'gi-token-land')}
                            />
                        ) : (
                            <TokenSprite
                                typeId={typeId}
                                surface={TOKEN_SURFACE.BOARD}
                                scale={artScale}
                                alt={label}
                                className={cn('absolute inset-0 m-auto', landing && 'gi-token-land')}
                            />
                        )}
                    </TokenHitArt>
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

            {/* Everything written on the Token, in front of any hero on it. */}
            <div
                data-token-id={id}
                data-token-overlay={id}
                data-quest-token={quest ? id : undefined}
                data-quest-done={quest ? String(questDone) : undefined}
                className="absolute pointer-events-none"
                style={{ ...boxStyle, zIndex: z + 2, visibility: hidden ? 'hidden' : 'visible' }}
            >
                <TokenNameBadge name={label} isDragging={hidden} isHovered={isHovered} />

                {/* FB-7: the recipe gear, top-left, on every Token with something
                    to choose. Nothing chosen: it pulses, and that is all — no
                    alert (owner, after Q1). Heroes still pass it over. */}
                {gear.show && (
                    <StationGearBadge
                        isDragging={hidden}
                        recipe={detail?.recipe}
                        pulsing={gear.pulsing}
                        isFoundation={!!detail?.isFoundation}
                        onClick={() => (disallowMode ? onFlipDisallow?.(id) : onOpenRecipes?.(id))}
                    />
                )}

                {/* FB-33: disallowed (FP-35), top-right, always shown. */}
                {detail?.disallowed && <DisallowBadge isDragging={hidden} />}

                {/* TL-22: cycle, charges and the Token's own ring, in one row
                    under the Token and its hero (B1.2). It carries the -1 floater.
                    B1.3: a spawner's count (FB-5) and a turning Token's
                    countdown (FB-14 / TL-12) stand in it always. */}
                <TokenBadgeRow
                    instanceId={id}
                    token={isGuildHallToken ? { ...token, usesRemaining: null } : token}
                    isHovered={isHovered}
                    isDragging={hidden}
                    left={boxHalf + row.dx}
                    top={boxHalf + row.dy}
                    extraRings={standingRings}
                    readTurn={detail?.turns ? readTurn : null}
                />

                {/* FB-8 / TL-14: the one mark at the centre — a spawner's or a
                    worked Token's live problem (B1.1), news of a problem, or a
                    green notice that fades. */}
                <TokenCentreAlert
                    instanceId={id}
                    isSpawner={!!detail?.isSpawner}
                    token={token}
                    isHovered={isHovered}
                />
                <EffectProcText instanceId={id} />
            </div>

            {showTrickle && !hidden && <TrickleTooltip instanceId={id} />}
            {showQuestTip && !hidden && <QuestTooltip instanceId={id} quest={quest} />}
        </>
    );
});

export default MatToken;
