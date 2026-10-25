import { describe, it, expect } from 'vitest';
import { SRC, listFiles, readSource, rel, setScanTimeout } from './fixtures/sourceScan.js';
import './fixtures/testTokens.js';
import { buildCorpus, playerNames } from './fixtures/renderCorpus.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { toolNamer, foundationPhrase } from '../systems/effects/toolNames.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { contextSummary, foundationTierSummary } from '../ui/components/board/recipeText.js';

/**
 * ⭐ The game never says "tier" to the player: a tool or Foundation ladder is learnt from the
 * chain itself ("an Iron Pickaxe or better"). The CMS keeps its numbers, and so do the dev tools.
 *
 * ⚠️ Not covered: a Token's `description` in `data/tokens.json`, which the CMS writes on Sync to
 * Game and the Token inspection prints as is.
 */

const TIER = /\btiers?\b/i;

/** Folders whose text is for the author or the developer, not the player. */
const ALLOWED = [`${SRC}/ui/dev`];

function sourceFiles(dir) {
    return listFiles(dir, { ext: /\.(jsx?|tsx?)$/ }).filter(file => !ALLOWED.some(a => file.startsWith(a)));
}

setScanTimeout();

/**
 * The text a file can show: its string and template literals and its JSX text, with comments,
 * identifiers and regex literals left out (`tier.label` and `data-skill-tier` are code, not words).
 */
