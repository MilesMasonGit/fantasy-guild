import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { useBannerCardWidth } from '../../dev/cardSizeStore.js';
import { CARD_TIERS } from '../base/GICard.jsx';

/**
 * Responsive banner card sizing (task A12).
 *
 * The row anchors five full cards plus the slim Control column — Info, Hero,
 * Active, Next and Deck on an area banner; Info, Hero, Inputs, Output and
 * Station on an Outpost. When the row can't fit them at the `md` (256) tier, the
 * whole row drops to the `sm` (128) tier so the cards stay uniform and on-screen
 * instead of overlapping. A single measurement at the container drives every row
 * (they're all the same width).
 *
 * Consumers read `useCardTier()` → `{ size, width, height }` and pass `size` +
 * `width` to GICard (or use `width`/`height` directly for non-card frames).
 */
// The row is: [control bar] + 5 card slots, separated by gap-4, inside px-3
// row padding. The banner is sized to exactly this content (owner design
// 2026-07-16) rather than stretching full-width, so the width is deterministic.
//
// FIVE, not six (corrected 2026-08-02). Both banner kinds render five cards —
// an area is Info / Hero / Active / Next / Deck, an Outpost is Info / Hero /
// Inputs / Output / Station — but this still reserved the six of the older
// layout, where the area row carried its own Station before Outposts split off
// into their own banners (D-16). That left a full card slot plus its gap
// (~116px) of dead space on the right of every banner.
const CONTROL_W = 56;    // control bar (w-14) — fits 32px buttons comfortably
const CARDS_IN_ROW = 5;
const ROW_GAP = 16;      // gap-4 between the 6 row items → 5 gaps
const ROW_PAD = 24;      // px-3 on both sides

/** Banner width for a given card width: control + 5 cards + gaps + padding,
 *  plus a few px of slack for borders/rounding so nothing clips.
 *
 *  Gaps equal CARDS_IN_ROW because the row holds CARDS_IN_ROW + 1 items (the
 *  control bar included), so the count stays right if a slot is ever added. */
const bannerWidthFor = (cardW) => CONTROL_W + CARDS_IN_ROW * cardW + CARDS_IN_ROW * ROW_GAP + ROW_PAD + 8;

/**
 * Banner footer band height (px). A slim strip of extra space at the bottom of
 * every banner row — always present so the regular row and focus views stay the
 * same height. In focus views it also hosts the horizontal scroll bar for long
 * card lists (e.g. 40+ recipes in the Station/Recipe focus). Holds no cards.
 */
export const BANNER_FOOTER_H = 20;

/**
 * Badge-row height (px). Each card in the banner carries a horizontal row of
 * round info badges directly beneath its frame; this is the height reserved for
 * that strip (badges + the gap to the card above). Included in both the regular
 * row and focus views so their heights stay matched.
 */
export const BANNER_BADGE_ROW_H = 0;

/**
 * Shared spring for banner layout/shared-element motion (row↔Focus morph,
 * slot FLIP-slides) — softer than the drag ghost's pickup spring
 * (`{stiffness: 520, damping: 28, mass: 0.6}` in DndKit.jsx) since these move
 * much larger surfaces. One constant so every banner motion shares the same
 * physics "personality" instead of drifting apart per file.
 */
export const LAYOUT_SPRING = { type: 'spring', stiffness: 300, damping: 30 };

const BannerLayoutContext = createContext({
    size: 'md',
    width: CARD_TIERS.md.w,
    height: CARD_TIERS.md.art,
    bannerWidth: bannerWidthFor(CARD_TIERS.md.w)
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

    // Use the md tier only when the window can actually hold the full-size
    // banner; otherwise shrink to the sm tier so it always fits (no h-scroll).
    const neededMd = bannerWidthFor(sliderWidth);
    const useMd = containerWidth === 0 || containerWidth >= neededMd;

    const layout = useMd
        ? { size: 'md', width: sliderWidth, height: CARD_TIERS.md.art, bannerWidth: bannerWidthFor(sliderWidth) }
        : { size: 'sm', width: CARD_TIERS.sm.w, height: CARD_TIERS.sm.art, bannerWidth: bannerWidthFor(CARD_TIERS.sm.w) };

    useEffect(() => {
        EventBus.publish('ui:card_tier_changed', layout.size);
    }, [layout.size]);

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
