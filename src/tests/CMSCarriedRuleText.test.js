// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import EffectEditor from '../../cms/src/components/editors/EffectEditor.jsx';
import SkillPerksPage from '../../cms/src/components/perks/SkillPerksPage.jsx';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';

/**
 * The CMS says who carries a rule: an item's and a perk's read as the hero's; an effect a Token uses
 * keeps the Token's words wherever it is shown, because editing it reaches that Token too. No real
 * workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;

const LOOT = {
    ...makeStatement(KEYWORD.PROVIDES), id: 'stm_cc_loot',
    payload: { type: 'LOOT_MULT', bucket: 'flat', value: 5, category: 'forestry' }, to: { mode: 'all', value: '' }, reach: 'nearby'
};
const FIGHT_START = {
    ...makeStatement(KEYWORD.APPLIES), id: 'stm_cc_valor',
    when: { event: 'COMBAT_ENGAGED', scope: 'nearby' },
    payload: { effectId: 'effect_cc_valor', forFight: true, chance: 100 }
};
const workspace = () => ({
    tokens: {
        token_cc_grove: { id: 'token_cc_grove', name: 'Grove', tokenType: 'resource', effects: [{ effectId: 'effect_cc_shared', scale: 1 }] }
    },
    items: {
        item_cc_charm: { id: 'item_cc_charm', name: 'Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'effect_cc_charm', scale: 1 }] },
        item_cc_elixir: { id: 'item_cc_elixir', name: 'Elixir', type: 'potion', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'effect_cc_elixir', scale: 1 }] },
        item_cc_both: { id: 'item_cc_both', name: 'Both', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'effect_cc_shared', scale: 1 }] }
    },
    effects: {
        effect_cc_charm: { id: 'effect_cc_charm', name: 'Charm Luck', statements: [LOOT] },
        effect_cc_elixir: { id: 'effect_cc_elixir', name: 'Elixir Rule', statements: [FIGHT_START] },
        effect_cc_valor: { id: 'effect_cc_valor', name: 'Valor', statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_cc_dmg', payload: { type: 'DAMAGE', bucket: 'flat', value: 1 } }] },
        effect_cc_shared: { id: 'effect_cc_shared', name: 'Shared Luck', statements: [{ ...LOOT, id: 'stm_cc_shared' }] },
        effect_cc_felling: { id: 'effect_cc_felling', name: 'Felling', statements: [{ ...LOOT, id: 'stm_cc_felling' }] }
    },
    recipePools: {},
    starterCamp: null,
    skillPerks: { forestry: { id: 'forestry', perks: [{ level: 10, effectId: 'effect_cc_felling', scale: 1 }] } }
});

const store = () => useEntityStore.getState();
const open = (id, kind, Editor) => {
    store().setActiveEntity(id, kind);
    return render(React.createElement(Editor)).container.textContent;
};

beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem(WORKSPACE_KEY) ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => store().hydrate(workspace()));
afterEach(cleanup);
afterAll(() => {
    expect(globalThis.localStorage?.getItem(WORKSPACE_KEY) ?? null).toBe(storedBefore);
});

describe('the item editor', () => {
    it('reads an item\'s standing rule as the hero\'s, naming its skill', () => {
        const text = open('item_cc_charm', 'item', ItemEditor);
        expect(text).toContain('Gives the hero a 5% chance of double loot at Forestry.');
        expect(text).not.toContain('every nearby Token have');
    });

    it('reads a fight-start rule as the hero\'s fight', () => {
        const text = open('item_cc_elixir', 'item', ItemEditor);
        expect(text).toContain("When this hero's fight starts: applies Valor to the hero for the fight.");
        expect(text).not.toContain("On Neighbour's Fight");
    });

    it('reads an effect shared with a Token as the hero\'s, on the item', () => {
        expect(open('item_cc_both', 'item', ItemEditor)).toContain('Gives the hero a 5% chance of double loot at Forestry.');
    });
});

describe('the effect editor', () => {
    it('reads an effect only items carry as the hero\'s', () => {
        expect(open('effect_cc_charm', 'effect', EffectEditor)).toContain('Gives the hero a 5% chance of double loot at Forestry.');
    });

    it('reads an effect only a perk uses as the hero\'s', () => {
        expect(open('effect_cc_felling', 'effect', EffectEditor)).toContain('Gives the hero a 5% chance of double loot at Forestry.');
    });

    it('⚠️ keeps the Token\'s words on an effect a Token uses too', () => {
        const text = open('effect_cc_shared', 'effect', EffectEditor);
        expect(text).toContain('Makes every nearby Token have a 5% chance of double loot.');
        expect(text).not.toContain('Gives the hero');
    });
});

describe('the Skill Perks page', () => {
    it('reads a perk\'s rule as the hero\'s', () => {
        store().focusPerks('forestry');
        const text = render(React.createElement(SkillPerksPage)).container.textContent;
        expect(text).toContain('Gives the hero a 5% chance of double loot at Forestry.');
    });
});
