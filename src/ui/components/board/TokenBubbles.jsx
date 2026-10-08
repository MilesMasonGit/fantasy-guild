import { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { getTokenType, tokenStartingUses } from '../../../config/registries/tokenRegistry.js';
import { subscribeToken } from './tokenEvents.js';
import { workedAlertOf } from './centreAlert.js';
import { RingBadge, paintRing } from './RingBadge.jsx';
import { Bubble } from './Bubble.jsx';
import { TimerBubble } from './TimerBubble.jsx';
import {
    BUBBLE_RECENT_MS, RING_D_U, bubbleSlot, chargesFraction, cycleSecondsText, ringCount
} from './ringRow.js';
import { TokenChargeDeltaFloater, StationGearBadge, DisallowBadge } from './TokenBadges.jsx';
import { onFrame } from './frameClock.js';

const NO_MISSING = Object.freeze({ type: null, items: [] });

/** How many visible steps the cycle ring sweeps in one cycle: 0.9° each. */
const RING_STEPS = 400;

/**
 * After a count changes, how long the bubble keeps showing the OLD number before it takes the
 * new one: a bubble that appears because of the change needs a painted frame at the old value
 * for its ring to glide from.
 */
export const GLIDE_START_MS = 50;

/** What each bubble's tooltip says. */
export const BUBBLE_TIPS = Object.freeze({
    cycle: 'Work cycle: time left until this round of work finishes',
    cycleBlocked: 'Work cycle paused: this Token is missing something',
    charges: (n) => `Charges: ${Number(n).toLocaleString()} left`,
    quest: (text) => `Quest progress: ${text}`,
    spawner: (text) => `Spawned: ${text}. It stops at the limit`,
    disallow: 'Heroes may not work this',
    hp: (cur, max) => `Health: ${cur}/${max}`
});

/**
 * A count bubble's value, with the two things the visibility rules need: `recent`, true for
 * {@link BUBBLE_RECENT_MS} after the value changes (never on the first render), and `shown`,
 * the value to DRAW, which trails a change by {@link GLIDE_START_MS} so a ring that appears
 * with the change still glides to it.
 */
export function useChangeFlash(value, ms = BUBBLE_RECENT_MS) {
    const key = value == null ? '' : JSON.stringify(value);
    const [recent, setRecent] = useState(false);
    const [shown, setShown] = useState(value);
    const last = useRef(key);
    useEffect(() => {
        if (last.current === key) return undefined;
        last.current = key;
        setRecent(true);
        const glide = setTimeout(() => setShown(value), GLIDE_START_MS);
        const done = setTimeout(() => setRecent(false), ms);
        return () => { clearTimeout(glide); clearTimeout(done); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, ms]);
    return { recent, shown: shown ?? value };
}

/**
 * TokenBubbles: a Token's bubbles, drawn inside its box (`bubbleSlot` places each).
 * - **Cycle** (bottom-left): the whole time a hero works the Token and it is not a fight. Fills
 * as the cycle runs; the number is seconds left, rounded up. Smooth between engine ticks (rAF
 * interpolation) and back to empty on `CYCLE_COMPLETE`. Blocked (`workedAlertOf`, the same test
 * the centre mark uses): grey, frozen, no number.
 * - **Charges** (bottom-right), **quest progress** (bottom-centre), **spawner count** (middle
 * row): for {@link BUBBLE_RECENT_MS} after the number changes, and while hovered. Their rings
 * glide when the number jumps.
 * - **Timer** (top-left, `TimerBubble`): a growing or turning Token's countdown, hovered or in
 * its last seconds.
 * - **Gear** (middle row): always while a choice is needed (nothing chosen), otherwise hovered.
 * - **Disallow mark** (middle row): the whole time it is disallowed.
 * - **HP** (top-right, until the health bars replace it): in a fight (`PROGRESS` with
 * `combat: true`). No cycle then.
 * - While the Token is dragged: nothing.
 * Every bubble has a tooltip, and pressing one grabs the Token (`dragProps`).
 * The subscriptions are keyed on the Token and nothing else. Hovering, the alert, the hero and
 * the fresh `token` object the mat builds on every state change must not tear down the
 * subscriptions or cancel the animation frame: everything the handlers read lives in
 * `liveRef`. They go through `tokenEvents.js`, so every Token shares one bus subscription per
 * event type. The frame loop runs only while a cycle is live, never for an idle, blocked or
 * fought Token.
 */
export const TokenBubbles = ({
    instanceId = null,
    token = null,
    isHovered = false,
    isDragging = false,
    boxPx = 128,
    small = false,
    spawner = null,
    quest = null,
    readTimer = null,
    gear = null,
    disallowed = false,
    dragProps = null
}) => {
    const typeId = token?.typeId ?? null;
    const hasHero = !!token?.heroId;
    const usesRemaining = token?.usesRemaining ?? null;

    // Blocked exactly when the centre mark shows a worked problem. ⚠️ The live instance, not
    // `token`: the slim projection has no recipe.
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
        // The shared frame clock's unsubscribe while the sweep runs.
        let offClock = null;

        const stop = () => {
            active = false;
            offClock?.();
            offClock = null;
        };

        // Write the ring only when a pixel would move. The sweep is quantised to RING_STEPS a
        // cycle (0.9°, well under a pixel at any mat size), so a long cycle writes far fewer
        // times a second than once per display frame. The seconds and a remounted ring always
        // write.
        let lastStep = null;
        let lastText = null;
        let lastRoot = null;
        const paint = () => {
            const root = cycleRef.current;
            const f = cycleTime ? lastElapsed / cycleTime : 0;
            const text = cycleSecondsText(lastElapsed, cycleTime);
            const step = Math.round(Math.max(0, Math.min(1, f)) * RING_STEPS);
            if (root === lastRoot && step === lastStep && text === lastText) return;
            lastRoot = root;
            lastStep = step;
            lastText = text;
            paintRing(root, f, text);
        };
        /** Any other write to the ring: the next sweep frame must write too. */
        const paintOnce = (f, text) => {
            lastRoot = null;
            paintRing(cycleRef.current, f, text);
        };

        const updateFrame = () => {
            if (!active) return;
            const now = performance.now();
            lastElapsed = Math.min(cycleTime, lastElapsed + (now - lastTimestamp));
            lastTimestamp = now;
            paint();
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
                paintOnce((p?.percent || 0) / 100, '');
            }
            if (!active && cycleTime && liveRef.current.hasHero) {
                active = true;
                lastTimestamp = performance.now();
                offClock?.();
                offClock = onFrame(updateFrame);
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
                paintOnce(cycleTime ? lastElapsed / cycleTime : 0, '');
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
        // ⚠️ `instanceId` ONLY — everything else is read from refs.
    }, [instanceId]);

    useEffect(() => {
        applyCurrentRef.current?.();
    }, [instanceId, hasHero, blocked]);

    const startingUses = typeId ? tokenStartingUses(typeId) : null;
    const hasCharges = usesRemaining != null;
    const chargesFlash = useChangeFlash(hasCharges ? { n: usesRemaining, f: chargesFraction(usesRemaining, startingUses) } : null);
    const questFlash = useChangeFlash(quest ? { text: quest.text, fraction: quest.fraction } : null);
    const spawnerFlash = useChangeFlash(spawner ? { text: spawner.text, fraction: spawner.fraction } : null);

    if (isDragging) return null;

    const fight = hasHero && combat;
    const showCycle = hasHero && !fight;
    const showCharges = hasCharges && (isHovered || chargesFlash.recent) && !!chargesFlash.shown;
    const showQuest = !!quest && (isHovered || questFlash.recent) && !!questFlash.shown;
    const showSpawner = !!spawner && (isHovered || spawnerFlash.recent) && !!spawnerFlash.shown;
    const showHp = fight && !!hp && hp.max > 0;
    const showGear = !!gear?.show && (gear.pulsing || isHovered);
    const showMiddle = showGear || showSpawner || disallowed;
    const slot = (name) => bubbleSlot(name, { boxPx, small });

    const cycleTip = blocked ? BUBBLE_TIPS.cycleBlocked : BUBBLE_TIPS.cycle;

    return (
        <>
            {readTimer && (
                <TimerBubble read={readTimer} hovered={isHovered} boxPx={boxPx} small={small} dragProps={dragProps} />
            )}
            {showHp && (
                <Bubble of={instanceId} kind="hp" style={slot('hp')} tip={BUBBLE_TIPS.hp(hp.cur, hp.max)} dragProps={dragProps}>
                    <RingBadge
                        kind="hp"
                        fraction={Math.max(0, hp.cur) / hp.max}
                        text={ringCount(Math.max(0, hp.cur))}
                        title={BUBBLE_TIPS.hp(hp.cur, hp.max)}
                    />
                </Bubble>
            )}

            {showMiddle && (
                <div
                    data-bubble-row="middle"
                    className="absolute z-20 flex items-center justify-center pointer-events-none"
                    style={{ left: 0, width: boxPx, top: boxPx / 2, transform: 'translateY(-50%)', gap: 4 }}
                >
                    {showGear && (
                        <div {...dragProps} className="relative shrink-0 pointer-events-auto">
                            <StationGearBadge
                                recipe={gear.recipe}
                                pulsing={gear.pulsing}
                                isFoundation={gear.isFoundation}
                                onClick={gear.onClick}
                            />
                        </div>
                    )}
                    {showSpawner && (
                        <Bubble of={instanceId} kind="spawner" inline tip={BUBBLE_TIPS.spawner(spawner.text)} dragProps={dragProps}>
                            <RingBadge
                                kind="spawner"
                                fraction={spawnerFlash.shown.fraction}
                                text={spawnerFlash.shown.text}
                                title={BUBBLE_TIPS.spawner(spawner.text)}
                            />
                        </Bubble>
                    )}
                    {disallowed && (
                        <Bubble of={instanceId} kind="disallow" inline tip={BUBBLE_TIPS.disallow} dragProps={dragProps}>
                            <DisallowBadge />
                        </Bubble>
                    )}
                </div>
            )}

            {showCycle && (
                <Bubble of={instanceId} kind="cycle" style={slot('cycle')} tip={cycleTip} dragProps={dragProps}>
                    <RingBadge kind="cycle" rootRef={cycleRef} greyed={blocked} title={cycleTip} />
                </Bubble>
            )}
            {showQuest && (
                <Bubble of={instanceId} kind="quest" style={slot('quest')} tip={BUBBLE_TIPS.quest(quest.text)} dragProps={dragProps}>
                    <RingBadge
                        kind="quest"
                        fraction={questFlash.shown.fraction}
                        text={questFlash.shown.text}
                        title={BUBBLE_TIPS.quest(quest.text)}
                    />
                </Bubble>
            )}
            {/**
             * The -1 / +50 floater always lives in the charges slot (bubble shown or not), so a
             * change that makes the bubble appear does not remount it and lose the number. A
             * Token with no charges floats it from the corner instead.
             */}
            {hasCharges ? (
                <div
                    data-bubble-slot="charges"
                    className="absolute z-20 pointer-events-none"
                    style={{ ...slot('charges'), width: RING_D_U, height: RING_D_U }}
                >
                    {showCharges && (
                        <Bubble
                            of={instanceId}
                            kind="charges"
                            style={{ left: 0, top: 0 }}
                            tip={BUBBLE_TIPS.charges(usesRemaining)}
                            dragProps={dragProps}
                        >
                            <RingBadge
                                kind="charges"
                                fraction={chargesFlash.shown.f}
                                text={ringCount(chargesFlash.shown.n)}
                                title={BUBBLE_TIPS.charges(usesRemaining)}
                            />
                        </Bubble>
                    )}
                    <TokenChargeDeltaFloater instanceId={instanceId} anchor="ring" />
                </div>
            ) : (
                <TokenChargeDeltaFloater instanceId={instanceId} anchor="corner" />
            )}
        </>
    );
};

export default TokenBubbles;
