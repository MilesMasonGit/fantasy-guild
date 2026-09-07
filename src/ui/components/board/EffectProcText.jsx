import { useState, useEffect, useRef } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';

/**
 * A named effect fired here — say its name, drift it upward, fade it out.
 *
 * ## Deliberately not a `TileEventAlert`
 * That component is for **problems**: it draws a persistent icon, waits to be
 * hovered, holds for five seconds and can be dismissed, because a Token with no
 * inputs is a thing the player has to go and fix. An effect firing is the
 * opposite kind of news — frequent, positive, and over the moment it happens.
 * Given the alert treatment it would clutter the board with icons nobody needs
 * to act on, and would blunt the alert icon's meaning.
 *
 * So this is the whole design: **text, rising, fading, gone.** No icon, no
 * hover, no dismissal, nothing to click. If the player misses one, nothing is
 * lost — the rule is still written on the Token.
 *
 * ## Why several can be on screen at once
 * A Token with two rules can serve both in one moment, and a busy board fires
 * often. Each announcement is its own line, stacked upward in arrival order, so
 * two effects firing together read as two things rather than one flickering
 * label. The list is capped: past a handful the tile is unreadable anyway, and
 * the oldest are the ones already fading.
 */

/** How long one line lives, in milliseconds. Rise and fade fill the whole of it. */
const LIFETIME_MS = 1600;

/** Past this many at once the tile is unreadable, so the oldest are dropped. */
const MAX_VISIBLE = 4;

let nextId = 1;

export const EffectProcText = ({ tile }) => {
    const [lines, setLines] = useState([]);
    const timers = useRef(new Map());

    useEffect(() => {
        if (!EventBus || tile == null) return undefined;

        const onFired = (payload) => {
            if (payload?.tile !== tile || !payload?.title) return;

            const id = nextId++;
            setLines((current) => [...current, { id, title: payload.title }].slice(-MAX_VISIBLE));

            // Each line removes itself. Kept in a ref so the cleanup below can
            // clear every pending one — a tile can be unmounted mid-fade when a
            // Token is picked up, and a timer firing into a dead component is
            // the classic React warning this avoids.
            const timer = setTimeout(() => {
                setLines((current) => current.filter((line) => line.id !== id));
                timers.current.delete(id);
            }, LIFETIME_MS);
            timers.current.set(id, timer);
        };

        const unsubscribe = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, onFired);

        const pending = timers.current;
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            for (const timer of pending.values()) clearTimeout(timer);
            pending.clear();
        };
    }, [tile]);

    if (lines.length === 0) return null;

    return (
        /*
         * ⚠️ Layout and type live in `components.css`, not in utility classes.
         *
         * Two things went wrong when they were utilities, both visible only in
         * the running game: `text-[10px]` lost the cascade and the label drew at
         * 16px, and `inset-x-0` pinned the container to the tile's 64px so a
         * title like "Shrimp Trawler III" was clipped to a stub. The class below
         * centres on the tile and is free to be wider than it, which is what a
         * floating label wants.
         */
        <div className="effect-proc-layer">
            {lines.map((line) => (
                <span key={line.id} className="effect-proc-text">{line.title}</span>
            ))}
        </div>
    );
};

export default EffectProcText;
