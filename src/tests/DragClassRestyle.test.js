import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';

/**
 * ⭐ **Starting or ending a drag does not restyle the whole page.** The drag system stamps
 * `gi-dnd-active` on `<body>` at every pickup and drop (`DndKit.jsx`). A rule keyed on that class
 * whose own element is matched by nothing but `*` (`body.gi-dnd-active [data-item-stubs] *`) gives
 * the browser nothing to look for, so it restyles every element on the page each time the class
 * changes: ~20 ms on the 128 board in the perf build, twice a drag, the largest part of a pickup's
 * and a drop's frame. A rule that names what it styles (an attribute, a class) restyles only those.
 */

const SRC = path.resolve(__dirname, '..');
const CSS_FILES = ['tailwind.css', 'styles/main.css', 'styles/components.css'].map(f => path.join(SRC, f));

/** Every selector in the game's CSS that is keyed on the drag class, with its file. */
function dragSelectors() {
    const out = [];
    for (const file of CSS_FILES) {
        const root = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
        root.walkRules((rule) => {
            for (const sel of rule.selectors) if (sel.includes('gi-dnd-active')) out.push({ file: path.basename(file), sel });
        });
    }
    return out;
}

/** The selector's last compound: what the element it styles must itself match. */
function subjectOf(selector) {
    const parts = selector.trim().split(/\s*[\s>+~]\s*(?![^(]*\))/);
    return parts[parts.length - 1];
}

/** Whether a compound gives the browser nothing to look for: `*`, `:not(…)` and pseudo-elements only. */
const matchesAnything = (compound) => compound.replace(/^\*/, '').replace(/:not\([^)]*\)/g, '').replace(/::?[\w-]+$/, '') === '';

describe('⭐ the drag class restyles only what it names', () => {
    it('the stubs and banners still let the pointer through mid-drag (the rule is there)', () => {
        const sels = dragSelectors().map(s => s.sel);
        expect(sels.some(s => s.includes('[data-item-stubs]'))).toBe(true);
        expect(sels.some(s => s.includes('[data-banners]'))).toBe(true);
    });

    it('no rule keyed on the drag class styles an element matched by `*` alone', () => {
        const bad = dragSelectors().filter(({ sel }) => matchesAnything(subjectOf(sel)));
        expect(bad).toEqual([]);
    });

    it('the subject check catches the universal forms', () => {
        for (const sel of ['body.gi-dnd-active [data-item-stubs] *', 'body.gi-dnd-active [x] > *', 'body.gi-dnd-active *:not(input)', 'body.gi-dnd-active [x] *::before']) {
            expect({ sel, any: matchesAnything(subjectOf(sel)) }).toEqual({ sel, any: true });
        }
        for (const sel of ['body.gi-dnd-active :is([data-item-stubs], [data-banners])', 'body.gi-dnd-active :is([data-item-stubs], [data-banners]) .pointer-events-auto']) {
            expect({ sel, any: matchesAnything(subjectOf(sel)) }).toEqual({ sel, any: false });
        }
    });

    it('inside the stubs and banners, a part takes the pointer back only with the pointer-events-auto class', () => {
        // The drag rule turns exactly that class off; an inline style or another rule would escape it.
        const dir = path.join(SRC, 'ui/components/notifications');
        for (const f of fs.readdirSync(dir).filter(n => /\.jsx?$/.test(n))) {
            const text = fs.readFileSync(path.join(dir, f), 'utf8');
            expect({ f, inline: /pointerEvents\s*:/.test(text) }).toEqual({ f, inline: false });
        }
    });
});
