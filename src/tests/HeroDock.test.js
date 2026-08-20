import { describe, it, expect } from 'vitest';
import { BANNER_WIDTH_DEFAULT } from '../ui/dev/cardSizeStore.js';
import {
    DOCK_TAB_H, DOCK_TAB_W, DOCK_OVERLAP, DOCK_RESERVED_H, DOCK_Z, DOCK_PINNED_Z,
    DOCK_CARD_BODY_H, DOCK_MAX_PINNED, DOCK_TAB_W_SMALL, DOCK_OVERLAP_SMALL, DOCK_SFX,
    dockStripWidth, dockNeedsSmallMode
} from '../ui/components/dock/dockConstants.js';

/**
 * Hero Dock status pip.
 *
 * Unit-tested rather than driven through the UI because tile status is owned by
 * the board runner and rewritten every tick, so the in-combat state cannot be
 * staged from outside the engine.
 *
 * Four colours, no words (owner design 2026-08-02): red injured, yellow
 * placed-but-stopped, green working, blue available. The yellow one is D-172's
 * idle-hero mark — the counterpart to the red "staffed but stuck" mark that
 * lives on the Token.
 *
 * Re-pointed from areas to tiles by the playmat rework (Phase 1). The rules are
 * unchanged; only what they name has moved.
 */
/**
 * The pin reducer, mirroring useUIModals' `dock.togglePin`. Extracted here so
 * the eviction rule is pinned down by tests without mounting React.
 */
const togglePin = (prev, heroId) => (
    prev.includes(heroId)
        ? prev.filter(id => id !== heroId)
        : [...prev, heroId].slice(-DOCK_MAX_PINNED)
);

describe('Hero Dock pinning rules', () => {
    it('pins a card on click', () => {
        expect(togglePin([], 'a')).toEqual(['a']);
    });

    it('unpins a card that is already open', () => {
        expect(togglePin(['a'], 'a')).toEqual([]);
    });

    it('allows exactly two open at once', () => {
        const two = togglePin(togglePin([], 'a'), 'b');
        expect(two).toEqual(['a', 'b']);
        expect(two.length).toBe(DOCK_MAX_PINNED);
    });

    it('evicts the OLDEST when a third is pinned', () => {
        let pins = ['a', 'b'];
        pins = togglePin(pins, 'c');
        expect(pins).toEqual(['b', 'c']);
        expect(pins).not.toContain('a');
    });

    it('keeps evicting oldest-first across many pins', () => {
        let pins = [];
        for (const id of ['a', 'b', 'c', 'd']) pins = togglePin(pins, id);
        expect(pins).toEqual(['c', 'd']);
    });

    it('closing one of two leaves the other open', () => {
        const pins = togglePin(['a', 'b'], 'a');
        expect(pins).toEqual(['b']);
    });

    it('re-pinning a closed card puts it back at the newest position', () => {
        let pins = ['a', 'b'];
        pins = togglePin(pins, 'a');   // close a  -> ['b']
        pins = togglePin(pins, 'a');   // reopen a -> ['b','a']
        expect(pins).toEqual(['b', 'a']);
        // 'a' is now the NEWEST, so the next pin must evict 'b'.
        expect(togglePin(pins, 'c')).toEqual(['a', 'c']);
    });
});

describe('Hero Dock layout constants', () => {
    it('keeps the tab within the concept’s 70-80px header band', () => {
        expect(DOCK_TAB_H).toBeGreaterThanOrEqual(70);
        expect(DOCK_TAB_H).toBeLessThanOrEqual(80);
    });

    it('overlaps tabs without swallowing them', () => {
        expect(DOCK_OVERLAP).toBeGreaterThan(0);
        expect(DOCK_OVERLAP).toBeLessThan(DOCK_TAB_W / 2);
    });

    it('reserves at least the tab height for the scroll inset', () => {
        // The banner list and Bank drawer pad by this; too small and the last
        // row hides behind the dock.
        expect(DOCK_RESERVED_H).toBeGreaterThanOrEqual(DOCK_TAB_H);
    });

    it('stacks pinned cards above the dock, and the dock above the drawers', () => {
        expect(DOCK_PINNED_Z).toBeGreaterThan(DOCK_Z);
        expect(DOCK_Z).toBeGreaterThan(110); // above the side drawer and bubble column
    });

    it('keeps the expanded card inside the concept’s 260-300px band', () => {
        const expanded = DOCK_TAB_H + DOCK_CARD_BODY_H;
        expect(expanded).toBeGreaterThanOrEqual(260);
        expect(expanded).toBeLessThanOrEqual(300);
    });

    it('matches the md playmat card width, so a dock card reads as a hero card', () => {
        // Was `CARD_TIERS.md.w` on the deleted `GICard`, a table nothing but
        // this test read. `BANNER_WIDTH_DEFAULT` is the same 200px and is what
        // the drag ghost actually sizes a banner card to, so the comparison is
        // now against something live rather than against a dead constant.
        expect(DOCK_TAB_W).toBe(BANNER_WIDTH_DEFAULT);
    });

    it('limits comparison to two cards', () => {
        expect(DOCK_MAX_PINNED).toBe(2);
    });
});

describe('Hero Dock Small Mode', () => {
    it('collapses to a square chip', () => {
        // Square-ish: the chip is the tab height, face only.
        expect(DOCK_TAB_W_SMALL).toBeLessThan(DOCK_TAB_W / 3);
        expect(Math.abs(DOCK_TAB_W_SMALL - DOCK_TAB_H)).toBeLessThanOrEqual(30);
    });

    it('overlaps chips proportionally tighter than full tabs', () => {
        expect(DOCK_OVERLAP_SMALL).toBeGreaterThan(0);
        expect(DOCK_OVERLAP_SMALL).toBeLessThan(DOCK_OVERLAP);
        // A chip must still show most of itself once overlapped.
        expect(DOCK_TAB_W_SMALL - DOCK_OVERLAP_SMALL).toBeGreaterThan(DOCK_TAB_W_SMALL / 2);
    });

    it('fits a large roster on a narrow screen once collapsed', () => {
        // 12 heroes — the concept's upper bound — inside 1024px.
        expect(dockStripWidth(12, true)).toBeLessThan(1024);
    });

    it('stays full-size when the roster genuinely fits', () => {
        // The bug this replaced: the dock followed the banner card tier, which
        // is already 'sm' at 1280x800, so a 4-hero dock collapsed with ~490px
        // of headroom. Small Mode now measures the dock's own need.
        expect(dockStripWidth(4)).toBe(716);
        expect(dockNeedsSmallMode(1203, 4)).toBe(false);
    });

    it('collapses only when the roster actually overflows', () => {
        // In 1203px the boundary sits between 6 (1060px) and 7 (1232px).
        expect(dockNeedsSmallMode(1203, 6)).toBe(false);
        expect(dockNeedsSmallMode(1203, 7)).toBe(true);
    });

    it('scales its decision with roster size, not just window width', () => {
        const narrow = 600;
        expect(dockNeedsSmallMode(narrow, 2)).toBe(false); // two still fit
        expect(dockNeedsSmallMode(narrow, 5)).toBe(true);  // five do not
    });

    it('does not collapse before it has measured anything', () => {
        expect(dockNeedsSmallMode(0, 5)).toBe(false);
        expect(dockNeedsSmallMode(1203, 0)).toBe(false);
    });

    it('names both dock SFX clips', () => {
        expect(DOCK_SFX.pin).toBeTruthy();
        expect(DOCK_SFX.unpin).toBeTruthy();
        expect(DOCK_SFX.pin).not.toBe(DOCK_SFX.unpin);
    });
});
