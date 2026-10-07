import { DOCK_MAX_PINNED } from '../ui/hooks/useUIModals.js';

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

describe('Hero Dock pin limit', () => {
    it('limits comparison to two cards', () => {
        expect(DOCK_MAX_PINNED).toBe(2);
    });
});
