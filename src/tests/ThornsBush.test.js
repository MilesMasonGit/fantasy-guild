import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, makeStatement, firingChanceOf } from '../systems/effects/statements.js';
import * as EndRoll from '../systems/board/endRoll.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { slotsOf, costSlots } from '../../cms/src/engine/ledger/statementSlots.js';
import { checkTargets } from '../../cms/schemaCheck.js';
import { composeTokenDescription } from '../../cms/src/engine/descriptionDictionary.js';

/**
 * The Redberry Bush's Thorns as the owner ruled it (2026-11-15): Redberries every cycle, and on a
 * separate 10 % of cycles a prick of 1 damage to the hero, costing no charge. So a bush of 25
 * charges gives 25 harvests a refill, as the Blackberry Bush beside it does, where Thorns' own
 * charge made it 13. Authored here the way the content pack writes it: the library rule's chance
 * and its "charges spent" of 0.
 *
 * The bush comes back, so it runs out by chance: each charge spent is a roll at one in 25. Here the
 * roll is stood in by its count (`endsAtCount`: the 25th charge spent ends it, as one in 25 does on
 * average), so what Thorns spends is counted exactly; the roll itself is `ChanceEnd.test.js`'s.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/board/endRoll.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, endsNow: vi.fn(real.endsNow) };
});

/** The end roll stood in by a count: the `n`th charge spent ends it, and the count starts again. */
function endsAtCount(n) {
    let spent = 0;
    EndRoll.endsNow.mockImplementation((chance, times = 1) => {
        spent += times;
        if (spent < n) return false;
        spent = 0;
        return true;
    });
}

/** On Cycle: deals 1 damage to the hero, `chance` of the time, spending `charge`. */
const thorns = (id, { chance, charge }) => ({
    id, name: 'Thorns',
    statements: [{
        ...makeStatement(KEYWORD.DEALS),
        id: `stm_${id}`,
        target: { role: ROLE.ACTOR },
        payload: chance == null ? { amount: 1 } : { amount: 1, chance },
        chargeDelta: charge === 0 ? 0 : -charge
    }]
});

registerEffects({
    tb_nettle_charm: {
        id: 'tb_nettle_charm', name: 'Nettle',
        statements: [{
            ...makeStatement(KEYWORD.DEALS), id: 'stm_tb_nettle', target: { role: ROLE.ACTOR },
            when: { event: 'WORK_START', scope: 'self' }, payload: { amount: 1, chance: 10 }, chargeDelta: 0
        }]
    },
    tb_thorns_ruled: thorns('tb_thorns_ruled', { chance: 10, charge: 0 }),
    tb_thorns_today: thorns('tb_thorns_today', { charge: 1 }),
    tb_thorns_always_free: thorns('tb_thorns_always_free', { charge: 0 })
});

registerItems({
    tb_nettle: { id: 'tb_nettle', name: 'Nettle Charm', equipSlot: 'trinket', stackable: true, effects: [{ effectId: 'tb_nettle_charm', scale: 1 }] }
});

/** The shipped Redberry Bush (25 charges, refills after a rest), carrying one Thorns or another. */
function bushWith(id, effectId) {
    const shipped = getTokenType('token_redberry_bush');
    registerTokenTypes({ [id]: { ...shipped, id, statements: [], effects: [{ effectId, scale: 1 }] } });
    return id;
}

const AT = { x: 400, y: 300 };

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 1000, max: 1000 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

/** Work the bush until it rests (its charges spent), counting harvests and pricks. */
function harvestUntilResting(typeId) {
    const bush = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(bush, AT);
    TileModifiers.rebuildAround([bush]);
    Orders.orderAt('tb_hero', AT);
    const seen = { harvests: 0, pricks: 0, rested: 0, depleted: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === bush.id && !p.failed) seen.harvests += 1; }),
        EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => { if (p.title === 'Thorns') seen.pricks += 1; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, () => { seen.rested += 1; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, () => { seen.depleted += 1; })
    ];
    const start = HeroManager.getHero('tb_hero').hp.current;
    for (let t = 0; t < 400000 && !seen.rested; t += 100) BoardRunner.tick(100);
    offs.forEach(off => off());
    seen.hpLost = start - HeroManager.getHero('tb_hero').hp.current;
    return seen;
}

