// a world in words: the QA panel's dump of a generated world (pure)

import { STRICT_RINGS } from '../../config/worldTablesShape.js';

/**
 * A generated world as plain text, for the QA panel and the tests: a hex picture of the wedges,
 * then every cell ring by ring with its origins, kit, specialty, requirements and hidden extras,
 * then what the generation could not meet and what the checks found.
 *
 * Names come from the lookups handed in (the game passes its registries), so this file stays pure.
 */

/** Words, kept together for translation. */
export const WORLD_TEXT = Object.freeze({
    headline: (seed, cells, rings) => `World ${seed} · ${cells} cells · rings 0–${rings} (strict 1–${Math.min(rings, STRICT_RINGS)}${rings > STRICT_RINGS ? `, wild ${STRICT_RINGS + 1}–${rings}` : ''})`,
    placeholder: 'Generated from the placeholder tables (no data/world.json yet)',
    wedges: 'Wedges by side',
    hallRing: 'Ring 0 · the Hall\'s cell (the Starter Camp)',
    strictRing: (ring) => `Ring ${ring} · tier ${ring}`,
    wildRing: (ring, tier) => `Ring ${ring} · wild (content of tier ${tier})`,
    origins: 'origins',
    requires: 'requires',
    gatheredAt: 'gathered at',
    hidden: 'hidden',
    nothing: 'nothing',
    specialty: 'specialty',
    extreme: 'extreme',
    composition: (name) => `${name} almost everywhere`,
    layout: (id) => `odd layout: ${id}`,
    problems: 'What the generation could not meet',
    findings: 'What the checks found',
    none: 'none',
    legend: '@@ the Hall · two letters per line, small letters for the wild rings'
});

const same = (id) => id;

/** The hex picture: each cell's line as two letters at its place, the Hall as `@@`. */
export function hexPicture(world, { lineName = same } = {}) {
    const R = world.rings;
    const rows = [];
    for (let r = -R; r <= R; r++) {
        const chars = new Array((4 * R + 1) * 2 + 2).fill(' ');
        for (const cell of world.cells.filter(c => c.r === r)) {
            const x = (2 * cell.q + cell.r + 2 * R) * 2;
            const name = String(cell.wedge ? lineName(cell.wedge) : '@@');
            let label = cell.ring === 0 ? '@@' : (name.slice(0, 2) + '  ').slice(0, 2);
            label = cell.wild ? label.toLowerCase() : label.charAt(0).toUpperCase() + label.charAt(1).toLowerCase();
            chars[x] = label[0];
            chars[x + 1] = label[1];
        }
        rows.push(chars.join('').replace(/\s+$/, ''));
    }
    return rows.join('\n');
}

/**
 * The whole world in words.
 *
 * @param {object} world a `generateWorld` result
 * @param {object} [options]
 * @param {(id: string) => string} [options.tokenName] an origin's (or a treasure's) name
 * @param {(id: string) => string} [options.itemName] an item's (or a modifier's) name
 * @param {(id: string) => string} [options.lineName] a line's name
 * @param {(id: string) => string} [options.kitName] a kit's name
 * @param {(id: string) => string} [options.skillName] a skill's name
 * @param {boolean} [options.placeholder] say the placeholder tables made it
 * @param {object[]} [options.findings] the checks' findings, listed at the end
 */
export function worldText(world, {
    tokenName = same, itemName = same, lineName = same, kitName = same, skillName = same,
    placeholder = false, findings = null
} = {}) {
    const lines = [WORLD_TEXT.headline(world.seed, world.cells.length, world.rings)];
    if (placeholder) lines.push(WORLD_TEXT.placeholder);
    lines.push(`${WORLD_TEXT.wedges}: ${world.wedges.map((id, side) => `${side} ${lineName(id)}`).join(' · ')}`);
    lines.push('', hexPicture(world, { lineName }), WORLD_TEXT.legend);

    const originWords = (cell) => {
        const parts = cell.origins.map(o => {
            const tag = o.role === 'main' || o.role === 'hall' ? '' : ` (${o.role}${o.line && o.line !== cell.wedge ? `, ${lineName(o.line)}` : ''})`;
            return `${tokenName(o.id)}${tag}`;
        });
        return parts.length ? parts.join(', ') : WORLD_TEXT.nothing;
    };
    const extraName = (e) => (e.kind === 'treasure' ? tokenName(e.id) : itemName(e.id));

    for (let n = 0; n <= world.rings; n++) {
        const ring = world.cells.filter(c => c.ring === n);
        const heading = n === 0 ? WORLD_TEXT.hallRing : n <= STRICT_RINGS ? WORLD_TEXT.strictRing(n) : WORLD_TEXT.wildRing(n, STRICT_RINGS);
        lines.push('', heading);
        for (const cell of ring) {
            const id = cell.id.padEnd(7);
            if (n === 0) {
                lines.push(`  ${id}${WORLD_TEXT.origins}: ${originWords(cell)}`);
                continue;
            }
            lines.push(`  ${id}${lineName(cell.wedge)} · ${cell.kit ? kitName(cell.kit) : '—'} · ${WORLD_TEXT.specialty} ${cell.specialty ? skillName(cell.specialty) : '—'}`);
            lines.push(`         ${WORLD_TEXT.origins}: ${originWords(cell)}`);
            const req = cell.requires || { items: [], skills: [] };
            const asks = [
                ...req.items.map(i => `${i.qty} ${itemName(i.itemId)}`),
                ...req.skills.map(s => `${skillName(s.skill)} ${s.level}`)
            ];
            lines.push(`         ${WORLD_TEXT.requires}: ${asks.length ? asks.join(', ') : WORLD_TEXT.nothing}${cell.payFrom.length ? ` · ${WORLD_TEXT.gatheredAt} ${cell.payFrom.join(' + ')}` : ''}`);
            const hidden = cell.extras.map(e => `${extraName(e)} (${e.kind} ${e.value})`);
            lines.push(`         ${WORLD_TEXT.hidden}: ${hidden.length ? `${hidden.join(', ')} = ${cell.value}` : WORLD_TEXT.nothing}`);
            if (cell.extreme) {
                const what = cell.extreme.kind === 'composition' ? WORLD_TEXT.composition(tokenName(cell.extreme.focus)) : WORLD_TEXT.layout(cell.extreme.layout);
                lines.push(`         ${WORLD_TEXT.extreme}: ${what}`);
            }
        }
    }

    lines.push('', `${WORLD_TEXT.problems}:`);
    if (world.problems.length) for (const p of world.problems) lines.push(`  - ${p.message}`);
    else lines.push(`  ${WORLD_TEXT.none}`);
    if (findings) {
        lines.push('', `${WORLD_TEXT.findings}:`);
        if (findings.length) for (const f of findings) lines.push(`  - ${f.message}`);
        else lines.push(`  ${WORLD_TEXT.none}`);
    }
    return lines.join('\n');
}
