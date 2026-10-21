import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The sizes and fonts written in code are the ones that render. The global rule in
 * `tailwind.css` snaps every `text-[Npx]` from 6 to 13 px onto a Text size step, a remapped size
 * class makes any `md:text-*` beside it dead, and the player's Font Preference
 * (`body[data-font] *`, `main.css`) overrides every font class. So code says the step instead.
 */
const SRC = join(process.cwd(), 'src');
// ⚠️ The Atlas and the notifications were on their own branches when this landed.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/, /[\\/]components[\\/]notifications[\\/]/];

function uiFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return uiFiles(path);
        return /\.jsx?$/.test(path) ? [path] : [];
    });
}

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
            for (const path of uiFiles(join(SRC, 'ui'))) {
                if (EXEMPT.some(x => x.test(path))) continue;
                for (const m of readFileSync(path, 'utf8').matchAll(re)) hits.push(`${relative(SRC, path)}: ${m[0]}`);
            }
            expect(hits).toEqual([]);
        });
    }
});
