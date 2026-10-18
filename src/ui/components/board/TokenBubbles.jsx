import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import { getTokenType, tokenStartingUses } from '../../../config/registries/tokenRegistry.js';
import { enemyProfileOf } from '../../../config/registries/enemyProfile.js';
import { subscribeToken } from './tokenEvents.js';
import { RingBadge } from './RingBadge.jsx';
import { Bubble } from './Bubble.jsx';
import { HealthBar } from './HealthBar.jsx';
import { enemyBarPlace } from './healthBar.js';
import { TimerBubble } from './TimerBubble.jsx';
import { bubbleSlot, chargesFraction, ringCount } from './ringRow.js';
import { TokenChargeDeltaFloater, StationGearBadge, DisallowBadge, MarkedBadge } from './TokenBadges.jsx';
import { ProblemMark } from './ProblemMark.jsx';
import { problemOf, problemText, PROBLEM_MARK_ART_PX } from './problemMark.js';
import { createWorkBar, workBarPlace } from './workBar.js';
import { shareCycle } from './cycleShare.js';

/** What each hover ring's and player mark's tooltip says. */
export const BUBBLE_TIPS = Object.freeze({
    charges: (n) => `Charges: ${Number(n).toLocaleString()} left`,
    quest: (text) => `Quest progress: ${text}`,
    spawner: (text) => `Spawned: ${text}. It stops at the limit`,
    disallow: 'Heroes may not work this',
    marked: 'Marked for demolition: a hero with Construction will take it away'
});

const CHOOSE_KINDS = new Set([ALERT.CHOOSE_RECIPE, ALERT.CHOOSE_BUILD]);

/** The disallow and demolition badges' size (`w-7 h-7`), and the gap in a row, in mat units. */
const BADGE_U = 28;
const ROW_GAP_U = 4;

/**
 * TokenBubbles: what is drawn on a Token's box besides its art. The mat shows that something is
 * happening and what is wrong, and no numbers (docs/active/concept_info_layers.md):
 * - **Work bar** (`workBar.js`), along the foot: the whole time a hero works the Token and it is
 * not a fight. Fills each cycle on the shared step clock; empty again on `CYCLE_COMPLETE`. Any
 * engine alert on the worked Token stops the cycle, so the bar holds there, grey.
 * - **Problem mark** (`ProblemMark`, the middle row): one, yellow while it waits (items, a Token
 * beside it, charges, a choice) or red when it can't (no room, the cap, a hero who can't do the
 * work); its hover says exactly what (`problemMark.js`). From the engine's alert, a spawner's
 * stuck alert (`SPAWNER_ALERT_CHANGED`, read once on mount), or nothing chosen on a station.
 * - **Disallow and demolition marks** (the middle row): the whole time they apply.
 * - **The -1 / +50 floater**: whenever the charges change.
 * - **Enemy health bar** (above the box): in a fight, and while an enemy is hovered.
 * - **Hovered only**: the charges, quest and spawner rings, the timer ring (growing, turning,
 * resting) and the recipe gear; the gear and the spawner ring in a row of their own.
 * - While the Token is dragged: nothing.
 * Pressing anything here that takes the pointer grabs the Token (`dragProps`).
 * The subscriptions are keyed on the Token and nothing else: hovering, the alert, the hero and
 * the fresh `token` object the mat builds on every state change must not tear them down or stop
 * the bar; what the handlers read lives in `liveRef`. They go through `tokenEvents.js`, so every
 * Token shares one bus subscription per event type.
 */
