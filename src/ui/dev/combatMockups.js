// The combat screen mock-ups' fixture data: one fight frozen at 0:12, two enemy
// cards, every kind of floating number, the settled look on the mat and the three fight panel
// options' words. Static pictures for the owner to pick from on the style sheet page; nothing in
// the game reads this file.
//
// The fight follows the level table and the C2/C4 rules (concept_combat.md), so its numbers add
// up: a Melee 20 Fighter with a Copper Sword (2 + 1 level step + 1 Valor = 4), a Leather Chest and
// Ironskin (armour 2), against a level-20 Goblin Warlord (a fixture, not content: HP 40, Brute hits
// 3 every 4 s, Venomous poisons on each landed hit), the hero starting at 27 of 30 HP.

/** Percentage of `cur` in `max`, rounded halves up (the combat rounding rule). */
export function hpPercent(cur, max) {
    if (!(max > 0)) return 0;
    return Math.floor((Math.max(0, cur) / max) * 100 + 0.5);
}

/** What an HP bar says: the number and the percentage, `17 · 57%`. */
export function hpLabel(cur, max) {
    return `${Math.max(0, Math.round(cur))} · ${hpPercent(cur, max)}%`;
}

export const FIGHT = Object.freeze({
    clock: '0:12',
    hero: Object.freeze({
        name: 'Aela', sheet: 'assets/heroes/hn_fighter_sheet.png', portrait: 'assets/heroes/hm_fighter_por.png',
        style: 'melee', level: 20, hp: 17, maxHp: 30, hit: 4, armour: 2, swing: '3 s', weapon: 'item_copper_sword',
        elixirs: Object.freeze([
            Object.freeze({ itemId: 'item_elixir_of_valor', name: 'Valor', effect: '+1 damage', fightsLeft: 7 }),
            Object.freeze({ itemId: 'item_elixir_of_ironskin', name: 'Ironskin', effect: '+1 armour', fightsLeft: 3 })
        ]),
        statuses: Object.freeze([
            Object.freeze({ id: 'poison', name: 'Poison', stacks: 2, maxStacks: 3, effect: '2 damage a tick (every 3 s) until the fight ends' })
        ])
    }),
    enemy: Object.freeze({
        name: 'Goblin Warlord', typeId: 'token_goblin_chief', sprite: 'assets/enemies/goblin/e_goblin_chief.png',
        style: 'melee', level: 20, hp: 24, maxHp: 40, hit: 3, armour: 0, swing: '4 s', xp: 33,
        kinds: Object.freeze(['Brute', 'Venomous']), known: true, statuses: Object.freeze([])
    }),
    /** What just happened, newest first: `who` hit, `to` took it. `tone` colours the number. */
    log: Object.freeze([
        Object.freeze({ t: '0:12', icon: 'drop', text: 'Poison hurts Aela', amount: '−2', tone: 'hurt' }),
        Object.freeze({ t: '0:12', icon: 'miss', text: 'Goblin Warlord misses Aela', amount: null, tone: 'miss' }),
        Object.freeze({ t: '0:12', icon: 'hit', text: 'Aela hits Goblin Warlord', amount: '4', tone: 'hit' }),
        Object.freeze({ t: '0:09', icon: 'drop', text: 'Poison hurts Aela', amount: '−2', tone: 'hurt' }),
        Object.freeze({ t: '0:09', icon: 'miss', text: 'Aela misses', amount: null, tone: 'miss' }),
        Object.freeze({ t: '0:08', icon: 'star', text: 'Goblin Warlord crits Aela, Poison ×2', amount: '−4', tone: 'hurt' }),
        Object.freeze({ t: '0:06', icon: 'star', text: 'Aela crits Goblin Warlord', amount: '8', tone: 'hit' })
    ])
});

