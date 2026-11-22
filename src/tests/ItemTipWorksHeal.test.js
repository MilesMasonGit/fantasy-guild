import { describe, it, expect } from 'vitest';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';
import { getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { neededToolOf, toolMeets, toolOf } from '../config/registries/toolKinds.js';

const tool = (kind, tier, extra) => ({ id: `t_${kind}_${tier}`, equipSlot: 'hand', tool: { kind, tier }, ...extra });

describe('a tool\'s tooltip names the Tokens it works', () => {
    it('lists the same Tokens the work check lets it work', () => {
        const pick = tool('pickaxe', 1);
        const works = Object.values(getAllTokenTypes()).filter(d => { const n = neededToolOf(d); return n && toolMeets(toolOf(pick), n); });
        const line = itemTipFacts(pick).works;
        if (works.length === 0) expect(line).toBeNull();
        else {
            expect(line).toContain(works[0].name);
            if (works.length > 4) expect(line).toContain(`and ${works.length - 4} more`);
        }
    });

    it('says nothing for an item that is not a tool', () => {
        expect(itemTipFacts({ id: 'x', equipSlot: 'food' }).works).toBeNull();
    });

    it('keeps the break chance line', () => {
        expect(itemTipFacts(tool('pickaxe', 1, { breakChance: 1 })).breaks).toBe('1% chance to break each cycle');
    });
});

describe('only food heals', () => {
    it('shows Restores for food', () => {
        expect(itemTipFacts({ id: 'f', equipSlot: 'food', restoreAmount: 5 }).restores).toBe(5);
    });
    it.each(['drink', 'consumable'])('shows nothing for %s', (slot) => {
        expect(itemTipFacts({ id: 'd', equipSlot: slot, restoreAmount: 5 }).restores).toBeNull();
    });
});
