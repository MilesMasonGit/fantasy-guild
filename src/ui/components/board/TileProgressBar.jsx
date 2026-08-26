import { useEffect, useRef, useState, useMemo } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { cn } from '../../utils/cn.js';
import { ALERT_HINT, ALERT_LABEL, alertFillClass } from './boardConstants.js';

/**
 * TileProgressBar — zero-re-render cycle progress bar at the bottom of a tile frame.
 *
 * Uses requestAnimationFrame continuous interpolation to guarantee 60fps buttery-smooth
 * filling between engine ticks, with instantaneous zero-reset on cycle completion.
 * Remains visible throughout active work cycles rather than popping in and out.
 * Prints a short label from `ALERT_LABEL` when blocked ("Need Items", "Wrong
 * Skill", ...) and, on hover, drops down the `ALERT_HINT` sentence for that
 * alert (D-114) followed by the missing requirement rows when there are any.
 * Every alert value the engine can set gets a branch — CR2-155 was three of
 * them falling off the end of `renderAlert`, leaving a stalled tile showing a
 * countdown for work that would never finish.
 *
 * ## The subscriptions are keyed on the tile and nothing else (CR2-168 item 1)
 * ⚠️ They used to be keyed on `isHovered`, `missingReqs`, `effectiveAlert` and
 * `token?.heroId` as well. Two consequences, both measured 2026-08-26:
 *
 *  - Moving the cursor onto a tile tore down all four subscriptions, rebuilt
 *    them, and **cancelled the animation frame** — so the bar stopped filling
 *    and stayed stopped until the next `board:progress` event, up to ~300ms.
 *  - `missingReqs` is a fresh object whenever the `token` prop changes
 *    identity, and `Board` rebuilds a fresh projection object per tile on
 *    every `state_changed`. Five re-renders with identical content cost
 *    **twenty** extra subscribe calls.
 *
 * Everything the handlers need now lives in `liveRef`, refreshed on each
 * render. Anything added to this component that the handlers read must go
 * through that ref, not through the dependency array.
 */
