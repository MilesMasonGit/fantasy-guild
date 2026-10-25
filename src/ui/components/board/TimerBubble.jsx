import { useEffect, useState } from 'react';
import { RingBadge } from './RingBadge.jsx';
import { Bubble } from './Bubble.jsx';
import { turnCountdownText } from './centreAlert.js';
import { TURN_COUNTDOWN_REFRESH_MS, turnFraction, bubbleSlot } from './ringRow.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { formatDuration } from '../drawer/lifecycleLines.js';

/** What the bubble draws from one read of the clock, or null. */
function viewOf(roll) {
    const text = roll ? turnCountdownText(roll.inMs) : null;
    if (!text) return null;
    // A resting Token's ring fills as it refills.
    if (roll.kind === 'respawn') {
        return {
            kind: 'respawn',
            text,
            fraction: Number((1 - turnFraction(roll.inMs, roll.everyMs)).toFixed(3)),
            // Non-breaking, so the tip never wraps between the number and its unit.
            title: roll.paused
                ? `Resting. Refills only with ${(roll.needsNearby || []).map(id => tokenName(id) || id).join(' or ')} nearby`
                : `Resting. Refills in ${formatDuration(roll.inMs).replace(/ /g, ' ')}`
        };
    }
    const chance = `${roll.chance}% chance`;
    let title;
    if (roll.kind === 'grow') title = `Grows into ${tokenName(roll.into) || 'something new'} in ${text}`;
    else if (roll.kind === 'ripen') title = `${getRecipe(roll.cropId)?.name || 'Its crop'} ripe in ${text}`;
    else if (roll.back) title = `Next roll to turn back in ${text} (${chance})`;
    else title = `Next roll to turn into something else in ${text} (${chance})`;
    return {
        kind: roll.kind === 'grow' || roll.kind === 'ripen' ? 'grow' : 'turn',
        text,
        fraction: Number(turnFraction(roll.inMs, roll.everyMs).toFixed(3)),
        title
    };
}

const sameView = (a, b) => a === b || (!!a && !!b && a.text === b.text && a.fraction === b.fraction && a.title === b.title);

/**
 * TimerBubble: the top-left ring of a hovered Token that changes on a clock: a Sapling counting
 * down to its growth, a Field's crop to its ripening, a Coast to its next turn roll (or its roll to turn back), `0:34`, emptying;
 * a resting vein to its refill, filling. `TokenBubbles` mounts it only while the Token is
 * hovered, so a Token at rest polls nothing.
 * The clock runs on game time (the engine's `delta`), so the bubble polls it every {@link
 * TURN_COUNTDOWN_REFRESH_MS} rather than keeping its own; only this bubble re-renders on it.
 * `read()` returns `{ kind: 'grow' | 'ripen' | 'turn' | 'respawn', inMs, everyMs, ... }` or null (then
 * no bubble).
 */
export const TimerBubble = ({ read, boxPx, small = false, dragProps = null }) => {
    const [view, setView] = useState(() => (read ? viewOf(read() ?? null) : null));

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
    return (
        <Bubble kind="timer" style={bubbleSlot('timer', { boxPx, small })} tip={view.title} dragProps={dragProps}>
            <RingBadge kind={view.kind} fraction={view.fraction} text={view.text} title={view.title} />
        </Bubble>
    );
};

export default TimerBubble;
