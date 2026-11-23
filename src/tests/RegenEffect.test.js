import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { starAmount, starSentence } from '../systems/progression/hallStarText.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import * as RegenSystem from '../systems/hero/RegenSystem.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import { regenPerInterval } from '../systems/hero/regen.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { healthTipView } from '../ui/components/drawer/healthTip.js';
import { toggleQaRegenStar } from '../ui/dev/qaTools.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

/**
 * Regen (T-527): out-of-fight healing, 1 HP every 10 s, raised by a percentage from the guild's
 * stars and the hero's own gear and perks, summed in one bucket. Fractions are carried per hero, so
 * +50% heals 1, 2, 1, 2... and with no Regen the ticks are exactly as before.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

let seq = 0;
const regenRule = (value) => ({
    id: `stm_regen_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type: EFFECT_TYPES.HP_REGEN, bucket: 'percentage', value },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
});

registerEffects({
    regen_quarter: { id: 'regen_quarter', name: 'Mending Charm', statements: [regenRule(0.25)] },
    regen_half: { id: 'regen_half', name: 'Quick Mend', statements: [regenRule(0.5)] },
    regen_double: { id: 'regen_double', name: 'Second Wind', statements: [regenRule(1)] }
});

registerItems({
    regen_ring: { id: 'regen_ring', name: 'Mending Ring', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'regen_quarter', scale: 1 }] },
    regen_amulet: { id: 'regen_amulet', name: 'Mending Amulet', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'regen_half', scale: 1 }] }
});

registerTokenTypes({
    regen_hut: { id: 'regen_hut', name: 'Mending Hut', sprite: 'i_pick_copper', effects: [{ effectId: 'regen_half', scale: 1 }] }
});

/** A sky of one star, Infirmary-like, whose rank 1 holds `rules`. */
function sky(rules) {
    return {
        constellations: { mend_x: { id: 'mend_x', name: 'Mending', label: { x: 0, y: -3 } } },
        stars: {
            mend_star: {
                id: 'mend_star', constellation: 'mend_x', name: 'Rest House', node: { x: 0, y: -2.6 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [{ itemId: 'item_oak_wood', quantity: 5 }], rules, lines: [] }]
            }
        }
    };
}

function holdStar(rules, rank = 1) {
    registerHallSky(sky(rules));
    GameState.state.progress.guildUpgrades = { mend_star: rank };
    HallRules.apply({ mend_star: rank });
}

/** A hurt, idle hero on the roster, wearing `equipment` (each taken from the Bank). */
function hero(name, equipment = [], skills = {}) {
    const h = generateHero({ name });
    h.id = `hero_${name}`;
    h.status = 'idle';
    for (const [id, level] of Object.entries(skills)) h.skills[id] = { ...h.skills[id], level };
    for (const itemId of equipment) InventoryManager.addItem(itemId, 1);
    h.equipment = [...equipment, ...Array(9 - equipment.length).fill(null)];
    GameState.state.heroes.push(h);
    rehydrateHero(h);
    h.hp = { current: 1, max: 100 };
    return h;
}

/** Play `seconds` of game time in one-second ticks; the hero's HP after each. */
function play(seconds, h) {
    const seen = [];
    for (let i = 0; i < seconds; i++) {
        RegenSystem.tick(1000);
        if (h) seen.push(h.hp.current);
    }
    return seen;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    RegenSystem.reset();
    registerSkillPerks({ mining: { perks: [] } });
    holdStar([], 0);
});

afterEach(() => {
    registerSkillPerks({ mining: { perks: [] } });
    holdStar([], 0);
});

describe('with no Regen, healing is exactly as before', () => {
    it('1 HP every 10 s, on the tenth second', () => {
        const h = hero('Ana');
        const seen = play(35, h);
        expect(seen[8]).toBe(1);
        expect(seen[9]).toBe(2);
        expect(seen[19]).toBe(3);
        expect(seen[29]).toBe(4);
        expect(seen[34]).toBe(4);
        expect(regenPerInterval(h)).toBe(1);
    });

    it('a long frame heals every interval it covers', () => {
        const h = hero('Ana');
        RegenSystem.tick(60_000);
        expect(h.hp.current).toBe(7);
    });
});

