import { describe, it, expect } from 'vitest';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { blockedText, joinNames, readyToSpeak, INPUTS_DELAY_MS } from '../ui/components/board/heroBubbles.js';

describe('Hero speech bubbles', () => {
    it('draw above every other mat layer', () => {
        const others = Object.entries(MAT_Z).filter(([k]) => k !== 'HERO_BUBBLE').map(([, v]) => v);
        expect(MAT_Z.HERO_BUBBLE).toBeGreaterThan(Math.max(...others));
    });

    it('join names plainly', () => {
        expect(joinNames([])).toBe('');
        expect(joinNames(['Oak Wood'])).toBe('Oak Wood');
        expect(joinNames(['A', 'B'])).toBe('A and B');
        expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
    });

    it('name the specific missing thing for each block', () => {
        expect(blockedText(ALERT.INPUTS, { token: 'Campfire', missing: { type: 'items', items: ['Oak Wood'] } }))
            .toBe('I need Oak Wood to work Campfire.');
        expect(blockedText(ALERT.NO_RECIPE, { token: 'Copper Ore Vein', missing: { type: 'tokens', items: ['Pickaxe'] } }))
            .toBe('I need a Pickaxe nearby to work Copper Ore Vein.');
        expect(blockedText(ALERT.CHARGES, { token: 'Campfire' })).toBe('Campfire has too few charges left.');
        expect(blockedText(ALERT.ACCESS, { token: 'Campfire', skill: 'Mining' })).toBe('My Mining level is too low to work Campfire.');
        expect(blockedText(ALERT.UNSKILLED, { token: 'Campfire', skill: 'Mining' })).toBe('I don’t have the Mining skill to work Campfire.');
    });

    it('say nothing for a reason they have no wording for', () => {
        expect(blockedText('something_new', { token: 'X' })).toBeNull();
    });

    it('wait before speaking only for an item shortage (SB-6)', () => {
        expect(readyToSpeak(ALERT.INPUTS, 0, INPUTS_DELAY_MS - 1)).toBe(false);
        expect(readyToSpeak(ALERT.INPUTS, 0, INPUTS_DELAY_MS)).toBe(true);
        expect(readyToSpeak(ALERT.CHARGES, 0, 0)).toBe(true);
        expect(readyToSpeak(ALERT.NO_RECIPE, 0, 0)).toBe(true);
    });
});
