import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { joinNames } from './heroBubbles.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { getTokenType, tokenStartingUses } from '../../../config/registries/tokenRegistry.js';
import { enemyProfileOf } from '../../../config/registries/enemyProfile.js';
import { subscribeToken } from './tokenEvents.js';
import { workedAlertOf } from './centreAlert.js';
import { RingBadge, paintRing } from './RingBadge.jsx';
import { Bubble } from './Bubble.jsx';
import { HealthBar } from './HealthBar.jsx';
import { enemyBarPlace } from './healthBar.js';
import { TimerBubble } from './TimerBubble.jsx';
import {
    BUBBLE_RECENT_MS, RING_D_U, bubbleSlot, chargesFraction, cycleSecondsText, ringCount
} from './ringRow.js';
import { TokenChargeDeltaFloater, StationGearBadge, DisallowBadge, StuckBadge } from './TokenBadges.jsx';
import { onStep } from './frameClock.js';
import { shareCycle } from './cycleShare.js';

const NO_MISSING = Object.freeze({ type: null, items: [] });

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
    /** A stuck spawner's warning: `{ alert, needs }` from `SpawnerSystem.spawnerAlertOf`. */
    stuck: (state) => {
        if (state?.alert === ALERT.SPAWN_MAT_FULL) return 'Token cap full';
        if (state?.alert !== ALERT.SPAWN_NEEDS_ITEM) return 'No room to spawn';
        const names = (state.needs || []).map(id => getItem(id)?.name || id);
        return names.length ? `Needs ${joinNames(names)} to spawn` : 'Needs items to spawn';
    }
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
 * as the cycle runs; the number is seconds left, rounded up. Between engine ticks it moves on the
 * shared step clock (`onStep`: ten steps a second, every ring in the same frame), and goes back
 * to empty on `CYCLE_COMPLETE`. Blocked (`workedAlertOf`, the same test the centre mark uses):
 * grey, frozen, no number. The inspection's rings read the same cycle (`shareCycle`).
 * - **Charges** (bottom-right), **quest progress** (bottom-centre), **spawner count** (middle
 * row): for {@link BUBBLE_RECENT_MS} after the number changes, and while hovered. Their rings
 * glide when the number jumps.
 * - **Timer** (top-left, `TimerBubble`): a growing, turning or resting Token's countdown, hovered or in
 * its last seconds.
 * - **Gear** (middle row): always while a choice is needed (nothing chosen), otherwise hovered.
 * - **Disallow mark** (middle row): the whole time it is disallowed.
 * - **Stuck warning** (middle row): the whole time a spawner waits on an item or on room
 * (`SPAWNER_ALERT_CHANGED`, read once on mount); yellow for an item, red for no room.
 * - **Enemy health bar** (above the Token's box, not a bubble): in a fight (`PROGRESS` with
 * `combat: true`), and while an enemy is hovered. No cycle in a fight.
 * - While the Token is dragged: nothing.
 * Every bubble has a tooltip, and pressing one grabs the Token (`dragProps`).
 * The subscriptions are keyed on the Token and nothing else. Hovering, the alert, the hero and
 * the fresh `token` object the mat builds on every state change must not tear down the
 * subscriptions or stop the step: everything the handlers read lives in `liveRef`. They go
 * through `tokenEvents.js`, so every Token shares one bus subscription per event type. A ring
 * steps only while its cycle is live, never for an idle, blocked or fought Token.
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
    const enemyHp = useMemo(() => enemyProfileOf(getTokenType(typeId))?.hp ?? null, [typeId]);

    const liveRef = useRef({ hasHero, blocked });
    liveRef.current = { hasHero, blocked };

    const cycleRef = useRef(null);
    const applyCurrentRef = useRef(null);
    // Draws the cycle ring as it stands, at once: for a ring that (re)mounts mid-cycle, which
    // would otherwise show empty until the next step.
    const paintNowRef = useRef(null);
    const setCycleRoot = useCallback((el) => {
        cycleRef.current = el;
        if (el) paintNowRef.current?.();
    }, []);

    useEffect(() => {
        if (!instanceId) return undefined;

        // The cycle as last told: `elapsed` at `stamp`. While `running` it moves on with the
        // wall clock between engine ticks, up to `cycleTime`; stopped, it holds.
        let running = false;
        let elapsed = 0;
        let stamp = 0;
        let cycleTime = null;
        // The shared step clock's unsubscribe while the ring runs.
        let offStep = null;

        const elapsedAt = (now) => (running && cycleTime
            ? Math.min(cycleTime, elapsed + Math.max(0, now - stamp))
            : elapsed);

        // Write the ring only when what it draws changes (a ring held full or frozen writes
        // nothing). A remounted ring always writes.
        let lastKey = null;
        let lastRoot = null;
        const paint = (now) => {
            const root = cycleRef.current;
            const e = elapsedAt(now);
            const f = cycleTime ? e / cycleTime : 0;
            const text = liveRef.current.blocked ? '' : cycleSecondsText(e, cycleTime);
            const key = `${Math.max(0, Math.min(1, f)).toFixed(3)}|${text}`;
            if (root === lastRoot && key === lastKey) return;
            lastRoot = root;
            lastKey = key;
            paintRing(root, f, text);
        };
        /** Any other write to the ring: the next step must write too. */
        const paintOnce = (f, text) => {
            lastRoot = null;
            paintRing(cycleRef.current, f, text);
        };
        paintNowRef.current = () => {
            lastRoot = null;
            if (cycleTime && (running || liveRef.current.blocked)) paint(performance.now());
        };

        // ⚠️ While it runs, the ring is written on the shared step and nowhere else: an engine
        // event only moves the model. So every ring on the mat changes in the same frame, ten
        // times a second, and the frames between write nothing. Rings written on frames of
        // their own would make nearly every frame of play restyle, repaint and re-layer the page.
        const run = () => {
            running = true;
            if (!offStep) offStep = onStep(paint);
        };
        /** Hold the ring where the cycle stands now. */
        const stop = () => {
            elapsed = elapsedAt(performance.now());
            running = false;
            offStep?.();
            offStep = null;
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
            elapsed = p?.elapsedMs != null
                ? p.elapsedMs
                : cycleTime ? ((p?.percent || 0) / 100) * cycleTime : 0;
            stamp = performance.now();
            if (!cycleTime) {
                paintOnce((p?.percent || 0) / 100, '');
                return;
            }
            if (liveRef.current.hasHero) run();
        };

        const onCycleComplete = () => {
            if (liveRef.current.blocked || combatRef.current) return;
            elapsed = 0;
            stamp = performance.now();
            if (cycleTime && liveRef.current.hasHero) run();
            else paintOnce(0, '');
        };

        const onTokenChanged = () => {
            stop();
        };

        // Called on mount and whenever staffing or the block changes.
        applyCurrentRef.current = () => {
            const { hasHero: heroNow, blocked: blockedNow } = liveRef.current;
            if (!heroNow) {
                stop();
                elapsed = 0;
                if (hpRef.current) { hpRef.current = null; setHp(null); }
                return;
            }
            if (blockedNow) {
                // Frozen where it was; the number goes.
                stop();
                paintOnce(cycleTime ? elapsed / cycleTime : 0, '');
            }
        };

        const unsubs = [
            subscribeToken(BOARD_EVENTS.PROGRESS, instanceId, apply),
            subscribeToken(BOARD_EVENTS.CYCLE_COMPLETE, instanceId, onCycleComplete),
            subscribeToken(BOARD_EVENTS.TILE_CHANGED, instanceId, onTokenChanged),
            shareCycle(instanceId, (now) => (
                cycleTime && liveRef.current.hasHero && !combatRef.current
                    ? { elapsedMs: elapsedAt(now), cycleMs: cycleTime }
                    : null
            ))
        ];

        return () => {
            stop();
            applyCurrentRef.current = null;
            paintNowRef.current = null;
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
    // The engine decides when a spawner is stuck and says so on the change; nothing polls.
    const [stuck, setStuck] = useState(() => (instanceId ? SpawnerSystem.spawnerAlertOf(instanceId) : null));
    useEffect(() => {
        if (!instanceId) return undefined;
        setStuck(SpawnerSystem.spawnerAlertOf(instanceId));
        return subscribeToken(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, instanceId, (p) => {
            setStuck(p?.alert ? { alert: p.alert, needs: p.needs || [] } : null);
        });
    }, [instanceId]);
    const spawnerFlash = useChangeFlash(spawner ? { text: spawner.text, fraction: spawner.fraction } : null);

    if (isDragging) return null;

    const fight = hasHero && combat;
    const showCycle = hasHero && !fight;
    const showCharges = hasCharges && (isHovered || chargesFlash.recent) && !!chargesFlash.shown;
    const showQuest = !!quest && (isHovered || questFlash.recent) && !!questFlash.shown;
    const showSpawner = !!spawner && (isHovered || spawnerFlash.recent) && !!spawnerFlash.shown;
    // The bar's numbers: the fight's, else a full enemy (an enemy nobody fights is whole).
    const barHp = hp ?? (enemyHp ? { cur: enemyHp, max: enemyHp } : null);
    const showBar = (fight || (isHovered && !!enemyHp)) && !!barHp && barHp.max > 0;
    const showGear = !!gear?.show && (gear.pulsing || isHovered);
    const showStuck = !!stuck?.alert;
    const showMiddle = showGear || showSpawner || showStuck || disallowed;
    const slot = (name) => bubbleSlot(name, { boxPx, small });

    const cycleTip = blocked ? BUBBLE_TIPS.cycleBlocked : BUBBLE_TIPS.cycle;

    return (
        <>
            {readTimer && (
                <TimerBubble read={readTimer} hovered={isHovered} boxPx={boxPx} small={small} dragProps={dragProps} />
            )}
            {showBar && (
                <HealthBar
                    who="enemy"
                    of={instanceId}
                    cur={barHp.cur}
                    max={barHp.max}
                    style={enemyBarPlace(boxPx)}
                    dragProps={dragProps}
                />
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
                    {showStuck && (
                        <Bubble of={instanceId} kind="stuck" inline tip={BUBBLE_TIPS.stuck(stuck)} dragProps={dragProps}>
                            <StuckBadge noRoom={stuck.alert !== ALERT.SPAWN_NEEDS_ITEM} matFull={stuck.alert === ALERT.SPAWN_MAT_FULL} title={BUBBLE_TIPS.stuck(stuck)} />
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
                    <RingBadge kind="cycle" rootRef={setCycleRoot} greyed={blocked} title={cycleTip} />
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