/** The enemy card's two states: a kind the guild has fought (its kinds shown) and one it has not. */
export const ENEMY_CARDS = Object.freeze([
    Object.freeze({
        id: 'known', caption: 'Fought before: its kinds show',
        name: 'Goblin Warlord', typeId: 'token_goblin_chief', style: 'melee', level: 20, hp: 40, hit: 3, armour: 0, swing: '4 s',
        kinds: Object.freeze([
            Object.freeze({ name: 'Brute', tip: 'Brute: big hits every 4 s' }),
            Object.freeze({ name: 'Venomous', tip: 'Venomous: each hit adds a stack of Poison' })
        ]),
        known: true
    }),
    Object.freeze({
        id: 'unknown', caption: 'Never fought: its kinds stay hidden',
        name: 'Goblin', typeId: 'token_goblin', style: 'melee', level: 5, hp: 25, hit: 1, armour: 0, swing: '3 s',
        kinds: Object.freeze([]), known: false
    })
]);

/**
 * Every floating number a fight draws, on the side it rises over. `kind`: hit, crit, miss, heal,
 * poison, burn. The game draws them one at a time; the sheet shows them side by side.
 */
export const FLOAT_SAMPLES = Object.freeze([
    Object.freeze({ id: 'enemy-hit', on: 'enemy', kind: 'hit', text: '4', caption: 'Hero hits' }),
    Object.freeze({ id: 'enemy-crit', on: 'enemy', kind: 'crit', text: '8', caption: 'Hero crits' }),
    Object.freeze({ id: 'enemy-miss', on: 'enemy', kind: 'miss', text: 'Miss', caption: 'Hero misses' }),
    Object.freeze({ id: 'hero-hit', on: 'hero', kind: 'hit', text: '1', caption: 'Enemy hits' }),
    Object.freeze({ id: 'hero-crit', on: 'hero', kind: 'crit', text: '4', caption: 'Enemy crits' }),
    Object.freeze({ id: 'hero-miss', on: 'hero', kind: 'miss', text: 'Miss', caption: 'Enemy misses' }),
    Object.freeze({ id: 'hero-heal', on: 'hero', kind: 'heal', text: '+5', caption: 'Food heals' }),
    Object.freeze({ id: 'hero-poison', on: 'hero', kind: 'poison', text: '2', caption: 'Poison tick (×2)' }),
    Object.freeze({ id: 'hero-burn', on: 'hero', kind: 'burn', text: '1', caption: 'Burn tick' })
]);

/**
 * Placeholder icons drawn in code until the owner draws them (8×8, `#` a lit pixel), as the card
 * icons are: the fight's icon, hit, armour, a heal, poison, burn, a crit, a miss.
 */
export const COMBAT_GLYPHS = Object.freeze({
    fight: [
        '#......#',
        '.#....#.',
        '..#..#..',
        '...##...',
        '...##...',
        '.##..##.',
        '.#....#.',
        '#......#'
    ],
    hit: [
        '#..#..#.',
        '.#.#.#..',
        '..###...',
        '#######.',
        '..###...',
        '.#.#.#..',
        '#..#..#.',
        '........'
    ],
    shield: [
        '.######.',
        '.######.',
        '.######.',
        '.######.',
        '..####..',
        '..####..',
        '...##...',
        '........'
    ],
    heart: [
        '........',
        '.##.##..',
        '#######.',
        '#######.',
        '.#####..',
        '..###...',
        '...#....',
        '........'
    ],
    drop: [
        '...#....',
        '...#....',
        '..###...',
        '.#####..',
        '.#####..',
        '.#####..',
        '..###...',
        '........'
    ],
    flame: [
        '...#....',
        '..##....',
        '..###.#.',
        '.#####..',
        '.######.',
        '.######.',
        '..####..',
        '........'
    ],
    star: [
        '...#....',
        '...#....',
        '#######.',
        '.#####..',
        '..###...',
        '.##.##..',
        '.#...#..',
        '........'
    ],
    miss: [
        '........',
        '........',
        '........',
        '.######.',
        '........',
        '........',
        '........',
        '........'
    ],
    down: [
        '........',
        '........',
        '#######.',
        '.#####..',
        '..###...',
        '...#....',
        '........',
        '........'
    ],
    up: [
        '........',
        '........',
        '...#....',
        '..###...',
        '.#####..',
        '#######.',
        '........',
        '........'
    ],
    clock: [
        '..####..',
        '.#....#.',
        '#..#...#',
        '#..#...#',
        '#..###.#',
        '#......#',
        '.#....#.',
        '..####..'
    ]
});

