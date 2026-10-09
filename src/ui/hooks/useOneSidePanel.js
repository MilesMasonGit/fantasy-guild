import { useLayoutEffect, useRef } from 'react';

/**
 * The hero panel and the work rules panel share one box on the notification side, so only one
 * is open at a time: whichever opened last wins, and the other closes. Closing either leaves
 * the box empty (back to the mat), never reopening the other.
 * A layout effect, so the two never paint together.
 */
export function useOneSidePanel({ heroId, closeHero, rulesHeroId, closeRules }) {
    const prev = useRef({ heroId, rulesHeroId });
    useLayoutEffect(() => {
        const before = prev.current;
        prev.current = { heroId, rulesHeroId };
        if (rulesHeroId && rulesHeroId !== before.rulesHeroId && heroId) closeHero?.();
        else if (heroId && heroId !== before.heroId && rulesHeroId) closeRules?.();
    }, [heroId, rulesHeroId, closeHero, closeRules]);
}
