import { describe, it, expect } from 'vitest';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { bubblesFor } from '../ui/components/board/heroBubbles.js';

describe('Hero speech bubbles (SB-A)', () => {
    it('draws above every other mat layer', () => {
        const others = Object.entries(MAT_Z).filter(([k]) => k !== 'HERO_BUBBLE').map(([, v]) => v);
        expect(MAT_Z.HERO_BUBBLE).toBeGreaterThan(Math.max(...others));
    });

    it('stub: exactly one hero speaks, and it is the same one however the list is ordered', () => {
        const a = [{ heroId: 'b' }, { heroId: 'a' }];
        const b = [{ heroId: 'a' }, { heroId: 'b' }];
        expect(bubblesFor('a', a)).toHaveLength(1);
        expect(bubblesFor('b', a)).toHaveLength(0);
        expect(bubblesFor('a', b)).toEqual(bubblesFor('a', a));
    });
});
