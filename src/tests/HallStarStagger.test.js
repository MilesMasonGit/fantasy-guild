import { describe, it, expect } from 'vitest';
import { staggerStars, titleClashes } from '../ui/components/board/hallStarStagger.js';
import '../config/registries/hallStarRegistry.js';
import { GUILD_UPGRADES } from '../config/guildUpgrades.js';
import { webSize, webPoint, MIN_SKY_SCALE } from '../ui/components/board/GuildHallBoard.jsx';

/**
 * The Guild Hall sky's title rule: stars whose titles would overlap are moved down for drawing, a
 * row of side-by-side stars staggered, every other one dropped; the authored places stay.
 */

const star = (id, x, y, w = 120, px = 32, h = 18) => ({ id, x, y, px, w, h });

describe('staggering star titles', () => {
    it('moves nothing when no titles touch', () => {
        const stars = [star('a', 0, 0), star('b', 300, 0), star('c', 0, 200)];
        expect(staggerStars(stars).size).toBe(0);
        expect(titleClashes(stars)).toEqual([]);
    });

    it('drops every second star of a side-by-side row, left to right, just clear of the others', () => {
        const stars = [star('d', 300, 0), star('a', 0, 0), star('c', 200, 0), star('b', 100, 0)];
        expect(titleClashes(stars).length).toBeGreaterThan(0);
        const moves = staggerStars(stars);
        expect([...moves.keys()].sort()).toEqual(['b', 'd']);
        expect(moves.get('b')).toBe(moves.get('d'));
        expect(titleClashes(stars, moves)).toEqual([]);
        // The least drop: one pixel less and a title touches again.
        const less = new Map([...moves].map(([id, d]) => [id, d - 1]));
        expect(titleClashes(stars, less).length).toBeGreaterThan(0);
    });

    it('moves a star down from under the title above it', () => {
        const stars = [star('top', 0, 0), star('under', 10, 30)];
        const moves = staggerStars(stars);
        expect([...moves.keys()]).toEqual(['under']);
        expect(titleClashes(stars, moves)).toEqual([]);
    });

    it('reads a bigger star\'s title lower, as it is drawn', () => {
        // Two stars a band apart: clear while small, touching once the upper one is drawn at 64.
        expect(staggerStars([star('a', 0, 0), star('b', 60, 70)]).size).toBe(0);
        expect(staggerStars([star('a', 0, 0, 120, 64), star('b', 60, 70)]).size).toBe(1);
    });

    it('leaves the authored sky with no clashing titles at the smallest and the natural fit', () => {
        // A title's width estimated at 11 px a letter, wider than the game's title font draws it.
        for (const scale of [MIN_SKY_SCALE, 1]) {
            const size = webSize();
            const stars = GUILD_UPGRADES.map(def => {
                const p = webPoint(def.id, size);
                return star(def.id, Math.round(p.x * scale), Math.round(p.y * scale), def.name.length * 11, 68, 20);
            });
            // Whether any clash as authored depends on the content; the staggering itself is pinned by
            // the synthetic rows above.
            const moves = staggerStars(stars);
            expect(titleClashes(stars, moves), `scale ${scale}`).toEqual([]);
        }
    });
});
