import { useEffect, useRef, useState } from 'react';
import { RingBadge } from './RingBadge.jsx';
import { Bubble } from './Bubble.jsx';
import { turnCountdownText } from './centreAlert.js';
import { TURN_COUNTDOWN_REFRESH_MS, turnFraction, timerVisible, bubbleSlot } from './ringRow.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { formatDuration } from '../drawer/lifecycleLines.js';

/** What the bubble draws from one read of the clock, or null. */
function viewOf(roll) {
    const text = roll ? turnCountdownText(roll.inMs) : null;
    if (!text) return null;
    // A resting Token's ring fills as it refills, and it shows for the whole rest, not only the
    // last seconds: resting is the one thing to know about it.
    if (roll.kind === 'respawn') {
        return {
            kind: 'respawn',
            inMs: roll.inMs,
            always: true,
            text,
            fraction: Number((1 - turnFraction(roll.inMs, roll.everyMs)).toFixed(3)),
            title: `Resting. Refills in ${formatDuration(roll.inMs)}`
        };
    }
    const chance = `${roll.chance}% chance`;
    let title;
    if (roll.kind === 'grow') title = `Grows into ${tokenName(roll.into) || 'something new'} in ${text}`;
    else if (roll.back) title = `Next roll to turn back in ${text} (${chance})`;
    else title = `Next roll to turn into something else in ${text} (${chance})`;
    return {
        kind: roll.kind === 'grow' ? 'grow' : 'turn',
        inMs: roll.inMs,
        text,
        fraction: Number(turnFraction(roll.inMs, roll.everyMs).toFixed(3)),
        title
    };
}

const sameView = (a, b) => a === b || (!!a && !!b && a.text === b.text && a.fraction === b.fraction && a.title === b.title);

/**
 * TimerBubble: the top-left bubble of a Token that changes on a clock: a Sapling counting down
 * to its growth, a Coast to its next turn roll (or its roll to turn back), `0:34`, emptying; a
 * resting vein to its refill, filling. It shows while the Token is hovered and in the last few
 * seconds of the countdown, and for the whole of a rest.
 * The clock runs on game time (the engine's `delta`), so the bubble polls it every {@link
 * TURN_COUNTDOWN_REFRESH_MS} rather than keeping its own. The poll lives here so only this
 * bubble re-renders on it, never the MatToken, and while the bubble is hidden it holds no state
 * at all (a hidden bubble does not redraw each second). `read()` returns `{ kind: 'grow' | 'turn'
 * | 'respawn', inMs, everyMs, ... }` or null (then no bubble).
 */
export const TimerBubble = ({ read, hovered = false, boxPx, small = false, dragProps = null }) => {
    const [view, setView] = useState(null);
    const hoveredRef = useRef(hovered);
    hoveredRef.current = hovered;
    const refreshRef = useRef(null);

    useEffect(() => {
        if (!read) return undefined;
        const refresh = () => {
            const next = viewOf(read() ?? null);
            const show = next && (next.always || timerVisible(hoveredRef.current, next.inMs));
            setView(prev => {
                const wanted = show ? next : null;
                return sameView(prev, wanted) ? prev : wanted;
            });
        };
        refreshRef.current = refresh;
        refresh();
        const timer = setInterval(refresh, TURN_COUNTDOWN_REFRESH_MS);
        return () => { clearInterval(timer); refreshRef.current = null; };
    }, [read]);

    // Hover shows it at once, not at the next poll.
    useEffect(() => { refreshRef.current?.(); }, [hovered]);

    if (!view) return null;
    return (
        <Bubble kind="timer" style={bubbleSlot('timer', { boxPx, small })} tip={view.title} dragProps={dragProps}>
            <RingBadge kind={view.kind} fraction={view.fraction} text={view.text} title={view.title} />
        </Bubble>
    );
};

export default TimerBubble;
