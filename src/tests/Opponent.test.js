import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { deal } from '../systems/board/DealDamage.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { MODIFIER_PALETTE } from '../config/registries/modifierPalette.js';
import { momentSupplies } from '../config/registries/triggerRegistry.js';
import { ROLE, ROLES, getRole } from '../config/registries/roleRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, makeStatement, rolesForKeyword } from '../systems/effects/statements.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { auditContent } from '../systems/core/ContentAudit.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these are named spots on a 160 u lattice.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/** Put a Token on spot `i`, and plant a hero's flag there. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));
const plant = (heroId, i) => Placement.plantFlagAt(heroId, C(i));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **`the enemy`** — Effects Grammar v2, V10a (G-40…G-43).
 *
 * A rule on an item could not name the creature its hero is fighting; only
 * `Applies` could, through a one-off flag. V10a adds the role, lets Deals /
 * Heals / Removes / Applies aim at it, and finds the creature **by hero, never
 * by tile** — so Free Playmat flags (FP-67), which separate where a hero is
 * recorded from where they fight, cannot quietly redirect a blow.
 */

const MONSTER = 16, BUSH = 15, OTHER_MONSTER = 22;

function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.aggregator = new ModifierAggregator(id);
    hero.statuses = [];
    hero.effects = [];
    hero.equipment = Array(9).fill(null);
    return hero;
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    put(tile, instance);
    TileModifiers.rebuildAround([tokenAt(tile)]);
    if (heroId) plant(heroId, tile);
    return tokenAt(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const hero1 = () => HeroManager.getHero('hero_1');

/** Start a real fight on `MONSTER` and hand back its fight card. */
function engage() {
    place(MONSTER, 'fixture_enemy', 'hero_1');
    run(600);
    const fight = BoardCombat.getFight(idAt(MONSTER));
    expect(fight, 'no fight started - the hero cannot fight').toBeTruthy();
    return fight;
}

let itemSeq = 0;
/** Put one rule on an item, the way the CMS would, and equip it on hero_1. */
function carry(statement, stock = 5) {
    itemSeq += 1;
    const effectId = `fixture_effect_v10a_${itemSeq}`;
    const itemId = `fixture_item_v10a_${itemSeq}`;
    registerEffects({ [effectId]: { id: effectId, name: effectId, statements: [{ id: `stm_${effectId}`, ...statement }] } });
    registerItems({ [itemId]: { id: itemId, name: itemId, effects: [{ effectId, scale: 1 }] } });
    InventoryManager.addItem(itemId, stock);
    hero1().equipment[0] = itemId;
    return itemId;
}

const onEngaged = { event: 'COMBAT_ENGAGED', scope: 'self' };
const toEnemy = { role: ROLE.OPPONENT };

const dealsToEnemy = (amount, extra = {}) => ({
    ...makeStatement(KEYWORD.DEALS), when: onEngaged, target: toEnemy,
    payload: { amount, ignoresArmor: true }, chargeDelta: -1, ...extra
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    BoardCombat.clearAll();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    // CR3-157: BoardCombat used to call LoadoutMoments.fire directly right
    // after publishing COMBAT_ENGAGED; it now only subscribes to that event
    // (LoadoutMoments.init, called after TriggerSystem.init as the game
    // does), so a real engagement through BoardRunner.tick needs this started.
    LoadoutMoments.init();
    LiveEffects.resetClock();
    GameState.state.heroes = [fighter('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    LoadoutMoments.teardown();
    TileModifiers.teardown();
    BoardCombat.clearAll();
});

describe('1. an item says "deals N damage to the enemy", and a real fight feels it', () => {
    it('lowers the monster’s HP by exactly N at the moment of engagement, and spends the item', () => {
        const item = carry(dealsToEnemy(7));
        place(MONSTER, 'fixture_enemy', 'hero_1');

        // Every engagement starts at full HP (BOARD_EVENTS.COMBAT_ENGAGED's own
        // doc: "the enemy returns to full HP for the next fight"), so `.max` is
        // the HP the item's blow lands on — read here rather than `.current`.
        //
        // CR3-157: `.current` would no longer work for this. LoadoutMoments now
        // fires AS a COMBAT_ENGAGED subscriber (registered after TriggerSystem,
        // same final order the old direct call ran in), so it runs INSIDE
        // EventBus.publish's own subscriber loop rather than strictly after it
        // returns. Since LoadoutMoments is registered before this test's own
        // subscriber, `.current` would already reflect the item's damage by the
        // time this callback runs. `.max` sidesteps that entirely.
        let before = null, after = null;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, () => {
            if (before == null) before = BoardCombat.getFight(idAt(MONSTER)).combat.enemyHp.max;
        });
        try {
            for (let t = 0; t < 1000 && after == null; t += 100) {
                BoardRunner.tick(100);
                if (before != null) after = BoardCombat.getFight(idAt(MONSTER)).combat.enemyHp.current;
            }
        } finally { off?.(); }

        expect(before, 'the fight never engaged').not.toBeNull();
        expect(after).toBe(before - 7);
        expect(InventoryManager.getItemCount(item)).toBe(4);
        expect(renderStatement(dealsToEnemy(7))).toContain('deals 7 damage to the enemy');
    });
});

describe('2. ⭐ found by HERO, never by tile (G-43)', () => {
    it('still hits the monster after the hero’s recorded claim moves onto a bush — and never the hero there', () => {
        const fight = engage();
        const bush = place(BUSH, 'fixture_producer');
        carry(dealsToEnemy(5));

        // Move hero_1's claim straight onto the bush, with no tick: the fight
        // still names hero_1, but every by-Token lookup now says hero_1 is
        // working the bush.
        //
        // Was: re-planting the flag on the bush. Since Free Playmat 1.4c a hero
        // letting go of an enemy ends that fight in the same call (FP-43,
        // FP-49), so a re-plant can no longer leave this state behind. The
        // claim is set directly so the lookup-by-hero rule is still exercised.
        BoardState.setClaim('hero_1', { instanceId: bush.id, typeId: bush.typeId });
        expect(BoardState.workerOf(idAt(BUSH))).toBe('hero_1');
        expect(BoardCombat.fightOfHero('hero_1')).toBe(fight);

        const enemyBefore = fight.combat.enemyHp.current;
        const heroBefore = hero1().hp.current;

        const fired = LoadoutMoments.fire(BoardState.workTokenOf('hero_1'), 'hero_1', 'COMBAT_ENGAGED');

        expect(fired).toBe(1);
        expect(fight.combat.enemyHp.current).toBe(enemyBefore - 5);
        expect(hero1().hp.current).toBe(heroBefore);
    });

    it('the lookup itself reads no hero position', () => {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const src = fs.readFileSync(path.resolve(here, '../systems/board/BoardCombat.js'), 'utf8');
        const start = src.indexOf('export function fightOfHero');
        const end = src.indexOf('/** Drop the fight against', start);
        expect(start).toBeGreaterThan(0);
        expect(end).toBeGreaterThan(start);
        expect(src.slice(start, end)).not.toMatch(/workerOf|workTileOf|displayTileOf|heroTiles|getFight\(|fights\.get\(/);
    });
});

describe('3. one fight per hero', () => {
    it('a second fight stamped with the same hero ends the first, and takes back what its enemy lent', () => {
        const lent = MODIFIER_PALETTE.find(e => e.heroOnly && e.type !== 'STATUS_IMMUNITY');
        expect(lent, 'no hero-only combat axis in the palette').toBeTruthy();
        registerTokenTypes({
            fixture_enemy_v10a_debuffer: {
                id: 'fixture_enemy_v10a_debuffer', name: 'Debuffer', tokenType: 'enemy',
                rarity: 'common', theme: 'fixture', uses: 20, sprite: 'skill_occult',
                enemy: { level: 2, style: 'melee' },
                statements: [{
                    ...makeStatement(KEYWORD.PROVIDES), id: 'stm_v10a_lend',
                    payload: { type: lent.type, bucket: 'flat', value: -2 }
                }],
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        const a = place(MONSTER, 'fixture_enemy_v10a_debuffer');
        const b = place(OTHER_MONSTER, 'fixture_enemy_v10a_debuffer');

        // Fights and what they lend are keyed by the enemy's instance id (Free Playmat 1.6b).
        BoardCombat.tickToken(a, 100, 'hero_1');
        expect(hero1().aggregator.modifiers.has(`fight:${a.id}`)).toBe(true);

        BoardCombat.tickToken(b, 100, 'hero_1');

        expect(BoardCombat.getFight(a.id)).toBeNull();
        expect(BoardCombat.getFight(b.id)).toBeTruthy();
        expect(BoardCombat.fightOfHero('hero_1')).toBe(BoardCombat.getFight(b.id));
        expect(hero1().aggregator.modifiers.has(`fight:${a.id}`)).toBe(false);
        expect(hero1().aggregator.modifiers.has(`fight:${b.id}`)).toBe(true);
    });
});

describe('4. no fight → nobody, no crash, and never the hero', () => {
    it('an item aimed at the enemy does nothing and spends nothing', () => {
        place(BUSH, 'fixture_producer', 'hero_1');
        const item = carry(dealsToEnemy(9));
        const heroBefore = hero1().hp.current;

        expect(() => LoadoutMoments.fire(idAt(BUSH), 'hero_1', 'COMBAT_ENGAGED')).not.toThrow();

        expect(hero1().hp.current).toBe(heroBefore);
        expect(InventoryManager.getItemCount(item)).toBe(5);
    });

    it('each verb reaches nobody with the hero standing right there', () => {
        place(BUSH, 'fixture_producer', 'hero_1');
        hero1().hp.current = 50;
        const roles = { self: idAt(BUSH), selfHeroId: 'hero_1', actor: 'hero_1', source: null };

        expect(deal(dealsToEnemy(9), roles)).toBe(0);
        expect(EffectActions.heal({ ...makeStatement(KEYWORD.HEALS), when: onEngaged, target: toEnemy, payload: { amount: 9 } }, roles)).toBe(0);
        expect(EffectActions.remove({ ...makeStatement(KEYWORD.REMOVES), when: onEngaged, target: toEnemy, payload: {} }, roles)).toBe(0);
        expect(hero1().hp.current).toBe(50);
    });
});

describe('5. G-2: the enemy is offered only where a fight is', () => {
    it('is supplied by COMBAT_ENGAGED and SELF_COMBAT_ENGAGED, and by nothing else', () => {
        expect(getRole(ROLE.OPPONENT)?.label).toBe('the enemy');
        expect(momentSupplies('COMBAT_ENGAGED', ROLE.OPPONENT)).toBe(true);
        expect(momentSupplies('SELF_COMBAT_ENGAGED', ROLE.OPPONENT)).toBe(true);
        for (const id of ['CYCLE_START', 'COMBAT_RESOLVED', 'SELF_CYCLE_COMPLETE', 'EFFECT_TICK', null]) {
            expect(momentSupplies(id, ROLE.OPPONENT), String(id)).toBe(false);
        }
    });

    it('the picker offers it on a combat moment and not on a cycle moment', () => {
        const roleIds = (when) => slotsOf({ ...makeStatement(KEYWORD.DEALS), when }).find(s => s.id === 'role').options.map(o => o.id);
        expect(roleIds(onEngaged)).toContain(ROLE.OPPONENT);
        expect(roleIds({ event: 'CYCLE_START', scope: 'nearby' })).not.toContain(ROLE.OPPONENT);
        expect(roleIds({ event: 'COMBAT_RESOLVED', scope: 'nearby' })).not.toContain(ROLE.OPPONENT);
    });

    it('a rule aimed at the enemy on a cycle moment reaches nobody at runtime, even mid-fight', () => {
        const fight = engage();
        const before = fight.combat.enemyHp.current;
        const onCycle = dealsToEnemy(4, { when: { event: 'CYCLE_START', scope: 'self' } });
        expect(deal(onCycle, { self: idAt(MONSTER), selfHeroId: 'hero_1', actor: 'hero_1' })).toBe(0);
        expect(fight.combat.enemyHp.current).toBe(before);
    });

    it('the audit names a misplaced use, and a keyword that may never aim there', () => {
        registerTokenTypes({
            fixture_v10a_misplaced: {
                id: 'fixture_v10a_misplaced', name: 'Misplaced Thorn', tokenType: 'resource',
                rarity: 'common', theme: 'fixture', uses: 10,
                statements: [dealsToEnemy(1, { id: 'stm_v10a_misplaced', when: { event: 'CYCLE_START', scope: 'nearby' } })],
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            },
            fixture_v10a_restores_enemy: {
                id: 'fixture_v10a_restores_enemy', name: 'Enemy Restorer', tokenType: 'resource',
                rarity: 'common', theme: 'fixture', uses: 10,
                statements: [{ ...makeStatement(KEYWORD.RESTORES), id: 'stm_v10a_restores', when: onEngaged, target: toEnemy }],
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        const lines = auditContent().map(f => `${f.where}: ${f.what}`);
        const mine = lines.filter(l => l.includes('v10a') || l.includes('Misplaced') || l.includes('Restorer')).join('\n');
        // The audit names a Token by its id.
        expect(lines.some(l => l.includes('fixture_v10a_misplaced') && l.includes('the enemy') && l.includes('never supplies')), mine).toBe(true);
        expect(lines.some(l => l.includes('fixture_v10a_restores_enemy') && l.includes('"Restores" aimed at the enemy')), mine).toBe(true);
    });
});

describe('6. Heals, Removes and Applies-with-role reach the fight', () => {
    it('Heals raises the enemy’s HP, capped at its max', () => {
        const fight = engage();
        const hp = fight.combat.enemyHp;
        hp.current = hp.max - 10;
        carry({ ...makeStatement(KEYWORD.HEALS), when: onEngaged, target: toEnemy, payload: { amount: 4 }, chargeDelta: 0 });
        LoadoutMoments.fire(idAt(MONSTER), 'hero_1', 'COMBAT_ENGAGED');
        expect(hp.current).toBe(hp.max - 6);

        carry({ ...makeStatement(KEYWORD.HEALS), when: onEngaged, target: toEnemy, payload: { amount: 999 }, chargeDelta: 0 });
        LoadoutMoments.fire(idAt(MONSTER), 'hero_1', 'COMBAT_ENGAGED');
        expect(hp.current).toBe(hp.max);
    });

    it('Removes takes a live effect off the enemy, not the hero', () => {
        const fight = engage();
        registerEffects({ fixture_v10a_ward: { id: 'fixture_v10a_ward', name: 'Ward', statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_v10a_ward', payload: { type: 'ARMOR', bucket: 'flat', value: 1 } }] } });
        LiveEffects.applyTo(BoardCombat.enemyBearerOfHero('hero_1'), { effectId: 'fixture_v10a_ward', durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_v10a_ward', durationMs: 60000 });
        expect(fight.effects).toHaveLength(1);

        carry({ ...makeStatement(KEYWORD.REMOVES), when: onEngaged, target: toEnemy, payload: { effectId: '' }, chargeDelta: 0 });
        LoadoutMoments.fire(idAt(MONSTER), 'hero_1', 'COMBAT_ENGAGED');

        expect(fight.effects).toHaveLength(0);
        expect(LiveEffects.carries(hero1(), 'fixture_v10a_ward')).toBe(true);
    });

    it('Applies with a role lands on the enemy’s effects — and says so', () => {
        const fight = engage();
        registerEffects({ fixture_v10a_venom: { id: 'fixture_v10a_venom', name: 'Venom', statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_v10a_venom', payload: { type: 'ARMOR', bucket: 'flat', value: -1 } }] } });
        const rule = {
            ...makeStatement(KEYWORD.APPLIES), when: onEngaged, target: toEnemy, chargeDelta: 0,
            payload: { effectId: 'fixture_v10a_venom', durationMs: 30000, chance: 100 }
        };
        carry(rule);
        LoadoutMoments.fire(idAt(MONSTER), 'hero_1', 'COMBAT_ENGAGED');

        expect(LiveEffects.carries(fight, 'fixture_v10a_venom')).toBe(true);
        expect(LiveEffects.carries(hero1(), 'fixture_v10a_venom')).toBe(false);
        expect(renderStatement(rule, { effect: () => 'Venom' })).toContain('applies Venom to the enemy for 30 seconds');
    });
});

describe('7. G-42: Restores and Transforms cannot aim at the enemy', () => {
    it('the picker omits the role for them, and offers it for the four that can', () => {
        const offered = (kw) => slotsOf({ ...makeStatement(kw), when: onEngaged }).find(s => s.id === 'role')?.options.map(o => o.id) || [];
        for (const kw of [KEYWORD.RESTORES, KEYWORD.TRANSFORMS]) {
            expect(offered(kw), kw).not.toContain(ROLE.OPPONENT);
            expect(rolesForKeyword(kw)).not.toContain(ROLE.OPPONENT);
        }
        for (const kw of [KEYWORD.DEALS, KEYWORD.HEALS, KEYWORD.REMOVES, KEYWORD.APPLIES]) {
            expect(offered(kw), kw).toContain(ROLE.OPPONENT);
        }
    });

    it('Applies: the role slot appears only on a combat moment, and hides filter and reach once chosen', () => {
        const ids = (st) => slotsOf(st).map(s => s.id);
        const plain = { ...makeStatement(KEYWORD.APPLIES), when: { event: 'CYCLE_START', scope: 'nearby' } };
        expect(ids(plain)).not.toContain('role');
        expect(ids(plain)).toEqual(expect.arrayContaining(['reach', 'filterMode', 'filters']));

        const offeredOnly = { ...makeStatement(KEYWORD.APPLIES), when: onEngaged };
        expect(ids(offeredOnly)).toEqual(expect.arrayContaining(['role', 'reach', 'filterMode', 'filters']));

        const aimed = { ...offeredOnly, target: toEnemy };
        expect(ids(aimed)).toContain('role');
        for (const gone of ['reach', 'filterMode', 'filterValue', 'filters']) expect(ids(aimed)).not.toContain(gone);
    });
});

describe('8. G-41: on a monster’s own rule, the enemy is the monster', () => {
    it('"On Engaged: deals 6 damage to the enemy" on a monster hurts the monster, not its attacker', () => {
        registerTokenTypes({
            fixture_enemy_v10a_selfharm: {
                id: 'fixture_enemy_v10a_selfharm', name: 'Self Thorn', tokenType: 'enemy',
                rarity: 'common', theme: 'fixture', uses: 20, sprite: 'skill_occult',
                enemy: { level: 2, style: 'melee' },
                statements: [dealsToEnemy(6, { id: 'stm_v10a_selfharm', when: { event: 'SELF_COMBAT_ENGAGED', scope: 'self' }, chargeDelta: 0 })],
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        place(MONSTER, 'fixture_enemy_v10a_selfharm', 'hero_1');
        run(600);
        const fight = BoardCombat.getFight(idAt(MONSTER));
        expect(fight).toBeTruthy();
        fight.combat.enemyHp.current = fight.combat.enemyHp.max;
        const heroBefore = hero1().hp.current;

        // The real trigger path: the board event → TriggerSystem → the verb.
        EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, { instanceId: idAt(MONSTER), typeId: 'fixture_enemy_v10a_selfharm', heroId: 'hero_1' });

        expect(fight.combat.enemyHp.current).toBe(fight.combat.enemyHp.max - 6);
        expect(hero1().hp.current).toBe(heroBefore);
    });
});

describe('9. the vocabulary', () => {
    it('declares the enemy once, with the game’s own word', () => {
        expect(ROLES.filter(r => r.id === ROLE.OPPONENT)).toHaveLength(1);
    });
});
