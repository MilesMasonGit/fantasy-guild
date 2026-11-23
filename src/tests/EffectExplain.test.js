// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MODIFIER_PALETTE, getPaletteEntry, effectExplains } from '../config/registries/modifierPalette.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderSegments, renderStatement, effectTypesIn } from '../systems/effects/statementText.js';
import { EFFECT_KEY, UNIT } from '../systems/board/EffectBreakdown.js';
import { explainOf, explainLine, explainLinesOf, effectTypesOfStatements } from '../ui/components/base/effectExplain.js';
import { RuleLine } from '../ui/components/base/EffectName.jsx';
import { EffectChip } from '../ui/components/board/EffectBadges.jsx';
import { effectTagOf } from '../ui/components/board/effectBadgeText.js';
import { SupportRow, MoreBlock } from '../ui/components/board/TokenCard.jsx';
import { perkSegments } from '../ui/components/dock/heroPerks.js';
import { ItemTipContent, ItemEffectLines, itemTipFacts, itemEffects } from '../ui/components/drawer/ItemTip.jsx';

/**
 * Every effect name explains itself: one description per effect, the palette's `explains`, read by
 * the badge's hover, a building's Boosts tags, every rule line and an item's tooltip.
 */

const h = React.createElement;

registerEffects({
    ex_keen: {
        id: 'ex_keen', name: 'Keen Edge',
        statements: [{
            id: 'stm_ex_keen', keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.CRIT_CHANCE, bucket: 'flat', value: 5 },
            to: { mode: 'all', value: '' }, reach: 'nearby'
        }]
    },
    ex_quick: {
        id: 'ex_quick', name: 'Quick Hands',
        statements: [{
            id: 'stm_ex_quick', keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05, category: 'mining' },
            to: { mode: 'all', value: '' }, reach: 'nearby'
        }]
    }
});

/** A Token that buffs nearby Tokens' Speed, for the card's buff tag. */
registerTokenTypes({
    ex_buff_post: {
        id: 'ex_buff_post', name: 'Buff Post', tokenType: 'resource', rarity: 'common', uses: null, sprite: 's_nature',
        buff: { target: 'nearby', modifiers: [{ type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.25 }] }
    }
});

const speedStatement = {
    id: 'stm_ex_speed', keyword: KEYWORD.PROVIDES,
    payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.25 },
    to: { mode: 'all', value: '' }, reach: 'nearby'
};

const speedBadge = {
    key: EFFECT_KEY.SPEED, type: EFFECT_TYPES.WORK_TIME, name: 'Speed', unit: UNIT.PERCENT,
    total: 25, counted: 25, limit: null, held: false, base: 10000, resolved: 7500, final: 7500,
    sources: [{ key: 'token:t1', kind: 'building', name: 'Forge nearby', amount: 25, rules: [{ bucket: 'percentage', value: -0.25 }] }]
};

const tipText = () => [...document.querySelectorAll('[data-tooltip]')].map(n => n.textContent).join(' | ');

/** Change one effect's description for a test, as the content agent's list will, and put it back. */
function withExplains(type, text, fn) {
    const entry = getPaletteEntry(type);
    const was = entry.explains;
    entry.explains = text;
    try { fn(); } finally { entry.explains = was; }
}

afterEach(cleanup);

describe('one description per effect', () => {
    it('every palette effect has one, in plain words', () => {
        const missing = MODIFIER_PALETTE.filter(e => !(typeof e.explains === 'string' && e.explains.trim())).map(e => e.label);
        expect(missing).toEqual([]);
    });

    it('is read through the palette, with the effect\'s own name', () => {
        expect(effectExplains(EFFECT_TYPES.WORK_TIME)).toBe(getPaletteEntry(EFFECT_TYPES.WORK_TIME).explains);
        expect(explainOf(EFFECT_TYPES.WORK_TIME)).toEqual({ type: EFFECT_TYPES.WORK_TIME, name: 'Speed', text: getPaletteEntry(EFFECT_TYPES.WORK_TIME).explains });
        expect(explainLine(EFFECT_TYPES.LUCKY)).toBe(`Lucky: ${getPaletteEntry(EFFECT_TYPES.LUCKY).explains}`);
        expect(explainOf('NOT_AN_EFFECT')).toBeNull();
        expect(explainLinesOf([EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.WORK_TIME, 'NOT_AN_EFFECT'])).toHaveLength(1);
    });
});

describe('a rule line marks the effect it names', () => {
    it('its name segment carries the effect, and the sentence is unchanged', () => {
        const segments = renderSegments(speedStatement);
        expect(segments.find(s => s.effect)).toMatchObject({ text: 'Speed', effect: EFFECT_TYPES.WORK_TIME });
        expect(segments.map(s => s.text).join('')).toBe(renderStatement(speedStatement));
        expect(effectTypesIn(speedStatement)).toEqual([EFFECT_TYPES.WORK_TIME]);
    });

    it('a bonus drop marks its item as the Bonus Drop effect', () => {
        const drop = { ...speedStatement, keyword: KEYWORD.GRANTS, payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: 'item_x', value: 5, chance: 5 } };
        expect(effectTypesOfStatements([drop])).toEqual([EFFECT_TYPES.BONUS_DROP]);
    });
});

