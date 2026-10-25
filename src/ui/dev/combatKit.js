// The combat screen's style sheet entry, fed a fixture fight: Aela (Melee 20) with Valor and Ironskin,
// poisoned ×2, against a Goblin Warlord (a Brute, Venomous) at 0:12, and the fight before it.
// Nothing in the game reads this file.

import { TONE, OUTCOME, MOMENT } from '../components/combat/fightWatch.js';
import { healthText } from '../components/board/healthBar.js';
import { kindView } from '../components/combat/fightView.js';
import { CELL } from '../components/board/workPlate.js';

const line = (n, icon, tone, key, vars, amount = null) => ({ n, icon, tone, key, vars, amount });
const AV = { hero: 'Aela', enemy: 'Goblin Warlord' };

/** This fight, 12 s in, newest last. */
export const KIT_CURRENT = Object.freeze({
    id: 2, heroId: 'kit_aela', heroName: 'Aela', instanceId: 'kit_warlord', typeId: 'token_goblin_chief', enemyName: 'Goblin Warlord',
    startedAt: 0, endedAt: null, outcome: null, joinedLate: false, trimmed: 0,
    hp: { hero: { cur: 17, max: 30 }, enemy: { cur: 24, max: 40 } },
    log: [
        line(1, 'potion', TONE.NOTE, 'drinks', { hero: 'Aela', item: 'Elixir of Valor' }),
        line(2, 'star', TONE.HIT, 'heroCrits', AV, '8'),
        line(3, 'star', TONE.HURT, 'enemyCrits', AV, '−4'),
        line(4, 'drop', TONE.NOTE, 'statusLands', { status: 'Poison', who: 'Aela' }, '×2'),
        line(5, 'miss', TONE.MISS, 'heroMisses', AV),
        line(6, 'drop', TONE.HURT, 'statusHurts', { status: 'Poison', who: 'Aela' }, '−2'),
        line(7, 'hit', TONE.HIT, 'heroHits', AV, '4'),
        line(8, 'miss', TONE.MISS, 'enemyMisses', AV),
        line(9, 'drop', TONE.HURT, 'statusHurts', { status: 'Poison', who: 'Aela' }, '−2')
    ]
});

/** The fight before it: a win in 0:42. */
export const KIT_LAST = Object.freeze({
    ...KIT_CURRENT, id: 1, startedAt: 0, endedAt: 42_000, outcome: OUTCOME.WON,
    hp: { hero: { cur: 25, max: 30 }, enemy: { cur: 0, max: 40 } },
    log: [
        line(1, 'hit', TONE.HIT, 'heroHits', AV, '4'),
        line(2, 'hit', TONE.HURT, 'enemyHits', AV, '−1'),
        line(3, 'heart', TONE.HEAL, 'eats', { hero: 'Aela', item: 'Shrimp' }, '+5'),
        line(4, 'hit', TONE.HIT, 'heroHits', AV, '4'),
        line(5, 'bag', TONE.NOTE, 'drops', { items: 'Bones, 2 Copper Ingot' }),
        line(6, 'fight', TONE.HIT, 'won', AV)
    ]
});

export const KIT_FIGHTS = Object.freeze({ current: KIT_CURRENT, last: KIT_LAST });

/** The panel's view of this fight (`fightView.fightPanelView`'s shape). */
export function kitPanelView() {
    const hero = {
        id: 'kit_aela', name: 'Aela', style: 'melee', level: 20, sprite: 'fighter',
        hp: { cur: 17, max: 30 }, hit: 4, armour: 2, swingMs: 3000,
        hitLines: ['Copper Sword: 2', 'Combat level: +1', 'Elixirs and gear: +1'],
        elixirs: [
            { itemId: 'item_elixir_of_valor', name: 'Elixir of Valor', left: 7 },
            { itemId: 'item_elixir_of_ironskin', name: 'Elixir of Ironskin', left: 3 }
        ],
        statuses: [{ id: 'effect_poison', name: 'Poison', stacks: 2, maxStacks: 3, ticksLeft: null, icon: 'drop' }],
        art: { sheet: 'assets/heroes/hn_fighter_sheet.png', still: 'assets/heroes/hm_fighter_por.png' }
    };
    const enemy = {
        typeId: 'token_goblin_chief', name: 'Goblin Warlord', style: 'melee', level: 20,
        hp: { cur: 24, max: 40 }, hit: 3, armour: 0, swingMs: 4000,
        kinds: ['brute', 'venomous'].map(kindView), statuses: [], buffs: [], sheet: null
    };
    return {
        heroId: 'kit_aela', live: false, title: 'Aela vs Goblin Warlord', clock: '0:12', ended: null, instanceId: 'kit_warlord',
        hero: { ...hero, hpText: healthText(17, 30) },
        enemy: { ...enemy, hpText: healthText(24, 40) }
    };
}

/** The fight plate's cells as the mat shows them, the hero on the enemy's right. */
export const KIT_PLATE_CELLS = Object.freeze([
    { kind: CELL.SKILL, id: 'melee', who: 'enemy' },
    { kind: CELL.DIVIDER },
    { kind: CELL.SKILL, id: 'melee', who: 'hero' },
    { kind: CELL.ELIXIR, itemId: 'item_elixir_of_valor', count: 7 },
    { kind: CELL.ELIXIR, itemId: 'item_elixir_of_ironskin', count: 3 }
]);

/** Every float a fight draws, with what it means. */
export const KIT_FLOATS = Object.freeze([
    { kind: MOMENT.HIT, on: 'enemy', amount: 4, caption: 'Hero hits' },
    { kind: MOMENT.CRIT, on: 'enemy', amount: 8, caption: 'Hero crits' },
    { kind: MOMENT.MISS, on: 'enemy', amount: null, caption: 'Hero misses' },
    { kind: MOMENT.HIT, on: 'hero', amount: 1, caption: 'Enemy hits' },
    { kind: MOMENT.CRIT, on: 'hero', amount: 4, caption: 'Enemy crits' },
    { kind: MOMENT.MISS, on: 'hero', amount: null, caption: 'Enemy misses' },
    { kind: MOMENT.HEAL, on: 'hero', amount: 5, caption: 'Food heals' },
    { kind: MOMENT.TICK, on: 'hero', amount: 2, statusId: 'effect_poison', caption: 'Poison tick' },
    { kind: MOMENT.TICK, on: 'hero', amount: 1, statusId: 'effect_burn', caption: 'Burn tick' }
]);

/** The enemy card's two states: fought (its kinds show) and never fought. */
export const KIT_CARDS = Object.freeze([
    { typeId: 'token_goblin_chief', name: 'Goblin Warlord', level: 20, style: 'melee', hp: 40, hit: 3, armour: 0, swingMs: 4000, kinds: ['brute', 'venomous'].map(kindView) },
    { typeId: 'token_goblin', name: 'Goblin Scout', level: 5, style: 'melee', hp: 25, hit: 1, armour: 0, swingMs: 2000, kinds: null }
]);
