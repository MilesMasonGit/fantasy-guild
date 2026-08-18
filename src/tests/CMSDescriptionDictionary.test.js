import { describe, it, expect } from 'vitest';
import { composeTokenDescription } from '../../cms/src/engine/descriptionDictionary';

describe('CMS Phase 9 Description Dictionary (CMS-66, CMS-67, CMS-81, CMS-87)', () => {
  const items = {
    item_oak_wood: { id: 'item_oak_wood', name: 'Oak Wood' },
    item_charcoal: { id: 'item_charcoal', name: 'Charcoal' },
    item_copper_ore: { id: 'item_copper_ore', name: 'Copper Ore' },
    item_copper_ingot: { id: 'item_copper_ingot', name: 'Copper Ingot' },
    item_stone: { id: 'item_stone', name: 'Stone' },
    item_bones: { id: 'item_bones', name: 'Bones' },
    item_beef: { id: 'item_beef', name: 'Raw Beef' },
  };

  it('1. composes description for gathering resource token', () => {
    const token = {
      id: 'token_oakwood_grove',
      cycleTime: 12,
      outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Produces 2 Oak Wood every 12s.');
  });

  it('2. composes description for min-max range yields', () => {
    const token = {
      id: 'token_copper_seam',
      cycleTime: 15,
      outputs: [{ itemId: 'item_copper_ore', minQty: 1, maxQty: 3, chance: 100 }],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Produces 1–3 Copper Ore every 15s.');
  });

  it('3. composes description for single private recipe station', () => {
    const token = {
      id: 'token_charcoal_kiln',
      cycleTime: 20,
      inputs: [{ itemId: 'item_oak_wood', quantity: 4 }],
      outputs: [{ itemId: 'item_charcoal', quantity: 2, chance: 100 }],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Consumes 4 Oak Wood to produce 2 Charcoal (20s).');
  });

  it('4. composes description for skill-pooled station', () => {
    const token = {
      id: 'token_smelter',
      recipePool: 'smithing',
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Crafts recipes from the Smithing pool.');
  });

  it('5. composes description for modifier buff token', () => {
    const token = {
      id: 'token_foreman',
      effectBlocks: [
        {
          modifiers: [{ targetMode: 'adjacent', axis: 'speed', value: 0.20, isPercent: true }],
        },
      ],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Adjacent tokens gain +20% speed.');
  });

  it('6. composes description for trigger / converter token', () => {
    const token = {
      id: 'token_wheelbarrow',
      effectBlocks: [
        {
          trigger: { event: 'ON_CYCLE_COMPLETE', scope: 'adjacent' },
          bonusDrop: { itemId: 'item_stone', quantity: 1, chance: 10 },
        },
      ],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('When adjacent cycle complete: 10% chance +1 Stone.');
  });

  it('7. composes description for enemy combat token', () => {
    const token = {
      id: 'token_skeleton',
      tokenType: 'enemy',
      drops: [
        { itemId: 'item_bones', quantity: 1, chance: 100 },
        { itemId: 'item_beef', quantity: 1, chance: 50 },
      ],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Drops 1 Bones and 1 Raw Beef (50%) when defeated in combat.');
  });

  it('8. preserves manual override when descriptionOverride is true (CMS-67)', () => {
    const token = {
      id: 'token_oakwood_grove',
      cycleTime: 12,
      outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }],
      descriptionOverride: true,
      description: 'A sacred ancient grove whispered of in legends.',
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('A sacred ancient grove whispered of in legends.');
  });
});
