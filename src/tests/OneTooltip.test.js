import { describe, it, expect } from 'vitest';
import { relative } from 'node:path';
import { SRC, listFiles, readSource, setScanTimeout } from './fixtures/sourceScan.js';

// One shared gold-edged tooltip (`base/Tooltip.jsx`: `Tooltip` and `FloatingTip`); no file
// draws its own copy of the box.
// ⚠️ The Atlas was on its own branch when this landed.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/];

const jsxFiles = (dir) => listFiles(dir, { ext: /\.jsx$/ });

setScanTimeout();

describe('one tooltip', () => {
    it('only the shared Tooltip draws a pointer-through tooltip box', () => {
        const hits = [];
        for (const path of jsxFiles(`${SRC}/ui`)) {
            if (EXEMPT.some(re => re.test(path))) continue;
            const rel = relative(SRC, path);
            if (/base[\\/]Tooltip\.jsx$/.test(rel)) continue;
            const text = readSource(path);
            if (/pointer-events-none bg-black\/90 border border-gi-gold\/40/.test(text)) hits.push(rel);
        }
        expect(hits).toEqual([]);
    });
});
