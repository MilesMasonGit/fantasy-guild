import { describe, it, expect } from 'vitest';
import { getItem } from '../config/registries/itemRegistry.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';

// Drinks never heal (owner, 2026-10-24), so a drink's tooltip must not promise a restore its
// leftover `restoreAmount` no longer gives. Food still says what it restores.
describe('the item tooltip and drinks', () => {
    it('a shipped drink with a restore amount shows none', () => {
        const beer = getItem('item_beer');
        expect(beer?.restoreAmount).toBeGreaterThan(0);
        expect(itemTipFacts(beer).restores).toBeNull();
    });

    it('food still shows what it restores', () => {
        const shrimp = getItem('item_shrimp');
        expect(itemTipFacts(shrimp).restores).toBe(shrimp.restoreAmount);
    });
});
