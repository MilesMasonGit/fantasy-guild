import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { cn } from '../../utils/cn.js';

/**
 * TileProgressBar — zero-re-render cycle progress bar at the bottom of a tile frame.
 *
 * Uses requestAnimationFrame continuous interpolation to guarantee 60fps buttery-smooth
 * filling between engine ticks, with instantaneous zero-reset on cycle completion.
 * Remains visible throughout active work cycles rather than popping in and out.
 * Displays "Need Items" or "Need Tokens" when blocked, expanding to "Required:" and
 * dropping down missing requirement rows on hover.
 */
export const TileProgressBar = ({ tile, token = null, isHovered = false, alert: initialAlert = null, className }) => {
    const containerRef = useRef(null);
    const fillRef = useRef(null);
    const labelRef = useRef(null);
    const { EventBus } = useEngine();
    const [eventAlert, setEventAlert] = useState(initialAlert || token?.alert || null);

    // Compute missing items or tokens list regardless of staffing state
    const missingReqs = useMemo(() => {
        if (!token) return { type: null, items: [] };
        return getMissingRequirements(tile, token);
    }, [tile, token]);

    // Effective alert: uses active board engine alert or static requirement check
    const effectiveAlert = useMemo(() => {
        if (eventAlert) return eventAlert;
        if (token?.alert) return token.alert;
        if (missingReqs.type === 'tokens') return 'no_recipe';
        if (missingReqs.type === 'items') return 'inputs';
        return null;
    }, [eventAlert, token?.alert, missingReqs.type]);

    // Sync label text when hover state changes while an alert is active
    useEffect(() => {
        if (!labelRef.current) return;
        if (effectiveAlert) {
            if (isHovered && missingReqs.items?.length > 0) {
                labelRef.current.textContent = 'Required:';
            } else {
                labelRef.current.textContent = effectiveAlert === 'inputs' ? 'Need Items' : 'Need Tokens';
            }
        }
    }, [isHovered, effectiveAlert, missingReqs]);

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
        let currentAlert = effectiveAlert;

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

            if (alertType === 'inputs') {
                active = false;
                cancelAnimationFrame(rafId);
                container.style.opacity = '1';
                fill.style.width = '100%';
                fill.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--yellow-chroma';
                label.textContent = isHovered && missingReqs.items?.length > 0 ? 'Required:' : 'Need Items';
            } else if (alertType === 'no_recipe' || alertType === 'conflict') {
                active = false;
                cancelAnimationFrame(rafId);
                container.style.opacity = '1';
                fill.style.width = '100%';
                fill.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--red-chroma';
                label.textContent = isHovered && missingReqs.items?.length > 0 ? 'Required:' : 'Need Tokens';
            } else if (!alertType) {
                fill.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma';
                if (!token?.heroId) {
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
            active = false;
            cancelAnimationFrame(rafId);
            if (!effectiveAlert && !token?.heroId) {
                if (containerRef.current) containerRef.current.style.opacity = '0';
                if (fillRef.current) {
                    fillRef.current.style.width = '0%';
                    fillRef.current.className = 'absolute left-0 top-0 bottom-0 rounded-full progress-fill--white-chroma';
                }
                if (labelRef.current) labelRef.current.textContent = '';
            } else if (effectiveAlert) {
                renderAlert(effectiveAlert);
            }
        };

        if (effectiveAlert) {
            renderAlert(effectiveAlert);
        } else if (!token?.heroId) {
            if (containerRef.current) containerRef.current.style.opacity = '0';
        }

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
            unsubs.forEach(u => u());
        };
    }, [EventBus, tile, effectiveAlert, isHovered, missingReqs, token?.heroId]);

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
            {isHovered && effectiveAlert && missingReqs.items?.length > 0 && (
                <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 min-w-[90px] max-w-[150px] z-40 bg-black/90 backdrop-blur-md border border-white/20 rounded-md py-1.5 px-2.5 shadow-2xl flex flex-col items-center gap-0.5 pointer-events-none">
                    {/* Subheader: Items or Tokens */}
                    <span className="text-[8px] font-bold font-mono text-white/90 gi-text-outline tracking-wider select-none leading-none pb-0.5 border-b border-white/15 w-full text-center mb-0.5">
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
                </div>
            )}
        </div>
    );
};

export default TileProgressBar;
