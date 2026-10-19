import { describe, it, expect } from 'vitest';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { ALERT } from '../systems/board/boardEvents.js';
import * as heroBubbles from '../ui/components/board/heroBubbles.js';
import { blockedText, joinNames } from '../ui/components/board/heroBubbles.js';
import { stackOf } from '../ui/components/board/heroSpeech.js';

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

    it('drop the skill from the sentence when the Token names none (FB-54)', () => {
        // `pinRefusedLineFor` passes `skill: undefined` for such a Token.
        expect(blockedText(ALERT.ACCESS, { token: 'Campfire', skill: undefined })).toBe('My level is too low to work Campfire.');
        expect(blockedText(ALERT.UNSKILLED, { token: 'Campfire', skill: undefined })).toBe('I don’t have the skill to work Campfire.');
        expect(blockedText(ALERT.ACCESS, { token: 'Campfire' })).not.toMatch(/the right/);
    });

    it('say nothing for a reason they have no wording for', () => {
        expect(blockedText('something_new', { token: 'X' })).toBeNull();
    });

    it('⭐ heroes no longer speak about a Token’s problems (brief 120): nothing left to speak them', () => {
        // The problem mark and its hover say what is wrong instead (problemMark.js).
        for (const gone of ['blockedLineFor', 'speaksBlock', 'SILENT_BLOCKS', 'readyToSpeak', 'INPUTS_DELAY_MS']) {
            expect(heroBubbles[gone], gone).toBeUndefined();
        }
        // A hero's stack holds moments only.
        const moments = [{ key: 'idle', text: 'No work in range.', until: 10 }];
        expect(stackOf(moments, 0)).toEqual([{ id: 'idle', text: 'No work in range.', kind: 'moment' }]);
    });

    it('the retired lines keep their wording as the record (and 7 and 8 serve the pin-refused moment)', () => {
        expect(blockedText(ALERT.CHOOSE_RECIPE, { token: 'Workbench' })).toBe('Choose a recipe for Workbench.');
        expect(blockedText(ALERT.NO_ROOM, { token: 'Workbench' })).toBe('There is no room for what Workbench makes.');
    });
});
