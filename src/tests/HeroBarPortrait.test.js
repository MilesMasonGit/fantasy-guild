import { describe, it, expect, afterEach } from 'vitest';
import {
    portraitCrop, heroPortraitUrl, cachedHeroPortrait, setPortraitCutter, PORTRAIT_ART_PX
} from '../ui/components/dock/heroPortrait.js';

/** A 64 x 64 frame from rows of '#' (drawn) and '.' (clear), padded with clear pixels. */
function frame(rows, at = { x: 0, y: 0 }) {
    return (x, y) => {
        const row = rows[y - at.y];
        if (!row) return 0;
        return row[x - at.x] === '#' ? 255 : 0;
    };
}

afterEach(() => setPortraitCutter(null));

/**
 * The hero bar's portrait is cut from the idle frame: a 32 px square just above the head's top,
 * centred on the head, inside the frame.
 */
describe('the portrait crop', () => {
    it('starts two pixels above the topmost drawn pixel and centres on the head', () => {
        // A head 6 wide at x 30..35 from y 3; a sword out to the left lower down.
        const rows = [];
        for (let y = 0; y < 64; y++) rows.push('.'.repeat(64));
        const draw = (x0, x1, y) => { rows[y] = rows[y].slice(0, x0) + '#'.repeat(x1 - x0 + 1) + rows[y].slice(x1 + 1); };
        for (let y = 3; y < 11; y++) draw(30, 35, y);
        for (let y = 11; y < 40; y++) draw(4, 50, y);
        const crop = portraitCrop(frame(rows), 64, 64);
        expect(crop).toEqual({ x: 17, y: 1, size: PORTRAIT_ART_PX });
    });

    it('never leaves the frame', () => {
        const rows = ['#'.repeat(4)];
        expect(portraitCrop(frame(rows), 64, 64)).toEqual({ x: 0, y: 0, size: 32 });
        expect(portraitCrop(frame(rows, { x: 60, y: 50 }), 64, 64)).toEqual({ x: 32, y: 32, size: 32 });
    });

    it('takes the middle of an empty frame', () => {
        expect(portraitCrop(() => 0, 64, 64)).toEqual({ x: 16, y: 0, size: 32 });
    });
});

describe('the portrait cache', () => {
    it('cuts each sheet once, however many ask', async () => {
        const asked = [];
        setPortraitCutter((src) => { asked.push(src); return Promise.resolve(`cut:${src}`); });
        expect(cachedHeroPortrait('assets/heroes/a.png')).toBeUndefined();
        const [a, b, c] = await Promise.all([
            heroPortraitUrl('assets/heroes/a.png'),
            heroPortraitUrl('assets/heroes/a.png'),
            heroPortraitUrl('assets/heroes/b.png')
        ]);
        expect(a).toBe('cut:/assets/heroes/a.png');
        expect(b).toBe(a);
        expect(c).toBe('cut:/assets/heroes/b.png');
        expect(asked).toEqual(['/assets/heroes/a.png', '/assets/heroes/b.png']);
        expect(cachedHeroPortrait('assets/heroes/a.png')).toBe(a);
    });

    it('remembers a sheet that cannot be cut as no portrait', async () => {
        setPortraitCutter(() => Promise.reject(new Error('no canvas')));
        expect(await heroPortraitUrl('assets/heroes/x.png')).toBeNull();
        expect(cachedHeroPortrait('assets/heroes/x.png')).toBeNull();
        expect(await heroPortraitUrl(null)).toBeNull();
    });
});