export function displayedText(code) {
    const found = [];
    let i = 0;
    let lastSignificant = '';
    const n = code.length;
    while (i < n) {
        const c = code[i];
        const next = code[i + 1];
        if (c === '/' && next === '/') { while (i < n && code[i] !== '\n') i++; continue; }
        if (c === '/' && next === '*') { const end = code.indexOf('*/', i + 2); i = end < 0 ? n : end + 2; continue; }
        if (c === '/' && (lastSignificant === '' || '(,=:[!&|?{};+-*%<>~^'.includes(lastSignificant))) {
            let j = i + 1;
            let inClass = false;
            while (j < n && code[j] !== '\n') {
                if (code[j] === '\\') { j += 2; continue; }
                if (code[j] === '[') inClass = true;
                else if (code[j] === ']') inClass = false;
                else if (code[j] === '/' && !inClass) break;
                j++;
            }
            i = j + 1;
            lastSignificant = 'r';
            continue;
        }
        if (c === '\'' || c === '"' || c === '`') {
            let j = i + 1;
            let text = '';
            while (j < n && code[j] !== c) {
                if (code[j] === '\\') { text += code[j + 1]; j += 2; continue; }
                if (c === '`' && code[j] === '$' && code[j + 1] === '{') {
                    let depth = 1;
                    j += 2;
                    while (j < n && depth) { if (code[j] === '{') depth++; else if (code[j] === '}') depth--; j++; }
                    text += ' ';
                    continue;
                }
                text += code[j];
                j++;
            }
            found.push(text);
            i = j + 1;
            lastSignificant = 's';
            continue;
        }
        if (c === '>') {
            // JSX text runs from a tag's close to the next tag or expression.
            const m = /^>([^<>{}]*)[<{]/.exec(code.slice(i, i + 400));
            if (m && /[A-Za-z]/.test(m[1])) found.push(m[1]);
        }
        if (!/\s/.test(c)) lastSignificant = c;
        i++;
    }
    return found;
}

describe('⭐ no player-facing tier labels', () => {
    it('the scanner sees strings and JSX text but not code or comments', () => {
        const sample = [
            '// a tier comment', '/* Tier block */', 'const tier = x.tier;', 'const re = /"tier"/;',
            'const a = \'Tier 2\';', 'const b = `a ${tier} tier`;', '<span data-tier={t}>Foundation tier</span>'
        ].join('\n');
        const hits = displayedText(sample).filter(t => TIER.test(t));
        expect(hits).toEqual(['Tier 2', 'a   tier', 'Foundation tier']);
    });

    it('⭐ no string or JSX text under src/ui says tier (dev tools excepted)', () => {
        const offenders = [];
        for (const file of sourceFiles(`${SRC}/ui`)) {
            for (const text of displayedText(readSource(file))) {
                if (TIER.test(text)) offenders.push(`${rel(file)}: ${text.trim()}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('⭐ every rules sentence, rendered with the game\'s tool names, is free of tier', () => {
        const offenders = buildCorpus()
            .filter(c => c.statement)
            .map(c => ({ key: c.key, text: renderStatement(c.statement, { ...(c.names || {}), tool: playerNames.tool }) }))
            .filter(({ text }) => TIER.test(text));
        expect(offenders).toEqual([]);
    });
});

describe('tool and Foundation requirements name the first rung that meets them', () => {
    const actsAs = (tag, tier) => [{ ...makeStatement(KEYWORD.ACTS_AS), payload: { tag, tier } }];
    const tokens = {
        t_rusty: { id: 't_rusty', name: 'Rusty Pickaxe', statements: actsAs('pickaxe', 1) },
        t_copper: { id: 't_copper', name: 'Copper Pickaxe', statements: actsAs('pickaxe', 1) },
        t_mythril: { id: 't_mythril', name: 'Mythril Pickaxe', statements: actsAs('pickaxe', 3) },
        t_iron: { id: 't_iron', name: 'Iron Pickaxe', statements: actsAs('pickaxe', 2) },
        t_steel: { id: 't_steel', name: 'Steel Pickaxe', statements: actsAs('pickaxe', 2), shop: { price: [{ itemId: 'x', quantity: 9 }] } },
        t_oak: { id: 't_oak', name: 'Oak Foundation', foundation: { kind: 'wood', tier: 1 } },
        t_ebony: { id: 't_ebony', name: 'Ebony Foundation', foundation: { kind: 'wood', tier: 3 } },
        t_maple: { id: 't_maple', name: 'Maple Foundation', foundation: { kind: 'wood', tier: 2 }, shop: { price: [{ itemId: 'x', quantity: 5 }] } },
        t_birch: { id: 't_birch', name: 'Birch Foundation', foundation: { kind: 'wood', tier: 2 }, shop: { price: [{ itemId: 'x', quantity: 8 }] } },
        t_marble: { id: 't_marble', name: 'Marble Foundation', foundation: { kind: 'stone', tier: 2 } }
    };
    const tool = toolNamer(tokens);

    it('the bottom rung is the bare tool; above it, the cheapest Token of the lowest rung that reaches it', () => {
        expect(tool('pickaxe', 1)).toBe('pickaxe');
        expect(tool('fishing_net')).toBe('fishing net');
        expect(tool('pickaxe', 2)).toBe('Steel Pickaxe or better');
        expect(tool('pickaxe', 3)).toBe('Mythril Pickaxe or better');
        expect(tool('pickaxe', 9)).toBe('stronger pickaxe');
    });

    it('a Foundation requirement names a Foundation of the recipe\'s own kinds', () => {
        expect(foundationPhrase(tokens, { foundationKinds: ['wood'] }, 1)).toBe(null);
        expect(foundationPhrase(tokens, { foundationKinds: ['wood'] }, 2)).toBe('a Maple Foundation or better');
        expect(foundationPhrase(tokens, { foundationKinds: ['wood'] }, 3)).toBe('an Ebony Foundation or better');
        expect(foundationPhrase(tokens, { foundationKinds: ['stone'] }, 2)).toBe('a Marble Foundation or better');
        expect(foundationPhrase(tokens, { foundationKinds: ['stone'] }, 3)).toBe('a stronger Foundation');
    });

    it('the rules sentences say it with the game\'s names and keep the numbers in the CMS', () => {
        const requires = { ...makeStatement(KEYWORD.REQUIRES), payload: { tag: 'pickaxe', minTier: 3 } };
        expect(renderStatement(requires, { tool })).toBe('Requires a nearby Mythril Pickaxe or better.');
        expect(renderStatement({ ...requires, payload: { tag: 'pickaxe', minTier: 1 } }, { tool }))
            .toBe('Requires a nearby pickaxe.');
        expect(renderStatement({ ...makeStatement(KEYWORD.ACTS_AS), payload: { tag: 'pickaxe', tier: 3 } }, { tool }))
            .toBe('Acts as a pickaxe for nearby stations.');
        expect(renderStatement({ ...makeStatement(KEYWORD.ACTS_AS), payload: { tag: 'anvil', tier: 1 } }, { tool }))
            .toBe('Acts as an anvil for nearby stations.');
        // The CMS editor passes no tool names, so the author still sees and clicks the number.
        expect(renderStatement(requires)).toBe('Requires a nearby Tier 3 pickaxe.');
    });

    it('the recipe picker names the Foundation and the tool', () => {
        registerTokenTypes(tokens);
        expect(foundationTierSummary({ foundationKinds: ['wood'], foundationMinTier: 2 }))
            .toBe('Needs a Maple Foundation or better');
        expect(foundationTierSummary({ foundationKinds: ['wood'], foundationMinTier: 1 })).toBe(null);
        expect(contextSummary({ requiresContext: [{ tag: 'pickaxe', minTier: 3 }, { tag: 'anvil', minTier: 1 }] }))
            .toBe('a Mythril Pickaxe or better, an anvil');
    });
});
