import { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { getTokenType, tokenStartingUses } from '../../../config/registries/tokenRegistry.js';
import { subscribeToken } from './tokenEvents.js';
import { workedAlertOf } from './centreAlert.js';
import { RingBadge, paintRing } from './RingBadge.jsx';
import { RING_GAP_U, chargesFraction, cycleSecondsText, ringCount } from './ringRow.js';
import { TokenChargeDeltaFloater } from './TokenBadges.jsx';
import { TurnRing } from './TurnRing.jsx';

const NO_MISSING = Object.freeze({ type: null, items: [] });

/**
 * ⭐ **TokenBadgeRow — a Token's ring row** (TL-22, B1.2). It replaced the
 * progress bar (`TokenProgressBar`, TP-2 / TP-4) and the hover charge chip.
 *
 * Fixed order: **cycle, charges, then the Token's own ring** — enemy HP, or a
 * standing ring (B1.3): a spawner's count (`extraRings`) or a turn countdown
 * (`readTurn`). A Token cannot both spawn and turn.
 *
 * * **Cycle** — while a hero works the Token and it is not a fight. Fills as
 *   the cycle runs; the number is seconds left, rounded up. Smooth between
 *   engine ticks (rAF interpolation, as the bar did) and back to empty on
 *   `CYCLE_COMPLETE`. Blocked (`workedAlertOf`, the same test the centre mark
 *   uses, B1.1): grey, frozen, no number.
 * * **Charges** — while a hero works the Token, and on hover of any Token
 *   with a finite count. Empties as charges go. Unlimited: no ring.
 * * **HP** — in a fight (`PROGRESS` with `combat: true`). Empties as the
 *   enemy's HP falls. No cycle ring then.
 * * **Spawner** (FB-5) and **turn** (FB-14, TL-12) — standing facts, shown
 *   always, hero or not, hovered or not (owner, B1 visibility "Mixed"). The
 *   spawner ring fills to its cap (`spawnerRing`, passed in `extraRings`); the
 *   turn ring empties toward the next roll and polls its own clock
 *   (`TurnRing`), so the poll never re-renders this row or the MatToken.
 * * While the Token is dragged: no row at all, standing rings included.
 * * Nothing to show: no row at all.
 *
 * The row is positioned by `MatToken` (`ringRowOffset`), in the Token's badge
 * overlay so it draws in front of the hero (MatToken's "Two boxes" note).
 *
 * ## The subscriptions are keyed on the Token and nothing else (CR2-168 item 1)
 * Carried over from the bar. Hovering, the alert, the hero and the fresh
 * `token` object the mat builds on every state change must not tear down the
 * subscriptions or cancel the animation frame: everything the handlers read
 * lives in `liveRef`. Through `tokenEvents.js`, so ~80 rows share one bus
 * subscription per event type. The frame loop runs only while a cycle is
 * live — never for an idle, blocked or fought Token.
 */
export const TokenBadgeRow = ({
    instanceId = null,
    token = null,
    isHovered = false,
    isDragging = false,
    left = 0,
    top = 0,
    extraRings = null,
    readTurn = null
}) => {
    const typeId = token?.typeId ?? null;
    const hasHero = !!token?.heroId;
    const usesRemaining = token?.usesRemaining ?? null;

    // Blocked exactly when the centre mark shows a worked problem (B1.1).
    // ⚠️ The live instance, not `token`: the slim projection has no recipe.
    const missing = useMemo(
        () => {
            if (!hasHero || !instanceId) return NO_MISSING;
            return getMissingRequirements(instanceId, BoardState.getTokenById(instanceId) ?? token);
        },
        [instanceId, token, hasHero]
    );
    const blocked = !!workedAlertOf({ hasHero, alert: token?.alert ?? null, missingType: missing.type });

    // A fight shows HP, not a cycle. Guessed from the Token (an enemy) until
    // the engine's first progress says otherwise.
    const [combat, setCombat] = useState(() => !!getTokenType(typeId)?.enemy);
    const [hp, setHp] = useState(null);
    const combatRef = useRef(combat);
    const hpRef = useRef(hp);

    const liveRef = useRef({ hasHero, blocked });
    liveRef.current = { hasHero, blocked };

    const cycleRef = useRef(null);
    const applyCurrentRef = useRef(null);

    useEffect(() => {
        if (!instanceId) return undefined;

        let active = false;
        let lastElapsed = 0;
        let cycleTime = null;
        let lastTimestamp = performance.now();
        let rafId = null;

        const stop = () => {
            active = false;
            cancelAnimationFrame(rafId);
            rafId = null;
        };

        const paint = () => {
            const f = cycleTime ? lastElapsed / cycleTime : 0;
            paintRing(cycleRef.current, f, cycleSecondsText(lastElapsed, cycleTime));
        };

        const updateFrame = () => {
            if (!active) return;
            const now = performance.now();
            lastElapsed = Math.min(cycleTime, lastElapsed + (now - lastTimestamp));
            lastTimestamp = now;
            paint();
            rafId = requestAnimationFrame(updateFrame);
        };

        const setFight = (on) => {
            if (combatRef.current === on) return;
            combatRef.current = on;
            setCombat(on);
        };

        const apply = (p) => {
            if (p?.combat) {
                stop();
                setFight(true);
                const next = { cur: p.enemyHp, max: p.enemyMaxHp };
                const prev = hpRef.current;
                if (!prev || prev.cur !== next.cur || prev.max !== next.max) {
                    hpRef.current = next;
                    setHp(next);
                }
                return;
            }
            // A plain cycle. A payload with no cycle time (promotion training,
            // a reset) keeps the one it knew; with none known, no number.
            if (p?.cycleTimeMs) setFight(false);
            if (liveRef.current.blocked) return;   // frozen while blocked
            if (p?.cycleTimeMs) cycleTime = p.cycleTimeMs;
            lastElapsed = p?.elapsedMs != null
                ? p.elapsedMs
                : cycleTime ? ((p?.percent || 0) / 100) * cycleTime : 0;
            lastTimestamp = performance.now();
            if (cycleTime) {
                paint();
            } else {
                paintRing(cycleRef.current, (p?.percent || 0) / 100, '');
            }
            if (!active && cycleTime && liveRef.current.hasHero) {
                active = true;
                lastTimestamp = performance.now();
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(updateFrame);
            }
        };

        const onCycleComplete = () => {
            if (liveRef.current.blocked || combatRef.current) return;
            lastElapsed = 0;
            lastTimestamp = performance.now();
            paint();
        };

        const onTokenChanged = () => {
            stop();
        };

        // Called on mount and whenever staffing or the block changes.
        applyCurrentRef.current = () => {
            const { hasHero: heroNow, blocked: blockedNow } = liveRef.current;
            if (!heroNow) {
                stop();
                lastElapsed = 0;
                if (hpRef.current) { hpRef.current = null; setHp(null); }
                return;
            }
            if (blockedNow) {
                // Frozen where it was; the number goes.
                stop();
                paintRing(cycleRef.current, cycleTime ? lastElapsed / cycleTime : 0, '');
            }
        };

        const unsubs = [
            subscribeToken(BOARD_EVENTS.PROGRESS, instanceId, apply),
            subscribeToken(BOARD_EVENTS.CYCLE_COMPLETE, instanceId, onCycleComplete),
            subscribeToken(BOARD_EVENTS.TILE_CHANGED, instanceId, onTokenChanged)
        ];

        return () => {
            stop();
            applyCurrentRef.current = null;
            unsubs.forEach(u => u());
        };
        // ⚠️ `instanceId` ONLY (CR2-168) — everything else is read from refs.
    }, [instanceId]);

    useEffect(() => {
        applyCurrentRef.current?.();
    }, [instanceId, hasHero, blocked]);

    const fight = hasHero && combat;
    const showCycle = hasHero && !fight;
    const startingUses = typeId ? tokenStartingUses(typeId) : null;
    const showCharges = !isDragging && usesRemaining != null && (hasHero || isHovered);
    const showHp = fight && !!hp && hp.max > 0;
    const extras = (extraRings || []).filter(Boolean);

    const showTurn = typeof readTurn === 'function';

    const hasRow = !isDragging && (showCycle || showCharges || showHp || extras.length > 0 || showTurn);

    // The -1 / +50 floater rides just above the charges ring when there is
    // one, and floats from the Token's corner when there is not (a restock
    // with nobody looking).
    const floater = <TokenChargeDeltaFloater instanceId={instanceId} anchor={showCharges ? 'ring' : 'corner'} />;

    return (
        <>
            {!showCharges && floater}
            {hasRow && (
                <div
                    data-ring-row={instanceId || 'true'}
                    className="absolute z-20 flex items-center pointer-events-none"
                    style={{ left, top, gap: RING_GAP_U, transform: 'translateX(-50%)' }}
                >
                    {showCycle && (
                        <RingBadge
                            kind="cycle"
                            rootRef={cycleRef}
                            greyed={blocked}
                            title={blocked ? 'Blocked' : 'Time left in this cycle'}
                        />
                    )}
                    {showCharges && (
                        <RingBadge
                            kind="charges"
                            fraction={chargesFraction(usesRemaining, startingUses)}
                            text={ringCount(usesRemaining)}
                            title={`${Number(usesRemaining).toLocaleString()} charges remaining`}
                        >
                            {floater}
                        </RingBadge>
                    )}
                    {showHp && (
                        <RingBadge
                            kind="hp"
                            fraction={Math.max(0, hp.cur) / hp.max}
                            text={ringCount(Math.max(0, hp.cur))}
                            title={`${hp.cur}/${hp.max} HP`}
                        />
                    )}
                    {extras.map(r => (
                        <RingBadge key={r.kind} kind={r.kind} fraction={r.fraction} text={r.text} title={r.title} />
                    ))}
                    {showTurn && <TurnRing read={readTurn} />}
                </div>
            )}
        </>
    );
};

export default TokenBadgeRow;
