import { useEffect, useRef, useState } from 'react';

/** How long the pointer rests on a Token or hero before its name and rings come up, in ms. */
export const HOVER_REST_MS = 150;

const NONE = Object.freeze({ tokenId: null, heroId: null, tokenTurn: 0, heroTurn: 0 });

/**
 * Which Token and which hero the pointer has rested on for `HOVER_REST_MS`. The outline follows
 * the hover at once; everything else on hover waits for this, so sweeping the pointer across the
 * mat mounts nothing but outlines.
 * One timer for the whole mat, restarted whenever either hover changes. The Token half and the
 * hero half are kept apart, so the pointer moving from a Token onto its hero keeps the name.
 * ⚠️ A rest is never cleared by a render of its own: it simply stops counting once the hover it
 * was timed for has changed (each half counts its changes, its "turn"). Clearing it would cost
 * the whole mat a second commit every time the pointer left a Token, and leaving A for B and
 * coming back to A within the delay would otherwise show A's name at once.
 * @param {string|null} tokenId the hovered Token
 * @param {string|null} heroId the hovered hero
 * @returns {{tokenId: string|null, heroId: string|null}} what the pointer rests on
 */
export function useHoverRest(tokenId, heroId) {
    const turns = useRef({ tokenId: null, heroId: null, token: 0, hero: 0 });
    const [rested, setRested] = useState(NONE);
    useEffect(() => {
        const t = turns.current;
        if (t.tokenId !== tokenId) { t.tokenId = tokenId; t.token++; }
        if (t.heroId !== heroId) { t.heroId = heroId; t.hero++; }
        if (tokenId == null && heroId == null) return undefined;
        const tokenTurn = t.token;
        const heroTurn = t.hero;
        const timer = setTimeout(() => setRested(prev => (
            prev.tokenId === tokenId && prev.heroId === heroId && prev.tokenTurn === tokenTurn && prev.heroTurn === heroTurn
                ? prev
                : { tokenId, heroId, tokenTurn, heroTurn }
        )), HOVER_REST_MS);
        return () => clearTimeout(timer);
    }, [tokenId, heroId]);
    // Read in render on purpose: the turns change only in the effect that follows a hover change,
    // and in the render before it the ids already differ.
    const t = turns.current;
    const tokenRests = tokenId != null && rested.tokenId === tokenId && t.tokenId === tokenId && rested.tokenTurn === t.token;
    const heroRests = heroId != null && rested.heroId === heroId && t.heroId === heroId && rested.heroTurn === t.hero;
    return { tokenId: tokenRests ? tokenId : null, heroId: heroRests ? heroId : null };
}
