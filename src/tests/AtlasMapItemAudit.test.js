import { describe, it, expect } from 'vitest';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { auditContent, RETIRED_MAP_TEXT } from '../systems/core/ContentAudit.js';
import { MAP_TEXT } from '../systems/atlas/mapItems.js';

/**
 * The boot content audit and map items, now that they are retired (the world map settles places):
 * every Base Map is named for deletion, and every Token whose outputs still drop a map or a
 * modifier. A Modifier stays as a world cell's hidden extra, so a modifier naming a Token that does
 * not exist, or changing nothing, is still reported where the owner would fix it.
 */

registerTokenTypes({
    fixture_audit_tree: { id: 'fixture_audit_tree', name: 'Audit Tree', tokenType: 'resource', rarity: 'common', size: 1, uses: null },
    fixture_audit_camp: { id: 'fixture_audit_camp', name: 'Audit Camp', tokenType: 'spawner', rarity: 'common', size: 1, uses: null },
    fixture_audit_map_dropper: {
        id: 'fixture_audit_map_dropper', name: 'Map Dropper', tokenType: 'resource', rarity: 'common', size: 1, uses: null,
        config: {
            skill: 'forestry',
            outputs: [
                { itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'fixture_map_good', chance: 10, minQty: 1, maxQty: 1 },
                { itemId: 'fixture_mod_good', chance: 5, minQty: 1, maxQty: 1 },
                { itemId: 'fixture_map_good', chance: 1, minQty: 1, maxQty: 1, firstKill: true }
            ]
        }
    }
});

registerItems({
    fixture_map_good: {
        id: 'fixture_map_good', name: 'Good Map', type: 'map',
        cartography: { biome: 'forest', points: 20, nodes: [{ typeId: 'fixture_audit_tree', weight: 1 }] }
    },
    fixture_mod_good: {
        id: 'fixture_mod_good', name: 'Good Modifier', type: 'modifier',
        cartography: { effects: [{ kind: 'threat', typeId: 'fixture_audit_camp', count: 1 }] }
    },
    fixture_mod_dangling: {
        id: 'fixture_mod_dangling', name: 'Dangling Modifier', type: 'modifier',
        cartography: { effects: [{ kind: 'threat', typeId: 'fixture_no_such_token', count: 1 }] }
    },
    fixture_mod_empty: { id: 'fixture_mod_empty', name: 'Empty Modifier', type: 'modifier', cartography: { effects: [] } }
});

const findings = auditContent();
const about = (where) => findings.filter(f => f.where === where).map(f => f.what);

describe('the content audit and retired map items', () => {
    it('names every Base Map for deletion, however well made', () => {
        expect(about('Item "fixture_map_good"')).toEqual([RETIRED_MAP_TEXT.baseMap]);
    });

    it('names a Token whose outputs still drop maps or modifiers, each once', () => {
        const said = about('Token "fixture_audit_map_dropper"');
        expect(said).toEqual([RETIRED_MAP_TEXT.drops(['Good Map', 'Good Modifier'])]);
        expect(said[0]).toMatch(/never roll/);
    });

    it('still checks a modifier, a world cell\'s hidden extra: a missing Token, an effect that changes nothing', () => {
        expect(about('Item "fixture_mod_good"')).toEqual([]);
        const dangling = about('Item "fixture_mod_dangling"');
        expect(dangling).toHaveLength(1);
        expect(dangling[0]).toMatch(/fixture_no_such_token/);
        expect(about('Item "fixture_mod_empty"')).toEqual([MAP_TEXT.changesNothing]);
    });

    it('no longer knows the retired Map catalogue', () => {
        expect(findings.some(f => /^Map "/.test(f.where))).toBe(false);
        expect(findings.some(f => /The Map it opens/.test(f.what))).toBe(false);
    });
});
