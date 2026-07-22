import { describe, it, expect } from 'vitest';
import { describeActivity, PILL_TONE_CLASS } from '../ui/components/dock/dockActivity.js';
import { CARD_TIERS } from '../ui/components/base/GICard.jsx';
import {
    DOCK_TAB_H, DOCK_TAB_W, DOCK_OVERLAP, DOCK_RESERVED_H, DOCK_Z, DOCK_PINNED_Z,
    DOCK_CARD_BODY_H, DOCK_MAX_PINNED
} from '../ui/components/dock/dockConstants.js';

/**
 * Hero Dock — Phase 4.
 *
 * The activity pill is unit-tested rather than driven through the UI because
 * `areaState.status` is owned by LoopRunner and rewritten every tick, so the
 * in-combat state cannot be staged from outside the engine.
 */
describe('Hero Dock activity pill', () => {
    it('reads Reserve for an unassigned, healthy hero', () => {
        const pill = describeActivity({ wounded: false, areaId: null, areaStatus: null });
        expect(pill.label).toBe('Reserve');
        expect(pill.tone).toBe('idle');
        expect(pill.icon).toBeNull();
    });

    it('names the area a hero is deployed to', () => {
        const pill = describeActivity({
            wounded: false, areaId: 'area_whispering_woods', areaStatus: 'running'
        });
        // The real area name, not "Banner 1" — areas are named in this game.
        expect(pill.label).toBe('Whispering Woods');
        expect(pill.tone).toBe('deployed');
    });

    it('falls back to the raw id for an unknown area', () => {
        const pill = describeActivity({ wounded: false, areaId: 'area_nowhere', areaStatus: null });
        expect(pill.label).toBe('area_nowhere');
    });

    it('reads Combat while the hero’s area is fighting', () => {
        const pill = describeActivity({
            wounded: false, areaId: 'area_whispering_woods', areaStatus: 'in_combat'
        });
        expect(pill.label).toBe('Combat');
        expect(pill.icon).toBe('combat');
        expect(pill.tone).toBe('danger');
    });

    it('prefers Injured over the area, even mid-combat', () => {
        const pill = describeActivity({
            wounded: true, areaId: 'area_whispering_woods', areaStatus: 'in_combat'
        });
        expect(pill.label).toBe('Injured');
        expect(pill.icon).toBe('wound');
    });

    it('degrades to Reserve rather than throwing on missing data', () => {
        expect(describeActivity(null).label).toBe('Reserve');
    });

    it('has a tone class for every tone it can return', () => {
        const tones = [
            describeActivity({ wounded: true }),
            describeActivity({ areaId: 'area_whispering_woods' }),
            describeActivity({ areaId: null })
        ].map(p => p.tone);
        for (const tone of tones) {
            expect(PILL_TONE_CLASS[tone], `no class for tone "${tone}"`).toBeTruthy();
        }
    });
});

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
        expect(DOCK_TAB_W).toBe(CARD_TIERS.md.w);
    });

    it('limits comparison to two cards', () => {
        expect(DOCK_MAX_PINNED).toBe(2);
    });
});
