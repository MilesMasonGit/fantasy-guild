import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useBannerCardWidth } from '../../dev/cardSizeStore.js';
import { CARD_TIERS } from '../base/GICard.jsx';

/**
 * Responsive banner card sizing (task A12).
 *
 * The row anchors five full cards (Info, Hero, Active, Deck, Station) plus the
 * slim Control column. When the row can't fit them at the `md` (256) tier, the
 * whole row drops to the `sm` (128) tier so the cards stay uniform and on-screen
 * instead of overlapping. A single measurement at the container drives every row
 * (they're all the same width).
 *
 * Consumers read `useCardTier()` → `{ size, width, height }` and pass `size` +
 * `width` to GICard (or use `width`/`height` directly for non-card frames).
 */
const CONTROL_W = 40;
const CARDS_IN_ROW = 5;
const BREATHING = 130; // slack for inter-card gaps (gap-4) + row padding + outpost mat sliver

/**
 * Banner footer band height (px). A slim strip of extra space at the bottom of
 * every banner row — always present so the regular row and focus views stay the
 * same height. In focus views it also hosts the horizontal scroll bar for long
 * card lists (e.g. 40+ recipes in the Station/Recipe focus). Holds no cards.
 */
export const BANNER_FOOTER_H = 40;

/**
 * Badge-row height (px). Each card in the banner carries a horizontal row of
 * round info badges directly beneath its frame; this is the height reserved for
 * that strip (badges + the gap to the card above). Included in both the regular
 * row and focus views so their heights stay matched.
 */
export const BANNER_BADGE_ROW_H = 40;

const BannerLayoutContext = createContext({
    size: 'md',
    width: CARD_TIERS.md.w,
    height: CARD_TIERS.md.art
});

export const BannerLayoutProvider = ({ children }) => {
    const ref = useRef(null);
    const sliderWidth = useBannerCardWidth();
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(entries => {
            setContainerWidth(entries[0].contentRect.width);
        });
        ro.observe(el);
        setContainerWidth(el.getBoundingClientRect().width);
        return () => ro.disconnect();
    }, []);

    const neededMd = CONTROL_W + CARDS_IN_ROW * sliderWidth + BREATHING;
    const useMd = containerWidth === 0 || containerWidth >= neededMd;

    const layout = useMd
        ? { size: 'md', width: sliderWidth, height: CARD_TIERS.md.art }
        : { size: 'sm', width: CARD_TIERS.sm.w, height: CARD_TIERS.sm.art };

    return (
        // data-card-tier lets CSS scale text down with the tier (e.g. the
        // gi-card-title size drop in small mode — see tailwind.css).
        <div ref={ref} className="w-full" data-card-tier={layout.size}>
            <BannerLayoutContext.Provider value={layout}>
                {children}
            </BannerLayoutContext.Provider>
        </div>
    );
};

export const useCardTier = () => useContext(BannerLayoutContext);

export default BannerLayoutProvider;
