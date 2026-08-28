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

  /**
   * ⚠️ The station clause was **deleted**, not moved. A `Works as` statement
   * renders itself into the rules text, so a second hand-shaped sentence about
   * the same pool said one thing twice in two wordings.
   */
  it('4. composes description for a station, from its Works as statement', () => {
    const token = {
      id: 'token_smelter',
      statements: [{ id: 'stm_1', keyword: 'station', payload: { skill: 'smithing' } }],
    };
    const desc = composeTokenDescription(token, items);
    expect(desc).toBe('Works as a Smithing station.');
  });

  /**
   * ⚠️ **Tests 5 and 6 were rewritten, not weakened.**
   *
   * They used to pass a modifier shaped `{targetMode, axis, value, isPercent}`
   * and a block carrying `bonusDrop` — **fields that have never existed in
   * authored content**. They were green because they and the generator shared
   * the same wrong idea of the data, which is exactly why the Forge Altar
   * shipped a description saying its Work Time buff made neighbours faster when
   * the authored value made them 20% slower.
   *
   * They now pass the shape the CMS actually writes, and assert the sentence
   * the game's own renderer produces.
   */
  it('5. describes a number effect as what it does, on the axis it does it to', () => {
    const token = {
      id: 'token_foreman',
      statements: [{
        id: 'stm_1', keyword: 'provides', to: { mode: 'all' },
        payload: { type: 'WORK_TIME', bucket: 'percentage', value: 0.20 },
      }],
    };
    // Positive Work Time is MORE milliseconds per cycle — slower. The old
    // generator called this "+20% Speed".
    expect(composeTokenDescription(token, items))
      .toBe('Provides 20% more work time to every adjacent Token.');
  });

  it('6. leads a triggered rule with its trigger', () => {
    const token = {
      id: 'token_wheelbarrow',
      statements: [{
        id: 'stm_1', keyword: 'grants', to: { mode: 'all' },
        when: { event: 'CYCLE_COMPLETE', scope: 'adjacent' },
        payload: { type: 'BONUS_DROP', itemId: 'item_stone', quantity: 1, chance: 10 },
      }],
    };
    expect(composeTokenDescription(token, items))
      .toBe('When a neighbour completes a cycle, grants 1 Stone to every adjacent Token, 10% of the time.');
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

  /**
   * ⚠️ **Rewritten to assert the opposite, deliberately** (owner decision Q3).
   *
   * There is no manual override any more, and no hand-written text on a Token
   * at all. An override is precisely how a description drifts away from the
   * effect it describes, which is the problem this redesign exists to solve —
   * so text left over from before is ignored rather than preserved.
   */
  it('8. ignores hand-written text — the description IS the rules', () => {
    const token = {
      id: 'token_oakwood_grove',
      cycleTime: 12,
      outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }],
      descriptionOverride: true,
      description: 'A sacred ancient grove whispered of in legends.',
    };
    expect(composeTokenDescription(token, items)).toBe('Produces 2 Oak Wood every 12s.');
  });
});