export const TokenBubbles = ({
    instanceId = null,
    token = null,
    isHovered = false,
    isDragging = false,
    boxPx = 128,
    artPx = boxPx,
    artUnit = 2,
    small = false,
    spawner = null,
    quest = null,
    readTimer = null,
    gear = null,
    disallowed = false,
    marked = false,
    dragProps = null
}) => {
    const typeId = token?.typeId ?? null;
    const hasHero = !!token?.heroId;
    const usesRemaining = token?.usesRemaining ?? null;
    const alert = token?.alert ?? null;
    // Every engine alert on a worked Token means its cycle is not running.
    const blocked = hasHero && !!alert;

    // A fight shows HP, not a work bar. Guessed from the Token (an enemy) until the engine's
    // first progress says otherwise.
    const [combat, setCombat] = useState(() => !!getTokenType(typeId)?.enemy);
    const [hp, setHp] = useState(null);
    const combatRef = useRef(combat);
    const hpRef = useRef(hp);
    const enemyHp = useMemo(() => enemyProfileOf(getTokenType(typeId))?.hp ?? null, [typeId]);

    const liveRef = useRef({ hasHero, blocked });
    liveRef.current = { hasHero, blocked };

    const [bar] = useState(() => createWorkBar());
    const barPlace = useMemo(() => workBarPlace(boxPx, artUnit, small, artPx), [boxPx, artUnit, small, artPx]);
    const setBarRoot = useCallback((el) => bar.attach(el, barPlace.steps), [bar, barPlace.steps]);

    useEffect(() => {
        if (!instanceId) return undefined;

        const setFight = (on) => {
            if (combatRef.current === on) return;
            combatRef.current = on;
            setCombat(on);
        };

        const apply = (p) => {
            if (p?.combat) {
                bar.freeze();
                setFight(true);
                const next = { cur: p.enemyHp, max: p.enemyMaxHp };
                const prev = hpRef.current;
                if (!prev || prev.cur !== next.cur || prev.max !== next.max) {
                    hpRef.current = next;
                    setHp(next);
                }
                return;
            }
            // A plain cycle. A payload with no cycle time (promotion training, a reset) keeps the
            // one the bar knew.
            if (p?.cycleTimeMs) setFight(false);
            if (liveRef.current.blocked) return;   // held while blocked
            bar.progress(p, liveRef.current.hasHero);
        };

        const onCycleComplete = () => {
            if (liveRef.current.blocked || combatRef.current) return;
            bar.complete(liveRef.current.hasHero);
        };

        const unsubs = [
            subscribeToken(BOARD_EVENTS.PROGRESS, instanceId, apply),
            subscribeToken(BOARD_EVENTS.CYCLE_COMPLETE, instanceId, onCycleComplete),
            subscribeToken(BOARD_EVENTS.TILE_CHANGED, instanceId, () => bar.freeze()),
            shareCycle(instanceId, (now) => (
                liveRef.current.hasHero && !combatRef.current ? bar.read(now) : null
            ))
        ];

        return () => {
            bar.reset();
            unsubs.forEach(u => u());
        };
        // ⚠️ `instanceId` ONLY (the bar is this component's own): everything else is read from refs.
    }, [instanceId, bar]);

    // Staffing and the block: the hero gone, the bar starts over next time; blocked, it holds.
    useEffect(() => {
        if (!hasHero) {
            bar.reset();
            if (hpRef.current) { hpRef.current = null; setHp(null); }
            return;
        }
        if (blocked) bar.freeze();
    }, [instanceId, hasHero, blocked, bar]);

    // The engine decides when a spawner is stuck and says so on the change; nothing polls.
    const [stuck, setStuck] = useState(() => (instanceId ? SpawnerSystem.spawnerAlertOf(instanceId) : null));
    useEffect(() => {
        if (!instanceId) return undefined;
        setStuck(SpawnerSystem.spawnerAlertOf(instanceId));
        return subscribeToken(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, instanceId, (p) => {
            setStuck(p?.alert ? { alert: p.alert, needs: p.needs || [] } : null);
        });
    }, [instanceId]);

    // A marked Token runs no recipe, so there is nothing to choose.
    const choose = gear?.pulsing && !marked ? (gear.isFoundation ? 'build' : 'recipe') : null;
    const problem = useMemo(() => problemOf({ alert, spawner: stuck, choose }), [alert, stuck, choose]);
    const problemTip = useCallback(() => problemText(problem, instanceId), [problem, instanceId]);
    const problemClick = problem && CHOOSE_KINDS.has(problem.kind) ? gear?.onClick ?? null : null;

    const chargesSlot = useMemo(() => bubbleSlot('charges', { boxPx, small }), [boxPx, small]);

    // The bar, kept as the same element while nothing it draws from changes: its fill is
    // written on the step clock, never by a render.
    const workBar = useMemo(() => (
        <div
            ref={setBarRoot}
            data-work-bar={instanceId || undefined}
            data-work-bar-blocked={blocked ? 'true' : undefined}
            aria-hidden="true"
            className="gi-work-bar absolute z-20 pointer-events-none"
            style={{ left: barPlace.left, top: barPlace.top, width: barPlace.width, height: barPlace.height }}
        />
    ), [setBarRoot, instanceId, blocked, barPlace]);

    if (isDragging) return null;

    const fight = hasHero && combat;
    const showWork = hasHero && !fight;
    const hasCharges = usesRemaining != null;
    const showCharges = hasCharges && isHovered;
    const showQuest = !!quest && isHovered;
    const showSpawner = !!spawner && isHovered;
    // The bar's numbers: the fight's, else a full enemy (an enemy nobody fights is whole).
    const barHp = hp ?? (enemyHp ? { cur: enemyHp, max: enemyHp } : null);
    const showHp = (fight || (isHovered && !!enemyHp)) && !!barHp && barHp.max > 0;
    const showGear = !!gear?.show && !marked && isHovered;
    const showRest = !!problem || disallowed || marked;
    const showHoverRow = showGear || showSpawner;
    const startingUses = hasCharges && typeId ? tokenStartingUses(typeId) : null;
    // ⚠️ The hover row never shares the marks' row: inserted beside them it would slide the mark
    // out from under the pointer the moment the pointer reached it. With marks showing it sits
    // just above them; alone, at the centre.
    const restHalf = Math.max(PROBLEM_MARK_ART_PX * artUnit, BADGE_U) / 2;
    const hoverRowStyle = showRest
        ? { left: 0, width: boxPx, top: boxPx / 2 - restHalf - ROW_GAP_U, transform: 'translateY(-100%)', gap: ROW_GAP_U }
        : { left: 0, width: boxPx, top: boxPx / 2, transform: 'translateY(-50%)', gap: ROW_GAP_U };

    return (
        <>
            {readTimer && isHovered && (
                <TimerBubble read={readTimer} boxPx={boxPx} small={small} dragProps={dragProps} />
            )}
            {showHp && (
                <HealthBar
                    who="enemy"
                    of={instanceId}
                    cur={barHp.cur}
                    max={barHp.max}
                    style={enemyBarPlace(boxPx)}
                    dragProps={dragProps}
                />
            )}

            {showHoverRow && (
                <div
                    data-bubble-row="hover"
                    className="absolute z-20 flex items-center justify-center pointer-events-none"
                    style={hoverRowStyle}
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
                            <RingBadge kind="spawner" fraction={spawner.fraction} text={spawner.text} title={BUBBLE_TIPS.spawner(spawner.text)} />
                        </Bubble>
                    )}
                </div>
            )}

            {showRest && (
                <div
                    data-bubble-row="middle"
                    className="absolute z-20 flex items-center justify-center pointer-events-none"
                    style={{ left: 0, width: boxPx, top: boxPx / 2, transform: 'translateY(-50%)', gap: ROW_GAP_U }}
                >
                    {problem && (
                        <ProblemMark problem={problem} tip={problemTip} artUnit={artUnit} dragProps={dragProps} onClick={problemClick} />
                    )}
                    {marked && (
                        <Bubble of={instanceId} kind="marked" inline tip={BUBBLE_TIPS.marked} dragProps={dragProps}>
                            <MarkedBadge title={BUBBLE_TIPS.marked} />
                        </Bubble>
                    )}
                    {disallowed && (
                        <Bubble of={instanceId} kind="disallow" inline tip={BUBBLE_TIPS.disallow} dragProps={dragProps}>
                            <DisallowBadge />
                        </Bubble>
                    )}
                </div>
            )}

            {showWork && workBar}
            {showQuest && (
                <Bubble of={instanceId} kind="quest" style={bubbleSlot('quest', { boxPx, small })} tip={BUBBLE_TIPS.quest(quest.text)} dragProps={dragProps}>
                    <RingBadge kind="quest" fraction={quest.fraction} text={quest.text} title={BUBBLE_TIPS.quest(quest.text)} />
                </Bubble>
            )}
            {showCharges && (
                <Bubble of={instanceId} kind="charges" style={chargesSlot} tip={BUBBLE_TIPS.charges(usesRemaining)} dragProps={dragProps}>
                    <RingBadge
                        kind="charges"
                        fraction={chargesFraction(usesRemaining, startingUses)}
                        text={ringCount(usesRemaining)}
                        title={BUBBLE_TIPS.charges(usesRemaining)}
                    />
                </Bubble>
            )}
            {/* Last, so showing a ring never moves it: a number in flight is not lost. */}
            <TokenChargeDeltaFloater
                instanceId={instanceId}
                anchor={hasCharges ? 'ring' : 'corner'}
                slot={hasCharges ? chargesSlot : null}
                atRest={!hasHero}
            />
        </>
    );
};

export default TokenBubbles;
