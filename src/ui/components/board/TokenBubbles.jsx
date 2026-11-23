import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as Growth from '../../../systems/board/Growth.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { enemyProfileOf, isEnemyDef } from '../../../config/registries/enemyProfile.js';
import { subscribeToken, subscribeEvery } from './tokenEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { Bubble } from './Bubble.jsx';
import { HealthBar } from './HealthBar.jsx';
import { enemyBarPlace, fightBarShift } from './healthBar.js';
import { IdlePlate } from './IdlePlate.jsx';
import { idlePlateCells } from './idlePlate.js';
import { StationGearBadge, MarkedBadge } from './TokenBadges.jsx';
import { ProblemMark } from './ProblemMark.jsx';
import { problemOf, problemText, tokenGearPx } from './problemMark.js';
import { createWorkBar, shareWorkBar } from './workBar.js';
import { shareCycle } from './cycleShare.js';
import { plateUnit } from './workPlate.js';
import { useMatFit } from './MatFitContext.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';

/** What each player mark's tooltip says. */
export const BUBBLE_TIPS = Object.freeze({
    marked: 'Marked for demolition: a hero with Construction will take it away'
});

const CHOOSE_KINDS = new Set([ALERT.CHOOSE_RECIPE, ALERT.CHOOSE_BUILD]);

/** The gap in a row, in mat units. */
const ROW_GAP_U = 4;
/** A hurt enemy's health off its Token, as the bar reads it, or null for a whole one. */
function keptHealth(instanceId) {
    const hp = instanceId ? BoardCombat.enemyHealthOf(BoardState.getTokenById(instanceId)) : null;
    return hp && hp.current < hp.max ? { cur: hp.current, max: hp.max } : null;
}

/** A bar in the fight layer takes the pointer as the fight's plate does (`FightBarHost`). */
const PLATE_POINTER = 'var(--plate-pointer, auto)';

