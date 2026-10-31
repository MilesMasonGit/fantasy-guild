import { describe, it, expect } from 'vitest';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { auditContent, RETIRED_MAP_TEXT } from '../systems/core/ContentAudit.js';

/**
 * The boot content audit reads "Stands on" (`standsOn`): a word the game does not know. A Base Map
 * is retired, so its nodes' ground is no longer read: the map is named for deletion instead.
 */

const token = (id, name, extra = {}) => ({ id, name, tokenType: 'resource', rarity: 'common', size: 1, uses: null, ...extra });

registerTokenTypes({
    fixture_ga_plain: token('fixture_ga_plain', 'GA Tree'),
    fixture_ga_typo: token('fixture_ga_typo', 'GA Typo', { standsOn: ['lava', 'water'] }),
    fixture_ga_word: token('fixture_ga_word', 'GA Word', { standsOn: 'water' }),
    fixture_ga_mine: token('fixture_ga_mine', 'GA Mineshaft', { standsOn: ['rock'] }),
    fixture_ga_boat: token('fixture_ga_boat', 'GA Sailboat', { standsOn: ['water'] }),
    fixture_ga_dock: token('fixture_ga_dock', 'GA Dock', { standsOn: ['shore'] }),
    fixture_ga_hut: token('fixture_ga_hut', 'GA Hut', { standsOn: ['sand', 'grass'] })
});

const map = (id, cartography) => ({ id, name: id, type: 'map', cartography: { points: 20, ...cartography } });
const nodes = (...typeIds) => typeIds.map(typeId => ({ typeId, weight: 1 }));

registerItems({
    fixture_ga_plains: map('fixture_ga_plains', { biome: 'plains', nodes: nodes('fixture_ga_plain', 'fixture_ga_mine', 'fixture_ga_boat', 'fixture_ga_hut') }),
    fixture_ga_forest: map('fixture_ga_forest', { biome: 'forest', nodes: nodes('fixture_ga_plain', 'fixture_ga_boat', 'fixture_ga_dock') }),
    fixture_ga_coast: map('fixture_ga_coast', { biome: 'coast', nodes: nodes('fixture_ga_plain', 'fixture_ga_boat', 'fixture_ga_dock', 'fixture_ga_hut') }),
    fixture_ga_mountain: map('fixture_ga_mountain', { biome: 'mountain', nodes: nodes('fixture_ga_mine') }),
    fixture_ga_quarry: map('fixture_ga_quarry', { biome: 'quarry', terrain: 'rock', water: 0, nodes: nodes('fixture_ga_mine') }),
    fixture_ga_dry_coast: map('fixture_ga_dry_coast', { biome: 'coast', water: 0, nodes: nodes('fixture_ga_dock') })
});

const findings = auditContent();
const about = (where) => findings.filter(f => f.where === where).map(f => f.what);
const standsOnLines = (where) => about(where).filter(what => /Stands on/.test(what));

describe('the audit reads "Stands on"', () => {
    it('names a word the game does not know, and says it is ignored', () => {
        const said = standsOnLines('Token "fixture_ga_typo"');
        expect(said).toHaveLength(1);
        expect(said[0]).toMatch(/"lava"/);
        expect(said[0]).toMatch(/Water, Shore, Grass, Rock, Sand or Stone/);
    });

    it('names a list that is not a list', () => {
        const said = standsOnLines('Token "fixture_ga_word"');
        expect(said).toHaveLength(1);
        expect(said[0]).toMatch(/anywhere dry/);
    });

    it('says nothing about a Token with no list or a list of known words', () => {
        for (const id of ['fixture_ga_plain', 'fixture_ga_mine', 'fixture_ga_boat', 'fixture_ga_dock', 'fixture_ga_hut']) {
            expect(standsOnLines(`Token "${id}"`), id).toEqual([]);
        }
    });

    it('reads no Base Map nodes against its ground any more: each map is named as retired, once', () => {
        for (const id of ['fixture_ga_plains', 'fixture_ga_forest', 'fixture_ga_coast', 'fixture_ga_mountain', 'fixture_ga_quarry', 'fixture_ga_dry_coast']) {
            expect(standsOnLines(`Item "${id}"`), id).toEqual([]);
            expect(about(`Item "${id}"`), id).toEqual([RETIRED_MAP_TEXT.baseMap]);
        }
    });
});