describe('Regen raises it', () => {
    it('a star: +50% heals 1, then 2, carrying the half', () => {
        holdStar([regenRule(0.5)]);
        const h = hero('Ana');
        const seen = play(40, h);
        expect(seen[9]).toBe(2);
        expect(seen[19]).toBe(4);
        expect(seen[39]).toBe(7);
    });

    it('gear: +25% heals 5 in four intervals', () => {
        const h = hero('Ana', ['regen_ring']);
        play(40, h);
        expect(h.hp.current).toBe(6);
    });

    it('a perk: +100% heals 2 an interval', () => {
        registerSkillPerks({ mining: { perks: [{ level: 10, effectId: 'regen_double' }] } });
        const h = hero('Ana', [], { mining: 10 });
        expect(HeroEffects.loadoutStatements(h).some(s => s.perk)).toBe(true);
        play(10, h);
        expect(h.hp.current).toBe(3);
    });

    it('a star and gear add in one bucket: +50% and +50% double it, never x2.25', () => {
        holdStar([regenRule(0.5)]);
        const h = hero('Ana', ['regen_amulet']);
        expect(regenPerInterval(h)).toBe(2);
        play(40, h);
        expect(h.hp.current).toBe(9);
    });

    it('fractions are each hero\'s own', () => {
        const a = hero('Ana', ['regen_amulet']);
        const b = hero('Bram');
        play(20, null);
        expect(a.hp.current).toBe(4);
        expect(b.hp.current).toBe(3);
    });

    it('a hero in a fight or wounded heals nothing from Regen either', () => {
        holdStar([regenRule(0.5)]);
        const h = hero('Ana');
        h.status = 'combat';
        play(30, h);
        expect(h.hp.current).toBe(1);
        h.status = 'wounded';
        play(30, h);
        expect(h.hp.current).toBe(1);
    });

    it('a building\'s Regen is not read', () => {
        const h = hero('Ana');
        expect(regenPerInterval(h)).toBe(1);
    });
});

describe('Regen as content', () => {
    it('is named Regen, a percentage', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.HP_REGEN);
        expect(entry?.label).toBe('Regen');
        expect(entry.buckets).toEqual(['percentage']);
    });

    it('is offered on an item, a perk or a library effect, never on a Token', () => {
        const types = (opts) => paletteForKeyword(KEYWORD.PROVIDES, false, opts).map(e => e.type);
        expect(types()).toContain(EFFECT_TYPES.HP_REGEN);
        expect(types({ onToken: true })).not.toContain(EFFECT_TYPES.HP_REGEN);

        const offered = (ctx) => slotsOf(regenRule(0.5), ctx).find(s => s.id === 'type').options.map(o => o.id);
        expect(offered({ carried: true })).toContain(EFFECT_TYPES.HP_REGEN);
        const onToken = slotsOf(regenRule(0.1), { onToken: true }).find(s => s.id === 'type');
        expect(onToken.options.filter(o => o.id === EFFECT_TYPES.HP_REGEN)).toHaveLength(1);
        expect(slotsOf({ ...regenRule(0.1), payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 } }, { onToken: true })
            .find(s => s.id === 'type').options.map(o => o.id)).not.toContain(EFFECT_TYPES.HP_REGEN);
    });

    it('reads as the hero\'s on gear, and every hero\'s on a star', () => {
        expect(renderStatement(regenRule(0.5), { carried: true })).toBe('Regen +50% for the hero.');
        holdStar([regenRule(0.25)]);
        const def = getUpgradeDef('mend_star');
        expect(starSentence(def)).toBe('Every hero heals faster out of a fight.');
        expect(starAmount(def, 1)).toBe('Regen +25%');
    });

    it('a star may carry it; a Token carrying it is named by the content check', () => {
        expect(hallStarFindings({ sky: sky([regenRule(0.25)]), items: { item_oak_wood: {} } })).toEqual([]);
        const findings = auditContent().filter(f => f.where === 'Token "regen_hut"');
        expect(findings.map(f => f.what).join(' ')).toMatch(/Regen/);
    });
});

describe('the health hover lists Regen and its sources', () => {
    it('with none: the base healing and Regen at 0', () => {
        const view = healthTipView(hero('Ana'));
        expect(view.title).toBe('Health');
        expect(view.lines).toEqual(['Out of a fight: heals 1 every 10 s', 'Regen +0%']);
    });

    it('a star and gear, each named with its amount', () => {
        holdStar([regenRule(0.25)]);
        const view = healthTipView(hero('Ana', ['regen_amulet']));
        expect(view.lines).toEqual([
            'Out of a fight: heals 1.75 every 10 s',
            'Regen +75%',
            'Mending Amulet: +50%',
            'Hall star Rest House I: +25%'
        ]);
    });
});

describe('the QA panel Regen star, for the eye-check', () => {
    it('switches +50% on, at half health, named on the hover; and off again', () => {
        const h = hero('Ana');
        h.hp = { current: 100, max: 100 };
        expect(toggleQaRegenStar()).toBe(true);
        expect(h.hp.current).toBe(50);
        expect(healthTipView(h).lines).toEqual(['Out of a fight: heals 1.5 every 10 s', 'Regen +50%', 'QA Regen star: +50%']);
        expect(toggleQaRegenStar()).toBe(false);
        expect(regenPerInterval(h)).toBe(1);
    });
});
