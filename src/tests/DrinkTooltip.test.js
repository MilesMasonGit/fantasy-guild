import { describe, it, expect } from 'vitest';
import { getItem } from '../config/registries/itemRegistry.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';

// Drinks never heal (owner, 2026-10-24), so a drink's tooltip must not promise a restore its
// leftover `restoreAmount` no longer gives. Food still says what it restores.
describe('the item tooltip and drinks', () => {
    it('a drink shows no restore, a leftover restore amount included', () => {
        const beer = getItem('item_beer');
        expect(beer).toBeTruthy();
        expect(itemTipFacts(beer).restores).toBeNull();
        // The shipped drinks carry 0 now; a drink still holding an old amount shows none either.
        expect(itemTipFacts({ ...beer, restoreAmount: 5 }).restores).toBeNull();
    });

    it('food still shows what it restores', () => {
        const shrimp = getItem('item_shrimp');
        expect(itemTipFacts(shrimp).restores).toBe(shrimp.restoreAmount);
    });
});
