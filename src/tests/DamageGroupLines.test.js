import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { gearDefenceFindings } from '../systems/core/gearDefenceRule.js';
import { gearResistancesOf } from '../config/registries/gearDefence.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { enemyMovesOf } from '../config/registries/enemyMoves.js';
import { enemyFightNumbers } from '../systems/effects/enemyKindEffects.js';
import { DAMAGE_GROUPS, isDamageGroupId } from '../config/registries/damageTypes.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * Only the nine damage types carry numbers. A line the shipped content still writes on a group
 * (Physical, Elemental, Special) does nothing in the game, and both audits name each one, so the
 * change pack splitting them can be checked against the list.
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const list = (c) => (Array.isArray(c) ? c : Object.values(c || {}));
const content = { items: read('items.json'), tokens: read('tokens.json'), effects: read('effects.json') };

// What the shipped content still writes on a group; nothing once the change pack splitting them is Synced.
const groupLinesLeft = ({ items, tokens, effects }) => [
    ...list(items).flatMap((i) => Object.keys(i?.resistances || {}).filter(isDamageGroupId).map(() => [i.id, 'resistances'])),
    ...list(tokens).flatMap((t) => Object.keys(t?.enemy?.resistances || {}).filter(isDamageGroupId).map(() => [t.id, 'enemy.resistances'])),
    ...list(tokens).flatMap((t) => (Array.isArray(t?.enemy?.moves) ? t.enemy.moves : [])
        .filter((m) => isDamageGroupId(m?.damageType)).map(() => [t.id, 'enemy.moves'])),
    ...list(effects).flatMap((e) => (Array.isArray(e?.statements) ? e.statements : [])
        .filter((s) => [EFFECT_TYPES.TYPE_DAMAGE, EFFECT_TYPES.TYPE_RESIST].includes(s?.payload?.type) && isDamageGroupId(s.payload.category))
        .map(() => [e.id, 'statements']))
].map(([id, field]) => `${id}|${field}`).sort();

const GROUP_WORDS = DAMAGE_GROUPS.map((g) => `the ${g.label} group`);
const namesAGroup = (f) => GROUP_WORDS.some((w) => f.message.includes(w));

describe('a line on a damage group in the shipped content', () => {
    it('is named by the audits, each once, and nothing else is', () => {
        const named = [
            ...findUnknownRefs({ ...content, recipes: [] }),
            ...gearDefenceFindings({ items: content.items, effects: content.effects })
        ].filter(namesAGroup).map((f) => `${f.entityId}|${f.field}`).sort();
        expect(named).toEqual(groupLinesLeft(content));
    });

    it('lends nothing: a piece of gear or an enemy reads only its type lines', () => {
        for (const item of list(content.items)) {
            expect(Object.keys(gearResistancesOf(item)).filter(isDamageGroupId), item.id).toEqual([]);
        }
        for (const token of list(content.tokens).filter((t) => t?.enemy)) {
            const profile = enemyProfileOf(token);
            expect(Object.keys(profile.resistances).filter(isDamageGroupId), token.id).toEqual([]);
            expect(enemyMovesOf(token.enemy).filter((m) => isDamageGroupId(m.type)), token.id).toEqual([]);
        }
    });

    it('the Crab keeps its Crush weakness through Armoured\'s Slash, Crush and Stab', () => {
        // Its own Crush −100 and Armoured's 50 add up in a fight.
        const crab = list(content.tokens).find((t) => t.id === 'token_crab');
        expect(crab.enemy).toMatchObject({ kinds: ['effect_armoured'], resistances: { crush: -100 } });
        expect(enemyFightNumbers(crab).resistances).toMatchObject({ slash: 50, crush: -50, stab: 50 });
    });
});
