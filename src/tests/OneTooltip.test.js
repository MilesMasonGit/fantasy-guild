import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// One shared gold-edged tooltip (`base/Tooltip.jsx`: `Tooltip` and `FloatingTip`); no file
// draws its own copy of the box.
const SRC = join(process.cwd(), 'src');
// ⚠️ The Atlas was on its own branch when this landed.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/];

function jsxFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return jsxFiles(path);
        return path.endsWith('.jsx') ? [path] : [];
    });
}

describe('one tooltip', () => {
    it('only the shared Tooltip draws a pointer-through tooltip box', () => {
        const hits = [];
        for (const path of jsxFiles(join(SRC, 'ui'))) {
            if (EXEMPT.some(re => re.test(path))) continue;
            const rel = relative(SRC, path);
            if (/base[\\/]Tooltip\.jsx$/.test(rel)) continue;
            const text = readFileSync(path, 'utf8');
            if (/pointer-events-none bg-black\/90 border border-gi-gold\/40/.test(text)) hits.push(rel);
        }
        expect(hits).toEqual([]);
    });
});
