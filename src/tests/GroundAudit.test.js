import { describe, it, expect } from 'vitest';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { auditContent } from '../systems/core/ContentAudit.js';

/**
 * The boot content audit reads "Stands on" (`standsOn`): a word the game does not know, and a map
 * node whose list its map's ground can never give (the layout would leave it unplaced, and the
 * Region could never be settled).
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
    fixture_ga_forest: map('fixture_ga_forest', { biome: 'forest', nodes: nodes('fixture_ga_plain', 'fixture_ga_mine', 'fixture_ga_boat', 'fixture_ga_hut') }),
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
        expect(said[0]).toMatch(/Water, Shore, Grass, Rock or Sand/);
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

    it('names a map node its map\'s ground can never give', () => {
        const said = standsOnLines('Item "fixture_ga_forest"');
        expect(said).toHaveLength(2);
        // Rock on a forest's grass: never, beside any map.
        expect(said.find(s => /GA Mineshaft/.test(s))).toMatch(/never/);
        // Water on a map that brings none: only beside a map that does.
        expect(said.find(s => /GA Sailboat/.test(s))).toMatch(/brings no water/);
    });

    it('says nothing when the map\'s own ground or water serves the node', () => {
        expect(standsOnLines('Item "fixture_ga_coast"')).toEqual([]);
        expect(standsOnLines('Item "fixture_ga_mountain"')).toEqual([]);
        // A map that names its own terrain is read by it, not by its biome.
        expect(standsOnLines('Item "fixture_ga_quarry"')).toEqual([]);
    });

    it('a shore node on a map whose water was set to none is named', () => {
        const said = standsOnLines('Item "fixture_ga_dry_coast"');
        expect(said).toHaveLength(1);
        expect(said[0]).toMatch(/GA Dock/);
    });
});