export const TileProgressBar = ({ tile, token = null, isHovered = false, alert: initialAlert = null, className }) => {
    const containerRef = useRef(null);
    const fillRef = useRef(null);
    const labelRef = useRef(null);
    const { EventBus } = useEngine();
    const [eventAlert, setEventAlert] = useState(initialAlert || token?.alert || null);

    const hasHero = !!token?.heroId;

    // Compute missing items or tokens list regardless of staffing state
    const missingReqs = useMemo(() => {
        if (!token) return { type: null, items: [] };
        return getMissingRequirements(tile, token);
    }, [tile, token]);

    // Effective alert: only applicable while a hero is assigned to work the token
    const effectiveAlert = useMemo(() => {
        if (!hasHero) return null;
        if (eventAlert) return eventAlert;
        if (token?.alert) return token.alert;
        if (missingReqs.type === 'tokens') return 'no_recipe';
        if (missingReqs.type === 'items') return 'inputs';
        return null;
    }, [hasHero, eventAlert, token?.alert, missingReqs.type]);

    // Sync label text when hover state changes while an alert is active
    useEffect(() => {
        if (!labelRef.current) return;
        if (effectiveAlert) {
            if (isHovered && missingReqs.items?.length > 0) {
                labelRef.current.textContent = 'Required:';
            } else {
                labelRef.current.textContent = ALERT_LABEL[effectiveAlert] || 'Blocked';
            }
        }
    }, [isHovered, effectiveAlert, missingReqs]);

    // Everything the event handlers below read that is NOT `tile`. Kept in a
    // ref so a hover, a new `token` object or a changed alert re-renders
    // without touching the subscriptions (CR2-168 item 1).
    const liveRef = useRef({ isHovered, missingReqs, effectiveAlert, hasHero });
    liveRef.current = { isHovered, missingReqs, effectiveAlert, hasHero };

    // The imperative "draw the current state" pass, published by the
    // subscription effect for the alert effect below to call.
    const applyCurrentRef = useRef(null);

    useEffect(() => {
        if (!EventBus) return;

        let active = false;
        let lastElapsed = 0;
        let cycleTime = 10000;
        let lastTimestamp = performance.now();
        let rafId = null;
        let isCombat = false;
        let enemyHp = 0;
        let enemyMaxHp = 0;
        let currentAlert = liveRef.current.effectiveAlert;

        const updateFrame = () => {
            if (!active) return;
            const now = performance.now();
            const dt = now - lastTimestamp;
            lastTimestamp = now;

            if (!isCombat && cycleTime > 0) {
                lastElapsed = Math.min(cycleTime, lastElapsed + dt);
                const percent = Math.min(100, (lastElapsed / cycleTime) * 100);
                if (fillRef.current) {
                    fillRef.current.style.width = `${percent}%`;
                }
            }

            rafId = requestAnimationFrame(updateFrame);
        };

        const renderAlert = (alertType) => {
            const container = containerRef.current;
            const fill = fillRef.current;
            const label = labelRef.current;
            if (!container || !fill || !label) return;

            currentAlert = alertType;

            if (alertType) {
                // One branch for every alert value. It used to be two, and the
                // three values with no branch left the bar mid-countdown.
                active = false;
                cancelAnimationFrame(rafId);
                container.style.opacity = '1';
                fill.style.width = '100%';
                fill.className = `absolute left-0 top-0 bottom-0 rounded-full ${alertFillClass(alertType)}`;
                const live = liveRef.current;
                label.textContent = live.isHovered && live.missingReqs.items?.length > 0
                    ? 'Required:'
                    : (ALERT_LABEL[alertType] || 'Blocked');
            } else {
                fill.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma';
                if (!liveRef.current.hasHero) {
                    container.style.opacity = '0';
                }
            }
        };

        const apply = (p) => {
            if (currentAlert) return; // Alert overrides normal cycle
            const container = containerRef.current;
            const fill = fillRef.current;
            const label = labelRef.current;
            if (!container || !fill) return;

            container.style.opacity = '1';
            fill.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma';

            isCombat = !!p?.combat;
            if (isCombat) {
                enemyHp = p.enemyHp;
                enemyMaxHp = p.enemyMaxHp;
                const hpPercent = enemyMaxHp > 0 ? (enemyHp / enemyMaxHp) * 100 : 0;
                fill.style.width = `${hpPercent}%`;
                if (label) label.textContent = `${enemyHp}/${enemyMaxHp} HP`;
            } else {
                cycleTime = p?.cycleTimeMs || 10000;
                lastElapsed = p?.elapsedMs != null ? p.elapsedMs : ((p?.percent || 0) / 100) * cycleTime;
                lastTimestamp = performance.now();

                const percent = Math.max(0, Math.min(100, (lastElapsed / cycleTime) * 100));
                fill.style.width = `${percent}%`;

                if (label && p?.cycleTimeMs) {
                    const sec = p.cycleTimeMs / 1000;
                    label.textContent = Number.isInteger(sec) ? `${sec}s` : `${sec.toFixed(1)}s`;
                }
            }

            if (!active) {
                active = true;
                lastTimestamp = performance.now();
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(updateFrame);
            }
        };

        const onCycleComplete = () => {
            if (currentAlert) return;
            lastElapsed = 0;
            lastTimestamp = performance.now();
            if (fillRef.current) {
                fillRef.current.style.width = '0%';
            }
        };

        const onTileChanged = () => {
            const { effectiveAlert: alertNow, hasHero: hasHeroNow } = liveRef.current;
            active = false;
            cancelAnimationFrame(rafId);
            if (!alertNow && !hasHeroNow) {
                if (containerRef.current) containerRef.current.style.opacity = '0';
                if (fillRef.current) {
                    fillRef.current.style.width = '0%';
                    fillRef.current.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma';
                }
                if (labelRef.current) labelRef.current.textContent = '';
            } else if (alertNow) {
                renderAlert(alertNow);
            }
        };

        // Re-draw whatever the bar should currently show. Called on mount and
        // whenever the alert or staffing changes, by the effect below — which
        // deliberately owns no subscriptions of its own.
        applyCurrentRef.current = () => {
            const { effectiveAlert: alertNow, hasHero: hasHeroNow } = liveRef.current;
            if (alertNow) {
                renderAlert(alertNow);
            } else {
                // Leaving an alert state must clear it, or the bar stays
                // stuck full and red after the blockage is cleared.
                currentAlert = null;
                if (fillRef.current) {
                    fillRef.current.className =
                        'absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma';
                }
                if (!hasHeroNow && containerRef.current) {
                    containerRef.current.style.opacity = '0';
                    if (fillRef.current) fillRef.current.style.width = '0%';
                    if (labelRef.current) labelRef.current.textContent = '';
                }
            }
        };

        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => {
                if (p?.tile !== tile) return;
                apply(p);
            }),
            EventBus.subscribe(BOARD_EVENTS.ALERT_CHANGED, (p) => {
                if (p?.tile !== tile) return;
                setEventAlert(p?.alert || null);
                renderAlert(p?.alert);
            }),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
                if (p?.tile === tile) onCycleComplete();
            }),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
                if (p?.tile === tile) onTileChanged();
            })
        ];

        return () => {
            active = false;
            cancelAnimationFrame(rafId);
            applyCurrentRef.current = null;
            unsubs.forEach(u => u());
        };
        // ⚠️ `tile` and `EventBus` ONLY. See the note at the top of the file —
        // anything else these handlers need is read from `liveRef`.
    }, [EventBus, tile]);

    // The cheap half of the old effect: redraw when the alert or the staffing
    // changes. Declared after the subscription effect so `applyCurrentRef` is
    // already populated on mount; `tile` is listed because a bar reused for a
    // different tile has to redraw for its new one.
    useEffect(() => {
        applyCurrentRef.current?.();
    }, [tile, effectiveAlert, hasHero]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "absolute bottom-0 translate-y-[3px] left-2 right-2 z-20 pointer-events-none",
                "h-3 transition-opacity duration-200",
                className
            )}
            style={{ opacity: 0 }}
        >
            {/* Track + Swirling Chroma Fill */}
            <div className="relative w-full h-full overflow-hidden rounded-full border border-white/30 bg-black/85 shadow-[inset_0_1px_4px_rgba(0,0,0,0.9)] flex items-center justify-center">
                <div
                    ref={fillRef}
                    className="absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma"
                    style={{ width: '0%' }}
                />
            </div>

            {/* Centered Floating Label — overflows the bar cleanly */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                <span
                    ref={labelRef}
                    className="text-[8px] font-bold font-mono text-white gi-text-outline tracking-wider select-none leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                />
            </div>

            {/* Dropdown list of missing requirements on hover */}
            {isHovered && effectiveAlert && (
                <div
                    data-tile-alert-hint={effectiveAlert}
                    className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 min-w-[90px] max-w-[170px] z-40 bg-black/90 backdrop-blur-md border border-white/20 rounded-md py-1.5 px-2.5 shadow-2xl flex flex-col items-center gap-0.5 pointer-events-none"
                >
                    {/* The whole point (D-114): what is wrong, in a sentence. */}
                    {ALERT_HINT[effectiveAlert] && (
                        <span className="text-[9px] font-bold font-sans text-gi-gold text-center leading-snug tracking-tight select-none">
                            {ALERT_HINT[effectiveAlert]}
                        </span>
                    )}
                    {missingReqs.items?.length > 0 && (
                        <>
                            {/* Subheader: Items or Tokens */}
                            <span className="text-[8px] font-bold font-mono text-white/90 gi-text-outline tracking-wider select-none leading-none pt-1 pb-0.5 border-t border-white/15 w-full text-center mb-0.5 mt-0.5">
                                {missingReqs.type === 'items' ? 'Items' : 'Tokens'}
                            </span>
                            {missingReqs.items.map((name, i) => (
                                <span
                                    key={i}
                                    className="text-[9px] font-bold font-mono text-white tracking-wide whitespace-nowrap gi-text-outline leading-tight"
                                >
                                    {name}
                                </span>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default TileProgressBar;
