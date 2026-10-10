import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RingBadge, paintRing } from '../board/RingBadge.jsx';
import { onStep } from '../board/frameClock.js';
import { readCycle } from '../board/cycleShare.js';
import { subscribeToken } from '../board/tokenEvents.js';
import { useTokenDetail } from '../board/useTokenDetail.js';
import { chargesFraction, cycleSecondsText, ringCount } from '../board/ringRow.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { effectiveIO } from '../../../systems/board/RecipeResolver.js';

/** What each inspection bubble's tooltip says. */
export const INSPECT_BUBBLE_TIPS = Object.freeze({
    charges: (n) => (n == null ? 'Charges: unlimited' : `Charges: ${Number(n).toLocaleString()} left`),
    time: 'Work cycle: time one round of work takes',
    xp: (n) => `XP: ${n} earned each time a round of work finishes`
});

/**
 * The inspection's bubbles from plain numbers (pure, so a test can pin the wording).
 * `uses` is the live charges (null = unlimited), `startingUses` the Token's starting charges,
 * `cycleMs` / `elapsedMs` the work cycle (elapsed is 0 while nobody works it), `xp` the award.
 * A bubble is null when the Token has nothing to say for it.
 */
export function inspectBubbles({ uses, startingUses, cycleMs, elapsedMs = 0, xp = 0 }) {
    const charges = uses == null
        ? { kind: 'charges', fraction: 1, text: '∞', title: INSPECT_BUBBLE_TIPS.charges(null) }
        : {
            kind: 'charges',
            fraction: chargesFraction(uses, startingUses) ?? 1,
            text: ringCount(uses),
            title: INSPECT_BUBBLE_TIPS.charges(uses)
        };
    const hasCycle = cycleMs > 0;
    const fraction = hasCycle ? Math.max(0, Math.min(1, elapsedMs / cycleMs)) : 0;
    const time = hasCycle
        ? { kind: 'cycle', fraction, text: cycleSecondsText(elapsedMs, cycleMs), title: INSPECT_BUBBLE_TIPS.time }
        : null;
    const xpBubble = xp > 0
        ? { kind: 'xp', fraction, text: `+${ringCount(xp)}`, title: INSPECT_BUBBLE_TIPS.xp(xp) }
        : null;
    return { charges, time, xp: xpBubble };
}

/**
 * The work cycle of one board Token, live: the engine's progress ticks while a hero works it.
 * Null until a tick arrives, and again once the Token changes or nobody works it.
 */
function useCycleProgress(instanceId, working) {
    const [progress, setProgress] = useState(null);
    useEffect(() => {
        setProgress(null);
        if (!instanceId) return undefined;
        const unsubs = [
            subscribeToken(BOARD_EVENTS.PROGRESS, instanceId, (p) => {
                if (!p?.cycleTimeMs) return;
                setProgress({ elapsedMs: p.elapsedMs ?? 0, cycleMs: p.cycleTimeMs });
            }),
            subscribeToken(BOARD_EVENTS.CYCLE_COMPLETE, instanceId, () => {
                setProgress(prev => (prev ? { ...prev, elapsedMs: 0 } : prev));
            }),
            subscribeToken(BOARD_EVENTS.TILE_CHANGED, instanceId, () => setProgress(null))
        ];
        return () => unsubs.forEach(u => u());
    }, [instanceId]);
    return working ? progress : null;
}

/** `rootRef` set: a live ring, painted on the step (`paintRing`) rather than by React. */
const InspectBubble = ({ name, label, bubble, rootRef = null }) => (
    <div data-inspect-bubble={name} className="flex flex-col items-center gap-1" title={bubble.title}>
        {rootRef
            ? <RingBadge key="live" kind={bubble.kind} title={bubble.title} rootRef={rootRef} />
            : <RingBadge key="still" kind={bubble.kind} fraction={bubble.fraction} text={bubble.text} title={bubble.title} />}
        <span className="text-[10px] uppercase tracking-wider text-gi-muted">{label}</span>
    </div>
);

/**
 * While a hero works the Token, its time and XP rings are painted on the mat ring's step from
 * the mat ring's own cycle (`readCycle`), so the two always show the same fraction, frozen
 * together when it is blocked. With no mat ring to read (its bubbles not drawn), the engine's
 * last progress (`fallbackRef`).
 */
function useLiveCycleRings(instanceId, live, fallbackRef) {
    const timeRef = useRef(null);
    const xpRef = useRef(null);
    useLayoutEffect(() => {
        if (!live) return undefined;
        let last = null;
        let lastRoots = [];
        const paint = (now) => {
            const fallback = fallbackRef.current;
            const c = readCycle(instanceId, now) ?? fallback;
            const f = c.cycleMs > 0 ? Math.max(0, Math.min(1, c.elapsedMs / c.cycleMs)) : 0;
            const text = cycleSecondsText(c.elapsedMs, c.cycleMs);
            const key = `${f.toFixed(3)}|${text}|${fallback.xpText}`;
            const roots = [timeRef.current, xpRef.current];
            if (key === last && roots[0] === lastRoots[0] && roots[1] === lastRoots[1]) return;
            last = key;
            lastRoots = roots;
            paintRing(roots[0], f, text);
            paintRing(roots[1], f, fallback.xpText);
        };
        paint(performance.now());
        return onStep(paint);
    }, [instanceId, live, fallbackRef]);
    return { timeRef, xpRef };
}

/**
 * Charges, time and XP as the same ring bubbles the mat draws. Opened from a board Token
 * (`instanceId`) they are live: charges follow the Token's charges, and while a hero works it the
 * time bubble counts down and the XP bubble fills with the cycle, in step with the mat's ring.
 * Opened from the Shop they show the Token type's starting values.
 */
export const InspectBubbles = ({ def, instanceId = null }) => {
    const detail = useTokenDetail(instanceId, def);
    const instance = instanceId ? BoardState.getTokenById(instanceId) : null;
    const working = !!detail?.heroId;
    const progress = useCycleProgress(instanceId, working);

    // ⚠️ The recipe a station is running changes its time and XP, so ask the engine, not the def.
    const io = instance ? effectiveIO(instanceId, instance) : null;
    const cycleMs = progress?.cycleMs ?? io?.cycleTimeMs ?? def.config?.cycleTimeMs ?? 0;
    const bubbles = inspectBubbles({
        uses: instance ? (detail?.usesRemaining ?? null) : (def.uses ?? null),
        startingUses: def.uses ?? null,
        cycleMs,
        elapsedMs: progress?.elapsedMs ?? 0,
        xp: io?.xp ?? def.config?.xp ?? 0
    });

    const fallbackRef = useRef(null);
    fallbackRef.current = { elapsedMs: progress?.elapsedMs ?? 0, cycleMs, xpText: bubbles.xp?.text ?? null };
    const live = !!instance && working && !!bubbles.time;
    const { timeRef, xpRef } = useLiveCycleRings(instanceId, live, fallbackRef);

    return (
        <div data-inspect-bubbles className="flex items-start justify-center gap-4 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
            <InspectBubble name="charges" label="Charges" bubble={bubbles.charges} />
            {bubbles.time && <InspectBubble name="time" label="Time" bubble={bubbles.time} rootRef={live ? timeRef : null} />}
            {bubbles.xp && <InspectBubble name="xp" label="XP" bubble={bubbles.xp} rootRef={live ? xpRef : null} />}
        </div>
    );
};

export default InspectBubbles;
