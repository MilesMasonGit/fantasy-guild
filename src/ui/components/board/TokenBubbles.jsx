import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as Growth from '../../../systems/board/Growth.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { enemyProfileOf } from '../../../config/registries/enemyProfile.js';
import { subscribeToken, subscribeEvery } from './tokenEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { Bubble } from './Bubble.jsx';
import { HealthBar } from './HealthBar.jsx';
import { enemyBarPlace, fightBarShift } from './healthBar.js';
import { RecipeBubble, SpriteBubble } from './RecipeBubble.jsx';
import { spotFishIds } from './spotFish.js';
import * as Fishing from '../../../systems/board/Fishing.js';
import { isCapSeen, seeCap, capAlertNow } from './capSeen.js';
import { StationGearBadge, MarkedBadge } from './TokenBadges.jsx';
import { ProblemMark } from './ProblemMark.jsx';
import { problemOf, tokenGearPx } from './problemMark.js';
import { createWorkBar, shareWorkBar } from './workBar.js';
import { shareCycle } from './cycleShare.js';
import { plateUnit } from './matMarks.js';
import { useMatFit } from './MatFitContext.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';

const CHOOSE_KINDS = new Set([ALERT.CHOOSE_RECIPE, ALERT.CHOOSE_BUILD, ALERT.CHOOSE_CAMP]);

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
 * happening and what is wrong, and no numbers, and nothing on it has a tooltip: the reasons are
 * on the Token's card (docs/active/concept_playmat_declutter.md §3, §11, §12, §15):
 * - **The work bar's model** (`workBar.js`): fed here from the Token's engine events and drawn
 * under the Token and its hero (`WorkBarLayer`) with the time one cycle takes. Fills each cycle on
 * the shared step clock; empty again on `CYCLE_COMPLETE`. Any engine alert on the worked Token
 * stops the cycle, so the bar holds there, grey.
 * - **The centre** holds one thing at a time:
 *   - a Token marked for demolition: its demolition badge, the whole time (over any '!');
 *   - the pointer on a Token that takes a recipe: the gear, at once, pulsing while nothing is
 *   chosen (`pointerOn`, the bare hover: the Token already redraws then for its outline). A
 *   click does what a right-click does: it opens the card;
 *   - otherwise its problem mark (`ProblemMark`), still: one, yellow while it waits (items, a
 *   Token beside it, charges, a choice, a full Token cap) or red when it can't (no room, a hero
 *   who can't do the work). From the engine's alert, a spawner's stuck alert
 *   (`SPAWNER_ALERT_CHANGED`, read once on mount), a growing Token's (a Stump that needs its
 *   Forest or a seedling: `GROWTH_ALERT_CHANGED`, likewise), or nothing chosen on a station. A
 *   spawner's full-cap '!' goes once the pointer has rested on it (`capSeen.js`).
 * - **Enemy health bar** (above the box): in a fight, and while an enemy is hovered. In a fight
 * the mat hands it `fightBar` (`{ host, left, top }`: the fight layer's node and this box's
 * corner in mat units) and the bar draws there, over the loot (`FightBarHost`).
 * - **The recipe bubble** (`RecipeBubble`): resting on a Token with a recipe chosen, its output
 * in a speech bubble over the art. Resting on a water (a fishing spot), the fish it can give
 * where it stands, in the same bubble.
 * `isHovered` is the mat's rest (`useHoverRest`), not the bare hover: the pointer has stayed on
 * the Token for a moment, so a sweep across the mat mounts none of the rested things.
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

    // A full Token cap, once the pointer has rested on this spawner, is seen and not drawn until
    // the cap frees and fills again (`capSeen.js`).
    const [capSeen, setCapSeen] = useState(() => (instanceId ? isCapSeen(instanceId) : false));
    useEffect(() => {
        if (instanceId) setCapSeen(capAlertNow(instanceId, stuck?.alert ?? null));
    }, [instanceId, stuck]);
    const capFull = stuck?.alert === ALERT.SPAWN_MAT_FULL;
    useEffect(() => {
        if (!isHovered || !capFull || !instanceId) return;
        seeCap(instanceId);
        setCapSeen(true);
    }, [isHovered, capFull, instanceId]);
    const spawner = capFull && capSeen ? null : stuck;

    // A marked Token runs no recipe, so there is nothing to choose.
    const choose = gear?.pulsing && !marked ? (gear.isFoundation ? 'build' : gear.isHideout ? 'camp' : gear.isLaboratory ? 'node' : 'recipe') : null;
    const problem = useMemo(() => problemOf({ alert, spawner, growth, choose }), [alert, spawner, growth, choose]);
    const problemClick = problem && CHOOSE_KINDS.has(problem.kind) ? gear?.onClick ?? null : null;

    const barUnit = plateUnit(useMatFit() || 1);

    // Read only while rested on: a spot's place does not change under it.
    const fish = useMemo(() => {
        if (!isHovered || marked || !instanceId) return null;
        const def = getTokenType(typeId);
        if (!Fishing.isWater(def)) return null;
        const ids = spotFishIds(Fishing.poolsHere(def, BoardState.getTokenById(instanceId)));
        return ids.length ? ids : null;
    }, [isHovered, marked, instanceId, typeId]);

    if (isDragging) return null;

    const fight = hasHero && combat;
    // The bar's numbers: the fight's, else a full enemy (an enemy nobody fights is whole).
    const barHp = hp ?? (enemyHp ? { cur: enemyHp, max: enemyHp } : null);
    const showHp = (fight || (isHovered && !!enemyHp)) && !!barHp && barHp.max > 0;
    // The centre holds one thing: the demolition badge, else the gear while the pointer is on the
    // Token, else the '!'. ⚠️ The hover is the Token's (its circle, `MatBoard`), not the centre's,
    // so the swap cannot take the hover away; and the gear is the mark's size, so nothing moves.
    // The '!' no longer shares the space over the art with an enemy's health bar.
    const showGear = !!gear?.show && !marked && (pointerOn || isHovered);
    const showProblem = !!problem && !fight && !marked && !showGear;
    const gearPx = tokenGearPx(artUnit);
    const centreStyle = { left: 0, width: boxPx, top: boxPx / 2, transform: 'translateY(-50%)', gap: ROW_GAP_U };
    // The art's top edge in the box (the art is centred in it): the recipe bubble's tail stands on it.
    const artTop = (boxPx - (artPx ?? boxPx)) / 2;
    // Resting on a station with a recipe chosen (not a Foundation's building, not while marked).
    const showRecipe = isHovered && !!gear?.show && !!gear.recipe && !gear.isFoundation && !marked;

    return (
        <>
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

            {showRecipe && <RecipeBubble recipe={gear.recipe} boxPx={boxPx} top={artTop} u={barUnit} />}
            {!showRecipe && fish && <SpriteBubble ids={fish} boxPx={boxPx} top={artTop} u={barUnit} data-fish-bubble={fish.join(' ')} />}

            {(showGear || showProblem || marked) && (
                <div
                    data-bubble-row="centre"
                    className="absolute z-20 flex items-center justify-center pointer-events-none"
                    style={centreStyle}
                >
                    {marked ? (
                        <Bubble of={instanceId} kind="marked" inline dragProps={dragProps}>
                            <MarkedBadge />
                        </Bubble>
                    ) : showGear ? (
                        <div {...dragProps} data-gear-centre={problem?.kind || 'set'} className="relative shrink-0 pointer-events-auto">
                            <StationGearBadge
                                pulsing={gear.pulsing}
                                isFoundation={gear.isFoundation}
                                isField={!!gear.isField}
                                onClick={gear.onClick}
                                px={gearPx}
                            />
                        </div>
                    ) : (
                        <ProblemMark problem={problem} artUnit={artUnit} dragProps={dragProps} onClick={problemClick} />
                    )}
                </div>
            )}
        </>
    );
};
