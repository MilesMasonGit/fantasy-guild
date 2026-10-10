import { describe, it, expect } from 'vitest';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { MAP_TEXT } from '../systems/atlas/mapItems.js';

/**
 * The boot content audit reads map items: a map naming a Token that does not exist, or writing
 * nothing, is reported where the owner would fix it (the map, in the CMS's Map editor).
 */

registerTokenTypes({
    fixture_audit_tree: { id: 'fixture_audit_tree', name: 'Audit Tree', tokenType: 'resource', rarity: 'common', size: 1, uses: null },
    fixture_audit_camp: { id: 'fixture_audit_camp', name: 'Audit Camp', tokenType: 'spawner', rarity: 'common', size: 1, uses: null }
});

registerItems({
    fixture_map_good: {
        id: 'fixture_map_good', name: 'Good Map', type: 'map',
        cartography: { biome: 'forest', points: 20, nodes: [{ typeId: 'fixture_audit_tree', weight: 1 }] }
    },
    fixture_map_dangling: {
        id: 'fixture_map_dangling', name: 'Dangling Map', type: 'map',
        cartography: {
            biome: 'forest', points: 20,
            nodes: [{ typeId: 'fixture_audit_tree', weight: 1 }, { typeId: 'fixture_no_such_token', weight: 1 }]
        }
    },
    fixture_map_empty: { id: 'fixture_map_empty', name: 'Empty Map', type: 'map', cartography: { biome: 'forest', points: 0, nodes: [] } },
    fixture_mod_good: {
        id: 'fixture_mod_good', name: 'Good Modifier', type: 'modifier',
        cartography: { effects: [{ kind: 'threat', typeId: 'fixture_audit_camp', count: 1 }] }
    },
    fixture_mod_empty: { id: 'fixture_mod_empty', name: 'Empty Modifier', type: 'modifier', cartography: { effects: [] } }
});

const findings = auditContent();
const about = (id) => findings.filter(f => f.where === `Item "${id}"`).map(f => f.what);

describe('the content audit reads map items', () => {
    it('says nothing about a well-made map or modifier', () => {
        expect(about('fixture_map_good')).toEqual([]);
        expect(about('fixture_mod_good')).toEqual([]);
    });

    it('names a Token a map points at that does not exist', () => {
        const said = about('fixture_map_dangling');
        expect(said).toHaveLength(1);
        expect(said[0]).toMatch(/fixture_no_such_token/);
    });

    it('reports a map that writes nothing and a modifier that changes nothing', () => {
        expect(about('fixture_map_empty')).toEqual([MAP_TEXT.writesNoNodes]);
        expect(about('fixture_mod_empty')).toEqual([MAP_TEXT.changesNothing]);
    });

    it('no longer knows the retired Map catalogue', () => {
        expect(findings.some(f => /^Map "/.test(f.where))).toBe(false);
        expect(findings.some(f => /The Map it opens/.test(f.what))).toBe(false);
    });
});
