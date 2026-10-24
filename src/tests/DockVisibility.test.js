import { describe, it, expect } from 'vitest';
import { hallCameraSides } from './fixtures/hallCameraSides.js';

/**
 * ⭐ **The horizontal hero dock stays off the Guild Hall upgrade screen**
 * (Token Lifecycle feedback Q7). `ReactRoot` lays the dock on the table side of the Hall camera,
 * with the mat; the camera takes that side away while it rests on the Hall's sky
 * (`HallCamera.test.js`), and mid-glide the dock goes down with the mat.
 */
describe('Bottom hero dock visibility', () => {
    it('shows on the playmat, beside the mat on the table side of the camera', () => {
        const { code, mat } = hallCameraSides();
        expect([...code.matchAll(/<BottomHeroDock\b/g)]).toHaveLength(1);
        expect(mat).toContain('<BottomHeroDock');
        expect(mat).toContain('<Board');
    });

    it('is left out of the Guild Hall upgrade screen (FB-47)', () => {
        const { hall } = hallCameraSides();
        expect(hall).not.toContain('<BottomHeroDock');
        expect(hall).toContain('<GuildHallBoard');
    });
});
