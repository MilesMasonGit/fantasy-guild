import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { SRC, codeOf } from './fixtures/sourceScan.js';

/**
 * ⭐ **The playmat reaches left** (playmat declutter §13) and the Controls strip sits under it.
 * Layout only, so read from the source; the gaps themselves were measured in the running game
 * (1500 x 1000: 8 px each side; 1920 x 1080: 26 px each side).
 */

const read = (path) => codeOf(fs.readFileSync(`${SRC}/${path}`, 'utf8'));

describe('⭐ the mat column reaches under the bubbles\' inner padding', () => {
    it('the column takes back the bubbles\' 12 px padding on their side, so the mat centres between the bubbles and the far edge', () => {
        const root = read('ui/ReactRoot.jsx');
        expect(root).toMatch(/'flex-1 min-w-0 relative flex flex-col overflow-y-clip', menuRight \? '-mr-3' : '-ml-3'/);
        // The padding it takes back is the bubbles' column's own.
        const menu = read('ui/components/nav/BubbleMenu.jsx');
        expect(menu).toMatch(/'pointer-events-auto relative shrink-0 flex flex-col items-center gap-4 py-6 px-3 /);
    });

    it('⭐ the world camera\'s box may shrink below the mat: the mat no longer props it open past the screen\'s edge', () => {
        const camera = read('ui/components/atlas/WorldCamera.jsx');
        expect(camera).toMatch(/data-world-camera=\{phase\}\s*className="flex-1 flex min-w-0 min-h-0 relative"/);
    });
});

describe('⭐ the Controls strip is under the mat, left of the hero bar', () => {
    it('the screen\'s foot holds the strip, then the hero bar; the strip is away over the Hall and the World Map', () => {
        const root = read('ui/ReactRoot.jsx');
        const foot = root.slice(root.indexOf('data-screen-foot'));
        expect(foot.indexOf('<MatControls')).toBeGreaterThan(-1);
        expect(foot.indexOf('<MatControls')).toBeLessThan(foot.indexOf('<BottomHeroDock'));
        expect(foot).toMatch(/<MatControls away=\{isGuildView \|\| isAtlasOpen\} \/>/);
        expect([...root.matchAll(/<MatControls\b/g)]).toHaveLength(1);
    });
});
