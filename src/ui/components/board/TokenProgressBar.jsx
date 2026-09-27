import { useEffect, useRef } from 'react';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { cn } from '../../utils/cn.js';
import { TOKEN_BAR_GAP_U } from './boardConstants.js';
import { subscribeToken } from './tokenEvents.js';

/**
 * TokenProgressBar — zero-re-render cycle progress bar in the gap below a
 * Token (TP-2, TP-4, Token work presentation), at the Token's own width.
 *
 * Uses requestAnimationFrame continuous interpolation to guarantee 60fps buttery-smooth
 * filling between engine ticks, with instantaneous zero-reset on cycle completion.
 * Remains visible throughout active work cycles rather than popping in and out.
 *
 * ⭐ It says nothing about problems any more (B1.1, TL-14, TL-22). A worked
 * Token that cannot work shows the red or yellow mark at its centre instead
 * (`TokenCentreAlert`), with the `ALERT_HINT` sentence and the missing
 * requirements on hover. While the Token has an alert this bar simply hides.
 *
 * ## The subscriptions are keyed on the Token and nothing else (CR2-168 item 1)
 * ⚠️ They used to be keyed on hover state, the missing requirements, the alert
 * and the hero as well. Two consequences, both measured 2026-08-26:
 *
 *  - Moving the cursor onto a Token tore down all the subscriptions, rebuilt
 *    them, and **cancelled the animation frame** — so the bar stopped filling
 *    and stayed stopped until the next `board:progress` event, up to ~300ms.
 *  - The board rebuilds a fresh projection object on every `state_changed`,
 *    so anything derived from `token` churned the subscriptions every tick.
 *
 * Everything the handlers need now lives in `liveRef`, refreshed on each
 * render. Anything added to this component that the handlers read must go
 * through that ref, not through the dependency array.
 *
 * ## Which events reach it (slice 1.6c-2)
 * Through `tokenEvents.js`, so ~80 bars share **one** bus subscription per
 * event type and a progress tick wakes only the bar it is about. It needs no
 * `ALERT_CHANGED` of its own: `MatToken` re-reads `instance.alert` on that
 * event and hands it down as `token.alert`.
 */
export const TokenProgressBar = ({ instanceId = null, token = null, alert = null, className }) => {
    const containerRef = useRef(null);
    const fillRef = useRef(null);
    const labelRef = useRef(null);

    const hasHero = !!token?.heroId;
    // Any engine alert means the Token is not working: the bar steps aside
    // for the centre mark (or, for "nothing chosen", the gear).
    const blocked = !!(alert || token?.alert);

    // Everything the event handlers below read that is NOT `instanceId`
    // (CR2-168 item 1).
    const liveRef = useRef({ hasHero, blocked });
    liveRef.current = { hasHero, blocked };

    // The imperative "draw the current state" pass, published by the
    // subscription effect for the staffing effect below to call.
    const applyCurrentRef = useRef(null);

    useEffect(() => {
        if (!instanceId) return undefined;

        let active = false;
        let lastElapsed = 0;
        let cycleTime = 10000;
        let lastTimestamp = performance.now();
        let rafId = null;
        let isCombat = false;

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

        const hide = () => {
            active = false;
            cancelAnimationFrame(rafId);
            if (containerRef.current) containerRef.current.style.opacity = '0';
            if (fillRef.current) fillRef.current.style.width = '0%';
            if (labelRef.current) labelRef.current.textContent = '';
        };

        const apply = (p) => {
            if (liveRef.current.blocked) return;
            const container = containerRef.current;
            const fill = fillRef.current;
            const label = labelRef.current;
            if (!container || !fill) return;

            container.style.opacity = '1';

            isCombat = !!p?.combat;
            if (isCombat) {
                const enemyHp = p.enemyHp;
                const enemyMaxHp = p.enemyMaxHp;
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
            if (liveRef.current.blocked) return;
            lastElapsed = 0;
            lastTimestamp = performance.now();
            if (fillRef.current) {
                fillRef.current.style.width = '0%';
            }
        };

        const onTokenChanged = () => {
            active = false;
            cancelAnimationFrame(rafId);
            if (!liveRef.current.hasHero) hide();
        };

        // Called on mount and whenever staffing or the alert changes, by the
        // effect below — which deliberately owns no subscriptions of its own.
        applyCurrentRef.current = () => {
            const { hasHero: hasHeroNow, blocked: blockedNow } = liveRef.current;
            if (!hasHeroNow || blockedNow) hide();
        };

        const unsubs = [
            subscribeToken(BOARD_EVENTS.PROGRESS, instanceId, apply),
            subscribeToken(BOARD_EVENTS.CYCLE_COMPLETE, instanceId, onCycleComplete),
            subscribeToken(BOARD_EVENTS.TILE_CHANGED, instanceId, onTokenChanged)
        ];

        return () => {
            active = false;
            cancelAnimationFrame(rafId);
            applyCurrentRef.current = null;
            unsubs.forEach(u => u());
        };
        // ⚠️ `instanceId` ONLY. See the note at the top of the file — anything
        // else these handlers need is read from `liveRef`.
    }, [instanceId]);

    // Redraw when the staffing or the alert changes. Declared after the
    // subscription effect so `applyCurrentRef` is already populated on mount;
    // `instanceId` is listed because a bar reused for a different Token has to
    // redraw for its new one.
    useEffect(() => {
        applyCurrentRef.current?.();
    }, [instanceId, hasHero, blocked]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "absolute left-0 right-0 top-full z-20 pointer-events-none",
                "h-3 transition-opacity duration-200",
                className
            )}
            style={{ opacity: 0, marginTop: TOKEN_BAR_GAP_U }}
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
        </div>
    );
};

export default TokenProgressBar;
