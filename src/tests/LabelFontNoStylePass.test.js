// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { labelFontPx, fightReach } from '../ui/components/board/healthBar.js';

/**
 * The fight number's text size is read without making the browser bring every pending style up to
 * date (T-200): `getComputedStyle` on the root did that inside the hero speech layer's render and
 * its twice-a-second poll, and on a mat of walking enemies every step leaves dozens of styles
 * pending. The player's Text size lives on the root's own style (`SettingsManager.applyFontSizes`).
 */

afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--font-size-xxs');
});

describe('the fight number\'s text size', () => {
    it('reads the Text size from the root\'s own style, with no computed-style pass', () => {
        document.documentElement.style.setProperty('--font-size-xxs', '17px');
        const computed = vi.spyOn(window, 'getComputedStyle');
        expect(labelFontPx()).toBe(17);
        expect(fightReach(1)).toBe(fightReach(1, 17));
        expect(computed).not.toHaveBeenCalled();
    });

    it('with nothing on the root, still asks the style sheets, as before', () => {
        const computed = vi.spyOn(window, 'getComputedStyle');
        const px = labelFontPx();
        expect(computed).toHaveBeenCalled();
        expect(px).toBeGreaterThan(0);
    });

    it('a Text size that is not a size falls back to 14', () => {
        document.documentElement.style.setProperty('--font-size-xxs', 'none');
        expect(labelFontPx()).toBe(14);
    });
});
