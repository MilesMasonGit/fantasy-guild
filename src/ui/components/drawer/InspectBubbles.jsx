import { useEffect, useState } from 'react';
import { RingBadge } from '../board/RingBadge.jsx';
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

const InspectBubble = ({ name, label, bubble }) => (
    <div data-inspect-bubble={name} className="flex flex-col items-center gap-1" title={bubble.title}>
        <RingBadge kind={bubble.kind} fraction={bubble.fraction} text={bubble.text} title={bubble.title} />
        <span className="text-[10px] uppercase tracking-wider text-gi-muted">{label}</span>
    </div>
);

/**
 * Charges, time and XP as the same ring bubbles the mat draws. Opened from a board Token
 * (`instanceId`) they are live: charges follow the Token's charges, and while a hero works it the
 * time bubble counts down and the XP bubble fills with the cycle. Opened from the Shop they show
 * the Token type's starting values.
 */
export const InspectBubbles = ({ def, instanceId = null }) => {
    const detail = useTokenDetail(instanceId, def);
    const instance = instanceId ? BoardState.getTokenById(instanceId) : null;
    const progress = useCycleProgress(instanceId, !!detail?.heroId);

    // ⚠️ The recipe a station is running changes its time and XP, so ask the engine, not the def.
    const io = instance ? effectiveIO(instanceId, instance) : null;
    const bubbles = inspectBubbles({
        uses: instance ? (detail?.usesRemaining ?? null) : (def.uses ?? null),
        startingUses: def.uses ?? null,
        cycleMs: progress?.cycleMs ?? io?.cycleTimeMs ?? def.config?.cycleTimeMs ?? 0,
        elapsedMs: progress?.elapsedMs ?? 0,
        xp: io?.xp ?? def.config?.xp ?? 0
    });

    return (
        <div data-inspect-bubbles className="flex items-start justify-center gap-4 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
            <InspectBubble name="charges" label="Charges" bubble={bubbles.charges} />
            {bubbles.time && <InspectBubble name="time" label="Time" bubble={bubbles.time} />}
            {bubbles.xp && <InspectBubble name="xp" label="XP" bubble={bubbles.xp} />}
        </div>
    );
};

export default InspectBubbles;