/**
 * TokenBubbles: what is drawn on a Token's box besides its art. The mat shows that something is
 * happening and what is wrong, and no numbers (docs/active/concept_info_layers.md):
 * - **The work bar's model** (`workBar.js`): fed here from the Token's engine events and drawn by the
 * work plate under the Token and its hero (`WorkPlateLayer`), which also says the charges and any
 * problem while a hero works it. Fills each cycle on the shared step clock; empty
 * again on `CYCLE_COMPLETE`. Any engine alert on the worked Token stops the cycle, so the bar holds
 * there, grey.
 * - **Problem mark** (`ProblemMark`, the row above the art), bobbing, on any Token with a problem
 * (a worked Token's plate also says it in words; not while an enemy's bar is up there): one,
 * yellow while it waits (items, a Token
 * beside it, charges, a choice) or red when it can't (no room, the cap, a hero who can't do the
 * work); its hover says exactly what (`problemMark.js`). From the engine's alert, a spawner's
 * stuck alert (`SPAWNER_ALERT_CHANGED`, read once on mount), a growing Token's (a Stump that needs
 * its Forest or a seedling: `GROWTH_ALERT_CHANGED`, likewise), or nothing chosen on a station.
 * - **Demolition mark** (the middle row): the whole time it applies.
 * - **Enemy health bar** (above the box): in a fight, and while an enemy is hovered. In a fight
 * the mat hands it `fightBar` (`{ host, left, top }`: the fight layer's node and this box's
 * corner in mat units) and the bar draws there, over the loot (`FightBarHost`).
 * - **Hovered only**: on a Token nobody works, the idle plate under it (`IdlePlate`, drawn into
 * `plateHost`, which `MatToken` hands over only while it rests there): its problem and its timer,
 * as apply, and with neither no plate at all;
 * and the recipe gear, in a row of its own. Every gear on a Token is the '!' mark's size.
 * - **A choice waiting** (nothing chosen on a station or Foundation): its yellow '!' at rest, and
 * the gear in the mark's own spot the moment the pointer reaches the Token (`pointerOn`, the bare
 * hover), with no rest: the Token already redraws then for its outline, and the swap trades one
 * element for another.
 * `isHovered` is the mat's rest (`useHoverRest`), not the bare hover: the pointer has stayed on
 * the Token for a moment, so a sweep across the mat mounts none of these.
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
    pointerOn = false,
    isDragging = false,
    boxPx = 128,
    artPx = null,
    artUnit = 2,
    x = null,
    y = null,
    readTimer = null,
    plateHost = null,
    gear = null,
    marked = false,
    fightBar = null,
    dragProps = null
}) => {
    const typeId = token?.typeId ?? null;
    const hasHero = !!token?.heroId;
    const alert = token?.alert ?? null;
    // Every engine alert on a worked Token means its cycle is not running.
    const blocked = hasHero && !!alert;

    // A fight shows HP, not a work bar. Guessed from the Token (an enemy) until the engine's
    // first progress says otherwise.
    const [combat, setCombat] = useState(() => !!getTokenType(typeId)?.enemy);
    const [hp, setHp] = useState(() => keptHealth(instanceId));
    const combatRef = useRef(combat);
    const hpRef = useRef(hp);
    const enemyHp = useMemo(() => enemyProfileOf(getTokenType(typeId))?.hp ?? null, [typeId]);
    // ⚠️ An enemy's use count is hidden: it never draws as charges.
    const isEnemy = useMemo(() => isEnemyDef(getTokenType(typeId)), [typeId]);

    const liveRef = useRef({ hasHero, blocked });
    liveRef.current = { hasHero, blocked };

    const [bar] = useState(() => createWorkBar());
    // The plate draws it: shared from the commit on, before the plate attaches its fill.
    useLayoutEffect(() => (instanceId ? shareWorkBar(instanceId, bar) : undefined), [instanceId, bar]);

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
            // A plain cycle. A payload with no cycle time (a reset) keeps the one the bar knew.
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
            // An enemy keeps its damage when its fight ends, and heals back while resting.
            const kept = keptHealth(instanceId);
            if (hpRef.current?.cur !== kept?.cur || hpRef.current?.max !== kept?.max) { hpRef.current = kept; setHp(kept); }
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

    // A growing Token waits on its own channel: a Stump with no Forest in reach, or no seedling.
    const [growth, setGrowth] = useState(() => (instanceId ? Growth.growthAlertOf(instanceId) : null));
    useEffect(() => {
        if (!instanceId) return undefined;
        setGrowth(Growth.growthAlertOf(instanceId));
        return subscribeToken(BOARD_EVENTS.GROWTH_ALERT_CHANGED, instanceId, (p) => {
            setGrowth(p?.alert ? { alert: p.alert, needs: p.needs || [] } : null);
        });
    }, [instanceId]);

    // ⚠️ A catch-up plays on a quiet bus, and the engine says an alert only when it changes: a
    // change made then is never said again. Its end says `GAME_RESET`, so both are read back.
    useEffect(() => {
        if (!instanceId) return undefined;
        return subscribeEvery(ENGINE_EVENTS.GAME_RESET, () => {
            setStuck(SpawnerSystem.spawnerAlertOf(instanceId));
            setGrowth(Growth.growthAlertOf(instanceId));
            if (!liveRef.current.hasHero) {
                const kept = keptHealth(instanceId);
                hpRef.current = kept;
                setHp(kept);
            }
        });
    }, [instanceId]);

    // A marked Token runs no recipe, so there is nothing to choose.
    const choose = gear?.pulsing && !marked ? (gear.isFoundation ? 'build' : 'recipe') : null;
    const problem = useMemo(() => problemOf({ alert, spawner: stuck, growth, choose }), [alert, stuck, growth, choose]);
    const problemTip = useCallback(() => problemText(problem, instanceId), [problem, instanceId]);
    const problemClick = problem && CHOOSE_KINDS.has(problem.kind) ? gear?.onClick ?? null : null;

    const barUnit = plateUnit(useMatFit() || 1);

    // The idle plate: a Token nobody works (never an enemy), rested on, that is stuck or counting.
    // The problem may be a spawner's or a growth's, which only this component hears, so `MatToken`
    // hands it the host on every rest and the choice is made here. The timer counts if its clock
    // runs as the pointer arrives.
    const idleOn = !!plateHost && isHovered && !hasHero && !isEnemy && !isDragging;
    const idleProblem = problem && !CHOOSE_KINDS.has(problem.kind) ? problem : null;
    const idleCells = useMemo(() => (idleOn ? idlePlateCells({ problem: idleProblem }) : null), [idleOn, idleProblem]);
    const idleTimed = useMemo(() => idleOn && !!readTimer?.(), [idleOn, readTimer]);
    const idleShown = !!idleCells && (idleCells.length > 0 || idleTimed);

    if (isDragging) return null;

    const fight = hasHero && combat;
    // The bar's numbers: the fight's, else a full enemy (an enemy nobody fights is whole).
    const barHp = hp ?? (enemyHp ? { cur: enemyHp, max: enemyHp } : null);
    const showHp = (fight || (isHovered && !!enemyHp)) && !!barHp && barHp.max > 0;
    // The '!' and an enemy's bar would share the space over the art: the bar wins.
    const showProblem = !!problem && !fight && !showHp;
    // A choice waiting: the pointer on the Token, the gear stands where its '!' was, at once.
    // ⚠️ The hover is the Token's (its circle, `MatBoard`), not the mark's, so the swap cannot take
    // the hover away; and the gear is the mark's size, so nothing beside it moves.
    const gearInMark = showProblem && (pointerOn || isHovered) && !!gear?.show && !marked && CHOOSE_KINDS.has(problem.kind);
    const showGear = !!gear?.show && !marked && isHovered && !gearInMark;
    // ⚠️ The hover row never shares the '!''s row: inserted beside it, it would slide the mark out
    // from under the pointer the moment the pointer reached it. It has the centre: the '!' is over
    // the art, and a Token marked for demolition shows no gear.
    const gearPx = tokenGearPx(artUnit);
    const hoverRowStyle = { left: 0, width: boxPx, top: boxPx / 2, transform: 'translateY(-50%)', gap: ROW_GAP_U };
    // The '!' stands on the art's top edge (the art is centred in the box); the art's own clear
    // rows above its pixels are the gap.
    const artTop = (boxPx - (artPx ?? boxPx)) / 2;

    return (
        <>
            {idleShown && (
                <IdlePlate
                    host={plateHost}
                    tokenId={instanceId}
                    typeId={typeId}
                    x={x}
                    y={y}
                    cells={idleCells}
                    readTimer={readTimer}
                    tip={problemTip}
                    tone={idleProblem?.severity ?? null}
                    dragProps={dragProps}
                />
            )}
            {showHp && (() => {
                const bar = enemyBarPlace(boxPx, barUnit);
                const body = fight ? BoardState.heroBodyOf(token.heroId) : null;
                const away = body?.side === -1 ? 1 : -1;
                // Beside its hero, out of the fight button's way.
                const place = body && Number.isFinite(body.x) && Number.isFinite(x)
                    ? { ...bar, left: bar.left + away * fightBarShift(body.x - x, barUnit) }
                    : bar;
                const el = (
                    <HealthBar
                        who="enemy"
                        of={instanceId}
                        cur={barHp.cur}
                        max={barHp.max}
                        u={barUnit}
                        outward={body ? away : 0}
                        style={fightBar
                            ? { ...place, left: fightBar.left + place.left, top: fightBar.top + place.top, pointerEvents: PLATE_POINTER }
                            : place}
                        dragProps={dragProps}
                    />
                );
                return fightBar ? createPortal(el, fightBar.host) : el;
            })()}

            {showGear && (
                <div
                    data-bubble-row="hover"
                    className="absolute z-20 flex items-center justify-center pointer-events-none"
                    style={hoverRowStyle}
                >
                    <div {...dragProps} className="relative shrink-0 pointer-events-auto">
                        <StationGearBadge
                            recipe={gear.recipe}
                            pulsing={gear.pulsing}
                            isFoundation={gear.isFoundation}
                            isField={!!gear.isField}
                            onClick={gear.onClick}
                            px={gearPx}
                        />
                    </div>
                </div>
            )}

            {showProblem && (
                <div
                    data-bubble-row="above"
                    className="absolute z-20 flex items-end justify-center pointer-events-none"
                    style={{ left: 0, width: boxPx, top: artTop, transform: 'translateY(-100%)' }}
                >
                    {gearInMark ? (
                        <div {...dragProps} data-gear-in-mark={problem.kind} className="relative shrink-0 pointer-events-auto">
                            <StationGearBadge
                                recipe={gear.recipe}
                                pulsing={gear.pulsing}
                                isFoundation={gear.isFoundation}
                                isField={!!gear.isField}
                                onClick={gear.onClick}
                                px={gearPx}
                            />
                        </div>
                    ) : (
                        <ProblemMark problem={problem} tip={problemTip} artUnit={artUnit} dragProps={dragProps} onClick={problemClick} />
                    )}
                </div>
            )}

            {marked && (
                <div
                    data-bubble-row="middle"
                    className="absolute z-20 flex items-center justify-center pointer-events-none"
                    style={{ left: 0, width: boxPx, top: boxPx / 2, transform: 'translateY(-50%)', gap: ROW_GAP_U }}
                >
                    <Bubble of={instanceId} kind="marked" inline tip={BUBBLE_TIPS.marked} dragProps={dragProps}>
                        <MarkedBadge title={BUBBLE_TIPS.marked} />
                    </Bubble>
                </div>
            )}
        </>
    );
};
