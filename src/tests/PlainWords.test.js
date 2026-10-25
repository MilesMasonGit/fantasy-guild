import { describe, it, expect } from 'vitest';
import { SRC, listFiles, readSource, setScanTimeout } from './fixtures/sourceScan.js';

// The game's screens speak plainly: no sci-fi words left over from an older theme.
const RETIRED = /protocol settings|system boot|neural|load sync|sync slot/i;

const jsxFiles = (dir) => listFiles(dir, { ext: /\.jsx$/ });

setScanTimeout();

describe('no sci-fi words on screen', () => {
    it('no UI file says Protocol Settings, SYSTEM BOOT, neural sync or Load Sync', () => {
        const hits = jsxFiles(`${SRC}/ui`)
            .filter(path => RETIRED.test(readSource(path)));
        expect(hits).toEqual([]);
    });
});
