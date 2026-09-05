import { describe, it, expect } from 'vitest';

import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor';

/**
 * One problem, one row.
 *
 * An item nothing produces used to raise **three** Criticals on the Economy
 * Audit tab: the simulator's `orphan-item` row, this auditor's "Unreachable
 * Item", and one "Orphaned Input" per recipe that wanted it. All three say the
 * same thing; only the simulator's carries remedies.
 *
 * ⚠️ The suppression is conditional on the simulator having actually named the
 * item, which is the part worth pinning. The two checks are not redundant in
 * general — each catches things the other misses — so neither may be deleted,
 * and neither may go quiet when the other is silent.
 *
 * Fixtures only, per the house rule.
 */

/** An item with no producer anywhere, wanted by one recipe. */
function workspace() {
    return {
        items: {
            item_ghost: { id: 'item_ghost', name: 'Ghost', type: 'material' },
            item_made: { id: 'item_made', name: 'Made', type: 'material' },
        },
        tokens: {},
        recipes: {
            recipe_thing: {
                id: 'recipe_thing', name: 'Thing', skill: 'crafting',
                inputs: [{ itemId: 'item_ghost', quantity: 1 }],
                outputs: [{ itemId: 'item_made', chance: 100, minQty: 1, maxQty: 1 }],
            },
        },
        maps: {},
        enemies: {},
    };
}

const simOrphan = (itemId) => ({
    severity: 'Critical',
    code: 'orphan-item',
    itemId,
    entityName: itemId,
    details: `[orphan-item] ${itemId} has no source at all.`,
});

/** Rows the auditor filed against one item. Matches on the id it sets. */
const rowsAbout = (issues, itemId) => issues.filter((i) => i.entityId === itemId);

describe('An unproduced item raises one Critical, not three', () => {
    it('files both of its own rows when the simulator says nothing', () => {
        const ghost = rowsAbout(auditConnectivity(workspace(), []), 'item_ghost');

        // Unreachable Item + Orphaned Input, both from this file.
        expect(ghost.filter((i) => /Unreachable Item/.test(i.details))).toHaveLength(1);
        expect(ghost.filter((i) => /Orphaned Input/.test(i.details))).toHaveLength(1);
    });

    it('drops its own two rows once the simulator has named the item', () => {
        const issues = auditConnectivity(workspace(), [simOrphan('item_ghost')]);

        expect(issues.filter((i) => /Unreachable Item/.test(i.details))).toHaveLength(0);
        expect(issues.filter((i) => /Orphaned Input/.test(i.details))).toHaveLength(0);
        // ...and the problem is still reported, once, by the row with remedies.
        const remaining = issues.filter((i) => /orphan-item/.test(i.details));
        expect(remaining).toHaveLength(1);
        expect(remaining[0].severity).toBe('Critical');
    });

    it('⚠️ suppresses only the item the simulator named', () => {
        const two = workspace();
        two.items.item_other = { id: 'item_other', name: 'Other', type: 'material' };

        const issues = auditConnectivity(two, [simOrphan('item_ghost')]);
        const unreachable = issues.filter((i) => /Unreachable Item/.test(i.details));

        expect(unreachable).toHaveLength(1);
        expect(unreachable[0].entityId).toBe('item_other');
    });

    it('ignores a plain-string refusal, which carries no code to match on', () => {
        const issues = auditConnectivity(workspace(), ['CRITICAL something happened']);
        expect(issues.filter((i) => /Unreachable Item/.test(i.details))).toHaveLength(1);
    });

    it('still reports an item the simulator missed entirely', () => {
        // The reverse overlap: a Token declaring an output it never yields is
        // invisible to this file and caught by the simulator. Neither check
        // subsumes the other, so a refusal about one item must not quiet the
        // check for every other.
        const issues = auditConnectivity(workspace(), [simOrphan('item_unrelated')]);
        expect(issues.filter((i) => /Unreachable Item/.test(i.details))).toHaveLength(1);
    });
});
