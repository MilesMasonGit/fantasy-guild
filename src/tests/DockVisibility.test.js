import { describe, it, expect } from 'vitest';
import { showsBottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';

/**
 * ⭐ **The horizontal hero dock stays off the Guild Hall upgrade screen**
 * (Token Lifecycle feedback Q7, FB-47). `ReactRoot` renders the dock only when
 * this says so, keyed on `ui.fullscreen.view`.
 */
describe('Bottom hero dock visibility', () => {
    it('shows on the playmat (no fullscreen view)', () => {
        expect(showsBottomHeroDock(null)).toBe(true);
        expect(showsBottomHeroDock(undefined)).toBe(true);
    });

    it('is left out of the Guild Hall upgrade screen (FB-47)', () => {
        expect(showsBottomHeroDock('guild')).toBe(false);
    });
});
