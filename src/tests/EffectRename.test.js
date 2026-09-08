import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Renaming a named effect (Unified Effects).
 *
 * An entry's id is slugged from its name, so **renaming an effect changes its
 * id** — and every bearer pointing at the old id has to be repointed in the same
 * breath. Miss one and that bearer silently loses the rule: it still lists a
 * reference, the reference resolves to nothing, and the only sign is a line in
 * the boot audit.
 *
 * ⚠️ This is a regression test for a real bug. The rename walked Tokens only,
 * which was complete until P4 made items bearers too.
 */

const reset = () => useEntityStore.setState({
    items: {}, tokens: {}, maps: {}, effects: {}, recipePools: {},
    activeEntityId: null, activeEntityType: null,
});

beforeEach(reset);

describe('renaming an effect repoints every bearer', () => {
    it('repoints Tokens AND items together', () => {
        const store = useEntityStore.getState();
        const effectId = store.addEffect({ name: 'Trawler' });
        const tokenId = store.addToken({ name: 'Shrimp Bay' });
        const itemId = store.addItem({ name: 'Trawl Potion' });

        useEntityStore.getState().addEffectRef('tokens', tokenId, effectId);
        useEntityStore.getState().addEffectRef('items', itemId, effectId);

        useEntityStore.getState().updateEffect(effectId, { name: 'Deep Trawler' });

        const after = useEntityStore.getState();
        const newId = Object.keys(after.effects)[0];

        expect(newId).not.toBe(effectId);
        expect(after.effects[newId].name).toBe('Deep Trawler');
        expect(after.tokens[tokenId].effects[0].effectId).toBe(newId);
        expect(after.items[itemId].effects[0].effectId).toBe(newId);
    });

    it('keeps each bearer’s own scale through the rename', () => {
        const store = useEntityStore.getState();
        const effectId = store.addEffect({ name: 'Trawler' });
        const tokenId = store.addToken({ name: 'Shrimp Bay' });
        const itemId = store.addItem({ name: 'Trawl Potion' });

        useEntityStore.getState().addEffectRef('tokens', tokenId, effectId);
        useEntityStore.getState().addEffectRef('items', itemId, effectId);
        useEntityStore.getState().setEffectRefScale('items', itemId, effectId, 4);

        useEntityStore.getState().updateEffect(effectId, { name: 'Deep Trawler' });

        const after = useEntityStore.getState();
        expect(after.tokens[tokenId].effects[0].scale).toBe(1);
        expect(after.items[itemId].effects[0].scale).toBe(4);
    });

    it('leaves bearers that never used it alone', () => {
        const store = useEntityStore.getState();
        const effectId = store.addEffect({ name: 'Trawler' });
        const otherId = store.addEffect({ name: 'Pickaxe' });
        const itemId = store.addItem({ name: 'Plain Rock' });

        useEntityStore.getState().addEffectRef('items', itemId, otherId);
        useEntityStore.getState().updateEffect(effectId, { name: 'Deep Trawler' });

        const after = useEntityStore.getState();
        expect(after.items[itemId].effects[0].effectId).toBe(otherId);
    });
});
