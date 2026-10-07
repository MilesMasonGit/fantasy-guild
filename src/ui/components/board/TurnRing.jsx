import { useEffect, useState } from 'react';
import { RingBadge } from './RingBadge.jsx';
import { turnCountdownText } from './centreAlert.js';
import { TURN_COUNTDOWN_REFRESH_MS, turnFraction } from './ringRow.js';

/** What the ring draws from one read of the clock, or null. */
function viewOf(roll) {
    const text = roll ? turnCountdownText(roll.inMs) : null;
    if (!text) return null;
    return {
        text,
        fraction: Number(turnFraction(roll.inMs, roll.everyMs).toFixed(3)),
        title: `Next chance to ${roll.back ? 'turn back' : 'turn'} in ${text} (${roll.chance}%)`
    };
}

const sameView = (a, b) => a === b || (!!a && !!b && a.text === b.text && a.fraction === b.fraction && a.title === b.title);

/**
 * TurnRing: a turning Token's standing ring: time to its next roll, `0:34`, emptying toward
 * the roll. On a Coast it counts to its next chance to turn; on the Shrimp Coast it became, to
 * its chance to turn back (the same authored cycle, read from the original).
 * The clock runs on game time (the engine's `delta`), so the ring polls it every {@link
 * TURN_COUNTDOWN_REFRESH_MS} rather than keeping its own. The poll lives here so only this
 * ring re-renders on it, never the MatToken, and only when what it draws changed. `read()`
 * returns `TimedChanges.nextTurnRoll` for the Token plus its `everyMs`, or null (then no
 * ring).
 */
export const TurnRing = ({ read }) => {
    const [view, setView] = useState(() => viewOf(read?.() ?? null));
    useEffect(() => {
        if (!read) return undefined;
        const refresh = () => {
            const next = viewOf(read() ?? null);
            setView(prev => (sameView(prev, next) ? prev : next));
        };
        refresh();
        const timer = setInterval(refresh, TURN_COUNTDOWN_REFRESH_MS);
        return () => clearInterval(timer);
    }, [read]);

    if (!view) return null;
    return <RingBadge kind="turn" fraction={view.fraction} text={view.text} title={view.title} />;
};

export default TurnRing;