beforeEach(() => {
    endsAtCount(25);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    Flags.init();
    GameState.state.heroes = [makeHero('tb_hero')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('⭐ the Redberry Bush, as ruled', () => {
    it('gives 25 harvests a refill and pricks on some of them, one damage each', () => {
        const seen = harvestUntilResting(bushWith('tb_bush_ruled', 'tb_thorns_ruled'));
        expect(seen.harvests).toBe(25);
        expect(seen.rested).toBe(1);
        expect(seen.depleted).toBe(0);
        // Which cycles prick is the draw's (pinned both ways below); about one in ten do.
        expect(seen.pricks).toBeLessThan(25 / 2);
        expect(seen.hpLost).toBe(seen.pricks);
    });

    it('before the ruling, Thorns\' own charge made it 13 (the last harvest without a thorn)', () => {
        const seen = harvestUntilResting(bushWith('tb_bush_today', 'tb_thorns_today'));
        expect(seen.harvests).toBe(13);
        expect(seen.pricks).toBe(12);
    });

    it('the chance is honoured both ways, and a missed roll says nothing', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.05);
        const always = harvestUntilResting(bushWith('tb_bush_low_rolls', 'tb_thorns_ruled'));
        vi.restoreAllMocks();
        GameState.initNew();
        GameState.state.heroes = [makeHero('tb_hero')];
        GameState.state.inventory.maxSlots = 50;
        vi.spyOn(Math, 'random').mockReturnValue(0.95);
        const never = harvestUntilResting(bushWith('tb_bush_high_rolls', 'tb_thorns_ruled'));
        expect(always.harvests).toBe(25);
        expect(always.pricks).toBe(25);
        expect(never.harvests).toBe(25);
        expect(never.pricks).toBe(0);
        expect(never.hpLost).toBe(0);
    });

    it('free and always: every harvest pricks, 25 a refill', () => {
        const seen = harvestUntilResting(bushWith('tb_bush_always', 'tb_thorns_always_free'));
        expect(seen.harvests).toBe(25);
        expect(seen.pricks).toBe(25);
    });
});

describe('the rule\'s words and its CMS fields', () => {
    it('reads "On Cycle: deals 1 damage to the hero, 10% of the time."', () => {
        const statement = thorns('x', { chance: 10, charge: 0 }).statements[0];
        expect(renderStatement(statement)).toBe('On Cycle: deals 1 damage to the hero, 10% of the time.');
        expect(firingChanceOf(statement)).toBe(10);
    });

    it('is written in the CMS by the chance slot and "charges spent" 0, and passes the schema', () => {
        let statement = { ...makeStatement(KEYWORD.DEALS), id: 'stm_tb_cms' };
        statement = { ...statement, ...slotsOf(statement).find(s => s.id === 'chance').patch(10) };
        const charge = costSlots(statement).find(s => s.id === 'charge');
        expect(charge.value).toBe(1);
        expect(charge.hint).toMatch(/A missed roll is not a firing: it spends nothing/);
        statement = { ...statement, ...charge.patch(0) };
        expect(statement).toMatchObject({ payload: { amount: 1, chance: 10 }, chargeDelta: 0, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self' } });
        expect(renderStatement(statement)).toBe('On Cycle: deals 1 damage to the hero, 10% of the time.');

        const effects = { effect_tb_cms: { id: 'effect_tb_cms', name: 'Thorns', statements: [statement] } };
        expect(checkTargets([{ where: 'effects.json', schema: 'effects', value: effects }]).errors).toEqual([]);

        registerEffects(effects);
        const bush = bushWith('tb_bush_cms', 'effect_tb_cms');
        // The description the Sync writes from the rules says so.
        expect(composeTokenDescription(getTokenType(bush))).toContain('On Cycle: deals 1 damage to the hero, 10% of the time.');
        const seen = harvestUntilResting(bush);
        expect(seen.harvests).toBe(25);
        expect(seen.hpLost).toBe(seen.pricks);
    });
});

describe('a Deals chance is honoured wherever the rule runs', () => {
    it("on a carried item's moment: a missed roll pricks nobody", () => {
        const hero = generateHero({ name: 'Nell' });
        hero.id = 'tb_carrier';
        hero.status = 'idle';
        hero.hp = { current: 100, max: 100 };
        GameState.state.heroes = [hero];
        InventoryManager.addItem('tb_nettle', 1);
        expect(EquipmentManager.equipItem(hero.id, 'tb_nettle').success).toBe(true);
        const bush = BoardState.createTokenInstance('token_redberry_bush', 25);
        Placement.placeTokenAt(bush, AT);

        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        expect(LoadoutMoments.fire(bush.id, hero.id, 'CYCLE_START')).toBe(0);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(100);
        vi.restoreAllMocks();
        vi.spyOn(Math, 'random').mockReturnValue(0.05);
        expect(LoadoutMoments.fire(bush.id, hero.id, 'CYCLE_START')).toBe(1);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(99);
    });

    it("on a lingering effect's tick", () => {
        const tick = {
            ...makeStatement(KEYWORD.DEALS), id: 'stm_tb_tick', target: { role: ROLE.SELF },
            when: { event: 'EFFECT_TICK', scope: 'self' }, payload: { amount: 1, chance: 10 }, chargeDelta: 0
        };
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        TriggerSystem.fireLiveStatement(tick, { self: null, selfHeroId: 'tb_hero', actor: null, source: null });
        expect(HeroManager.getHero('tb_hero').hp.current).toBe(1000);
        vi.restoreAllMocks();
        vi.spyOn(Math, 'random').mockReturnValue(0.05);
        TriggerSystem.fireLiveStatement(tick, { self: null, selfHeroId: 'tb_hero', actor: null, source: null });
        expect(HeroManager.getHero('tb_hero').hp.current).toBe(999);
    });

    it('⚠️ a rule with no chance draws nothing, as before chances existed', () => {
        const always = { ...makeStatement(KEYWORD.DEALS), id: 'stm_tb_always', target: { role: ROLE.SELF }, payload: { amount: 1 } };
        const draws = vi.spyOn(Math, 'random');
        TriggerSystem.fireLiveStatement(always, { self: null, selfHeroId: 'tb_hero', actor: null, source: null });
        expect(draws).not.toHaveBeenCalled();
        expect(HeroManager.getHero('tb_hero').hp.current).toBe(999);
    });
});
