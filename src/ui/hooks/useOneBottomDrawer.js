import { useLayoutEffect, useRef } from 'react';

/**
 * The bottom of the screen holds one panel at a time over the hero bar: the Shop or a hero's
 * panel. Whichever opened last stays; the other closes.
 *
 * @param {{ shop: boolean, hero: string|null }} prev what was open before
 * @param {{ shop: boolean, hero: string|null }} next what is open now
 * @returns {'shop'|'hero'|null} the one to close
 */
export function bottomDrawerToClose(prev, next) {
    if (!next.shop || !next.hero) return null;
    if (!prev.shop) return 'hero';
    if (next.hero !== prev.hero) return 'shop';
    return null;
}

/**
 * Keeps one bottom panel open at a time (`bottomDrawerToClose`). Closed before the screen is
 * drawn, so the two are never seen together.
 * @param {{ shopOpen: boolean, heroId: string|null, closeShop: () => void, closeHero: () => void }} props
 */
export function useOneBottomDrawer({ shopOpen, heroId, closeShop, closeHero }) {
    const prevRef = useRef({ shop: shopOpen, hero: heroId });
    useLayoutEffect(() => {
        const next = { shop: shopOpen, hero: heroId };
        const close = bottomDrawerToClose(prevRef.current, next);
        prevRef.current = next;
        if (close === 'hero') closeHero();
        else if (close === 'shop') closeShop();
    }, [shopOpen, heroId, closeShop, closeHero]);
}