describe('each place reads the one description', () => {
    it('the badge\'s hover', () => {
        withExplains(EFFECT_TYPES.WORK_TIME, 'Test: cycles go quicker', () => {
            const { container } = render(h(EffectChip, { badge: speedBadge }));
            fireEvent.pointerEnter(container.querySelector('[data-effect-badge]'), { clientX: 5, clientY: 5 });
            expect(document.querySelector('[data-badge-tip-explains]').textContent).toBe('Test: cycles go quicker');
        });
    });

    it('a building\'s Boosts tag carries its effect for the hover', () => {
        const tag = effectTagOf({ type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.25 });
        expect(tag).toMatchObject({ text: 'Speed +25%', type: EFFECT_TYPES.WORK_TIME });
        withExplains(EFFECT_TYPES.WORK_TIME, 'Test: cycles go quicker', () => {
            expect(explainLinesOf([tag.type])).toEqual(['Speed: Test: cycles go quicker']);
        });
    });

    it('the Token card: a Boosts row\'s tooltip lists it, and a buff tag explains itself on hover', () => {
        withExplains(EFFECT_TYPES.WORK_TIME, 'Test: cycles go quicker', () => {
            const tag = effectTagOf({ type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.25 });
            const row = render(h(SupportRow, { row: { id: 'r1', typeId: 'token_cooking_pot', name: 'Kitchen', tags: [tag] } }));
            fireEvent.pointerEnter(row.container.querySelector('[data-card-support]'), { clientX: 5, clientY: 5 });
            expect(tipText()).toContain('Speed: Test: cycles go quicker');
            row.unmount();

            const more = render(h(MoreBlock, { typeId: 'ex_buff_post' }));
            const name = more.container.querySelector(`[data-card-buff-tag] [data-effect-name="${EFFECT_TYPES.WORK_TIME}"]`);
            expect(name.textContent).toBe('Speed +25%');
            fireEvent.pointerEnter(name, { clientX: 5, clientY: 5 });
            expect(tipText()).toContain('Test: cycles go quicker');
        });
    });

    it('a rule line\'s name (a perk\'s), on hover', () => {
        withExplains(EFFECT_TYPES.WORK_TIME, 'Test: cycles go quicker', () => {
            const [segments] = perkSegments({ effectId: 'ex_quick', scale: 1 });
            const { container } = render(h(RuleLine, { segments }));
            expect(container.textContent).toBe('Speed +5% on Mining Tokens.');
            const name = container.querySelector(`[data-effect-name="${EFFECT_TYPES.WORK_TIME}"]`);
            expect(name.textContent).toBe('Speed');
            fireEvent.pointerEnter(name, { clientX: 5, clientY: 5 });
            expect(tipText()).toContain('Test: cycles go quicker');
        });
    });

    it('an item\'s tooltip and drawer', () => {
        withExplains(EFFECT_TYPES.CRIT_CHANCE, 'Test: hits land double more often', () => {
            const dagger = { id: 'ex_dagger', name: 'Test Dagger', equipSlot: 'hand', styles: ['melee'], effects: [{ effectId: 'ex_keen', scale: 1 }] };
            const tip = render(h(ItemTipContent, { item: dagger, details: false }));
            expect(tip.container.querySelector('[data-item-tip-explains]').textContent).toBe('Crit Chance: Test: hits land double more often');
            tip.unmount();
            const drawer = render(h(ItemEffectLines, { facts: itemTipFacts(dagger) }));
            expect(drawer.container.querySelector('[data-item-tip-explains]')).toBeNull();
            fireEvent.pointerEnter(drawer.container.querySelector('[data-effect-name]'), { clientX: 5, clientY: 5 });
            expect(tipText()).toContain('Test: hits land double more often');
        });
    });
});

describe('an item\'s tooltip lists its effects', () => {
    it('each effect by its title, its rules as their badges word them, before anyone wears it', () => {
        const ring = { id: 'ex_ring', name: 'Test Ring', equipSlot: 'trinket', effects: [{ effectId: 'ex_quick', scale: 2 }] };
        const { container } = render(h(ItemTipContent, { item: ring, details: false }));
        const effect = container.querySelector('[data-item-tip-effect="ex_quick"]');
        expect(effect.textContent).toBe('Quick Hands IISpeed +10% on Mining Tokens.');
        expect(container.querySelector('[data-item-tip-explains]').textContent).toBe(explainLine(EFFECT_TYPES.WORK_TIME));
        // In a tooltip nothing can be hovered: no name is drawn as hoverable there.
        expect(container.querySelector('[data-effect-name]')).toBeNull();
    });

    it('lists nothing for an item with no effects', () => {
        const { container } = render(h(ItemTipContent, { item: { id: 'ex_stone', name: 'Stone' } }));
        expect(container.querySelector('[data-item-tip-effects]')).toBeNull();
        expect(itemEffects({ id: 'ex_stone' })).toEqual({ rows: [], explains: [] });
    });

    it('an effect a rule applies follows it with its own rules', () => {
        registerEffects({
            ex_merry: { id: 'ex_merry', name: 'Merry', statements: [{
                id: 'stm_ex_merry', keyword: KEYWORD.PROVIDES,
                payload: { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 1 },
                to: { mode: 'all', value: '' }, reach: 'nearby'
            }] },
            ex_beer: { id: 'ex_beer', name: 'Beer', statements: [{
                id: 'stm_ex_beer', keyword: KEYWORD.APPLIES,
                when: { event: 'onCycle' },
                payload: { effectId: 'ex_merry', scale: 1 },
                target: { role: 'actor' }
            }] }
        });
        const { rows, explains } = itemEffects({ id: 'ex_beer_item', equipSlot: 'drink', effects: [{ effectId: 'ex_beer', scale: 1 }] });
        expect(rows.map(r => [r.id, !!r.applied])).toEqual([['ex_beer', false], ['ex_merry', true]]);
        // The rule names the applied effect by its name, never its id.
        expect(rows[0].lines[0].map(s => s.text).join('')).toContain('Merry');
        expect(rows[0].lines[0].map(s => s.text).join('')).not.toContain('ex_merry');
        expect(explains).toEqual([explainLine(EFFECT_TYPES.XP_BONUS)]);
    });
});
