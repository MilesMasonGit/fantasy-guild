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

describe('⭐ the Controls button lies over the hero bar\'s left end and takes none of its room', () => {
    it('the screen\'s foot gives the column\'s reach back, so the hero bar spans and centres as before; the button lies over it', () => {
        const root = read('ui/ReactRoot.jsx');
        const foot = root.slice(root.indexOf('data-screen-foot'));
        expect(foot).toMatch(/^data-screen-foot className=\{cn\('relative shrink-0', menuRight \? 'mr-3' : 'ml-3'\)\}/);
        expect(foot.indexOf('<BottomHeroDock')).toBeGreaterThan(-1);
        expect(foot.indexOf('<BottomHeroDock')).toBeLessThan(foot.indexOf('<MatControls'));
        expect(foot).toMatch(/<MatControls away=\{isGuildView \|\| isAtlasOpen\} \/>/);
        expect([...root.matchAll(/<MatControls\b/g)]).toHaveLength(1);
        // Nothing beside the hero bar in a row: it is the foot's only box in the flow.
        expect(foot.slice(0, foot.indexOf('<BottomHeroDock'))).not.toMatch(/flex-1|flex /);
    });
});
