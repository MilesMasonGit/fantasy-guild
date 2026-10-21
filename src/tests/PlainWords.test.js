import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The game's screens speak plainly: no sci-fi words left over from an older theme.
const RETIRED = /protocol settings|system boot|neural|load sync|sync slot/i;

function jsxFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return jsxFiles(path);
        return path.endsWith('.jsx') ? [path] : [];
    });
}

describe('no sci-fi words on screen', () => {
    it('no UI file says Protocol Settings, SYSTEM BOOT, neural sync or Load Sync', () => {
        const hits = jsxFiles(join(process.cwd(), 'src/ui'))
            .filter(path => RETIRED.test(readFileSync(path, 'utf8')));
        expect(hits).toEqual([]);
    });
});
