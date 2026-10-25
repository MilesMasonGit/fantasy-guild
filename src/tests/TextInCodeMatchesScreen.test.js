import { describe, it, expect } from 'vitest';
import { relative } from 'node:path';
import { SRC, listFiles, readSource, setScanTimeout } from './fixtures/sourceScan.js';

/**
 * The sizes and fonts written in code are the ones that render. The global rule in
 * `tailwind.css` snaps every `text-[Npx]` from 6 to 13 px onto a Text size step, a remapped size
 * class makes any `md:text-*` beside it dead, and the player's Font Preference
 * (`body[data-font] *`, `main.css`) overrides every font class. So code says the step instead.
 */
// ⚠️ The Atlas and the notifications were on their own branches when this landed.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/, /[\\/]components[\\/]notifications[\\/]/];

const uiFiles = (dir) => listFiles(dir, { ext: /\.jsx?$/ });

setScanTimeout();

const RULES = [
    { what: 'a remapped bracketed size', re: /(?<![\w:-])text-\[(?:[6-9]|1[0-3])px\]/g },
    { what: 'a dead responsive size', re: /(?<![\w-])(?:sm|md|lg|xl):text-(?:xs|sm|base|lg|xl|2xl)\b/g },
    { what: 'a font class that never renders', re: /(?<![\w:-])font-(?:pixel|display|mono|sans|base)(?![\w-])/g },
    { what: 'an inline font family', re: /fontFamily:/g }
];

describe('text in code says what renders', () => {
    for (const { what, re } of RULES) {
        it(`no UI file writes ${what}`, () => {
            const hits = [];
            for (const path of uiFiles(`${SRC}/ui`)) {
                if (EXEMPT.some(x => x.test(path))) continue;
                for (const m of readSource(path).matchAll(re)) hits.push(`${relative(SRC, path)}: ${m[0]}`);
            }
            expect(hits).toEqual([]);
        });
    }
});
