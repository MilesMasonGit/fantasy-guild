// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { ItemTipContent } from '../ui/components/drawer/ItemTip.jsx';
import { MAP_TEXT } from '../systems/atlas/mapItems.js';

/**
 * Map items are retired, so a map item's Bank tooltip (an old save may still hold one) says only
 * what kind of item it is, never what it writes: nothing settles from it now.
 */

registerTokenTypes({
    fixture_inspect_tree: { id: 'fixture_inspect_tree', name: 'Inspect Tree', tokenType: 'resource', rarity: 'common', size: 1, uses: null },
    fixture_inspect_bush: { id: 'fixture_inspect_bush', name: 'Inspect Bush', tokenType: 'resource', rarity: 'common', size: 1, uses: null },
    fixture_inspect_camp: { id: 'fixture_inspect_camp', name: 'Inspect Camp', tokenType: 'spawner', rarity: 'common', size: 1, uses: null }
});

const tip = (item) => React.createElement(ItemTipContent, { item, count: 2 });

const FOREST = {
    id: 'fixture_inspect_map', name: 'Inspect Forest', type: 'map', sprite: 't_map_forest', stackable: true,
    cartography: {
        biome: 'forest', points: 12,
        nodes: [{ typeId: 'fixture_inspect_tree', weight: 3 }, { typeId: 'fixture_inspect_bush', weight: 1 }],
        camps: [{ typeId: 'fixture_inspect_camp', count: 1 }]
    }
};
const OVERGROWN = {
    id: 'fixture_inspect_mod', name: 'Inspect Overgrown', type: 'modifier', sprite: 't_map_flowers', stackable: true,
    cartography: { effects: [{ kind: 'density', typeId: 'fixture_inspect_tree', points: 16 }] }
};

afterEach(cleanup);

describe('the tooltip of a map item', () => {
    it('a Base Map says what kind of map it is, and nothing of what it writes', () => {
        const { container } = render(tip(FOREST));
        expect(container.querySelector('[data-map-writes]')).toBeNull();
        expect(container.textContent).not.toContain('What it writes');
        expect(container.textContent).toContain(MAP_TEXT.typeLabel.map);
    });

    it('a Modifier says what kind it is, and nothing of its effects', () => {
        const { container } = render(tip(OVERGROWN));
        expect(container.querySelector('[data-map-writes]')).toBeNull();
        expect(container.textContent).not.toContain('Inspect Tree');
        expect(container.textContent).toContain(MAP_TEXT.typeLabel.modifier);
    });
});
