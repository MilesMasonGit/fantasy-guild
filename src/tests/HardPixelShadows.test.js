import { describe, it, expect } from 'vitest';
import { SRC, listFiles, readSource, rel, setScanTimeout } from './fixtures/sourceScan.js';

setScanTimeout();

/**
 * UI_STYLE "Hard pixel": every shadow, outline and glow the game draws is hard edged (zero blur),
 * never a soft cloud. Dev pages are left out: they are tools, not the game.
 */
const DEV = [/\/ui\/dev\//, /\/components\/dev\//, /\/TestDashboard\.jsx$/, /\/FPSCounter\.jsx$/];
const FILES = [
    ...listFiles(`${SRC}/ui`, { ext: /\.(jsx?|css)$/ }).filter(p => !DEV.some(re => re.test(p))),
    `${SRC}/tailwind.css`,
    `${SRC}/styles/main.css`,
    `${SRC}/styles/components.css`
];
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Split a shadow list on its top-level commas. */
function splitTop(list) {
    const parts = [];
    let depth = 0, from = 0;
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c === '(' || c === '{') depth++;
        else if (c === ')' || c === '}') depth--;
        else if (c === ',' && depth === 0) { parts.push(list.slice(from, i)); from = i + 1; }
    }
    parts.push(list.slice(from));
    return parts;
}
/** The blur of one shadow (`x y blur …`), when it is written as a plain number; else null. */
function blurOf(shadow) {
    const lengths = shadow
        .replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|\binset\b/gi, ' ')
        .trim().split(/\s+/)
        .filter(t => /^(-?[\d.]+(px|rem|em)?|\$\{[^}]*\}(px)?|calc\(.*\)|var\(.*\))$/.test(t));
    if (lengths.length < 3) return 0;
    const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(lengths[2]);
    return m ? Number(m[1]) : null;
}

/** Every soft effect in one file's text: [what, snippet]. */
function softIn(text) {
    const found = [];
    const body = stripComments(text);
    const shadowLists = [
        ...[...body.matchAll(/drop-shadow\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map(m => m[1]),
        ...[...body.matchAll(/(?:^|[\s"'`:])(?:[\w-]+:)*(?:drop-)?shadow-\[([^\]]+)\]/g)].map(m => m[1].replace(/_/g, ' ')),
        // In JS the value may be an expression: judge each string in it.
        ...[...body.matchAll(/[\w-]*[sS]hadow[\w-]*\s*:\s*([^;\n]+)/g)].flatMap(m =>
            /['"`]/.test(m[1]) ? [...m[1].matchAll(/(['"`])((?:(?!\1).)*)\1/g)].map(q => q[2]) : [m[1]])
    ];
    for (const list of shadowLists) {
        for (const one of splitTop(list)) {
            const blur = blurOf(one);
            if (blur) found.push(['blurred shadow', one.trim()]);
        }
    }
    for (const m of body.matchAll(/(?<![-\w])(?:[\w-]+:)*(?:drop-)?shadow-(?:2xs|xs|sm|md|lg|xl|2xl|inner|glow)\b/g)) found.push(['soft preset', m[0]]);
    for (const m of body.matchAll(/(?<![-\w])(?:backdrop-)?blur(?:-[\w[\].]+|\()/g)) found.push(['blur', m[0]]);
    return found;
}

describe('UI_STYLE "Hard pixel": no soft shadows, glows or blurs in the game', () => {
    it('reads the shadow lists it is meant to judge', () => {
        expect(softIn("className='drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]'")).toHaveLength(1);
        expect(softIn("style={{ textShadow: '0 1px 2px #000, 0 0 3px #000' }}")).toHaveLength(2);
        expect(softIn('filter: drop-shadow(0 0 2px #fde047);')).toHaveLength(1);
        expect(softIn('--shadow-glow: 0 0 25px rgba(233, 69, 96, 0.4);')).toHaveLength(1);
        expect(softIn("className='shadow-inner blur-[1px] backdrop-blur-sm'")).toHaveLength(3);
        expect(softIn("className='drop-shadow-[2px_2px_0_#000]' style={{ textShadow: '2px 2px 0 #000' }}")).toEqual([]);
        expect(softIn('box-shadow: inset 0 2px 0 #fff, 0 0 0 1px rgba(0, 0, 0, 0.35);')).toEqual([]);
        expect(softIn('filter: drop-shadow(${u}px ${u}px 0 #000);')).toEqual([]);
    });

    it('finds none in src/ui or the game\'s style sheets (dev pages aside)', () => {
        const soft = FILES.flatMap(p => softIn(readSource(p)).map(([what, s]) => `${rel(p)}: ${what} ${s}`));
        expect(soft).toEqual([]);
    });
});