/** The fight on the mat as the owner settled it after round one (2026-10-25). */
export const MAT_SETTLED = Object.freeze({
    name: 'On the mat (settled)',
    summary: 'Option B’s layout: a thin bar over each head with the number written above it, the fight icon on its chip at the fight’s top corner, the bubble row with a divider and each elixir’s fights left. Floats in A’s sizes (title size, a crit’s number in the display size under a gold “Crit!”), rising at each fighter’s outer side, below the bars and clear of the flag. Poison and burn ticks red with a drop or a flame.',
    cost: 'Counted in this mock-up: the two bars with their numbers 8, the icon chip 5, the plate 15: 28 per fight at rest, against today’s 8 (about 2 Tokens’ worth more, under a tenth of a fight’s 30). Floats: about 3 elements each for half a second, about one a second per fight.'
});

/** The fight panel's three options, from the most stylish to the most compact. */
export const PANEL_OPTIONS = Object.freeze([
    Object.freeze({
        id: '1', name: 'Panel 1: Arena',
        summary: 'The most stylish. A wide battlefield scene (the art at 2×) with the two fighters at the mat’s size, facing each other mid-swing, their bars and numbers over their heads and the last hit rising beside them. Under the scene, one strip per side: style and level, hit, armour and swing, then the hero’s elixirs and statuses or the enemy’s kinds. The log opens below.',
        cost: 'Counted in this mock-up: 87 elements with the log closed, 112 open, and one picture (the battlefield at 2×). Drawn only while open, one panel at a time: about 9 Tokens’ worth, the most of the three, and about one update a second (two bars, a number, a float, a log line when open). The biggest on screen: 372 px wide.'
    }),
    Object.freeze({
        id: '2', name: 'Panel 2: Versus card',
        summary: 'The balance. The Token card’s width and look: the battlefield at 1× with the fighters at 1× facing each other under the title, then a versus table, the hero’s numbers left and the enemy’s right of one shared icon column, so each pair reads across. Elixirs and statuses under the hero, kinds under the enemy. The log opens below.',
        cost: 'Counted in this mock-up: 74 elements with the log closed, 94 open, and one picture (the battlefield at 1×). Drawn only while open: about 7 Tokens’ worth, about one update a second. The Token card’s width: 268 px.'
    }),
    Object.freeze({
        id: '3', name: 'Panel 3: Compact',
        summary: 'The most condensed. A header line, then a short battlefield band with the two fighters at 1× at its ends, then two dense columns, one per side: name and level, bar and number, hit, armour and swing, elixirs and statuses or kinds. The log opens below.',
        cost: 'Counted in this mock-up: 79 elements with the log closed, 99 open, and one picture (a strip of the battlefield at 2×). Drawn only while open: about 8 Tokens’ worth, about one update a second. The least height: 316 px wide.'
    })
]);

/** Motion any panel could have, and what it would cost (reasoned). */
export const PANEL_MOTION = Object.freeze({
    summary: 'Light motion, any option: both fighters play their idle cycle (8 frames at 8 a second, the mat’s own clock and sheets); on each swing the attacker plays its attack row once and steps 2 art pixels forward on the strike frame, and the number rises beside the target. No particles, no shake.',
    cost: 'Reasoned: while the panel is open, two sprites step 8 times a second (one style write each, as a hero on the mat does), plus a 3-frame step and a float per swing (about one every 2 s in a duel). Only one panel is open at a time, and none while closed; well under a hero’s cost on the mat. The goblin sheets are on disk but not yet wired (only the cow animates on the mat today), so the enemy would stand still until its sheet is registered.'
});
