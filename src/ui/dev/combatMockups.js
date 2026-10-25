// The combat screen mock-ups' fixture data (brief 220, C6a): one fight frozen at 0:12, two enemy
// cards, every kind of floating number, and the three options' words. Static pictures for the
// owner to pick from on the style sheet page; nothing in the game reads this file.
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

/** The three options: what each is, and what it would cost to draw (reasoned; GDD §14). */
export const COMBAT_OPTIONS = Object.freeze([
    Object.freeze({
        id: 'A', name: 'A: Compact',
        summary: 'Everything small and tidy. One framed strip above the fight holds both HP bars with the number on the bar and the fight icon between them; floats rise straight up in the kit’s title size (a crit in the display size). The panel is one narrow column the width of a Token card, the hero then the enemy, with the last four swings.',
        cost: 'Counted in this mock-up: the strip (both bars, both numbers, the icon) is 15 elements and the plate 13, so 28 per fight at rest against today’s 8 (two bars): about 2 Tokens’ worth more, under a tenth of a fight’s 30. An HP change rewrites one fill and one number, about once a second in a duel, with no slide (today’s bars slide for 0.3 s). Floats: about 3 elements each for half a second, about one a second per fight (today one every 3 s, the hero’s hits only). The panel, only while open: about 77 elements, re-drawn once a swing.'
    }),
    Object.freeze({
        id: 'B', name: 'B: Duel sheet',
        summary: 'Big and spelled out. Thin bars over each head, the number written above its bar; the fight icon on its own chip at the fight’s top corner beside the enemy’s bar, clear of the flag. Floats are big (display size), a crit wears a gold edge, poison and burn ticks get colours of their own. The panel is wide, the hero and the enemy side by side with portraits, words for every stat and a timed log of the last six swings.',
        cost: 'Counted in this mock-up: the two bars with their numbers 8, the icon chip 5, the plate with fights-left counts 15, so 28 per fight at rest: about 2 Tokens’ worth more than today. Updates as A. Floats as A, but at the display size each repaints about three times the area while it rises. The panel, only while open: about 119 elements, the heaviest, re-drawn once a swing.'
    }),
    Object.freeze({
        id: 'C', name: 'C: Scene card',
        summary: 'Quiet on the mat, like the work plate. Short bars over each head with the number beside each bar on its outer side; the fight icon is the bare sprite between the bars; floats are small and rise at each fighter’s outer side, clear of the flag and the bars, a glyph telling a heal, poison or burn. The plate shows the two styles at rest and opens to the elixirs on hover. The panel is the Token card itself: the battlefield scene behind see-through boxes.',
        cost: 'Counted in this mock-up: the two bars with side numbers 8, the bare icon 2, the plate at rest 6, so 16 per fight at rest: about 1 Token’s worth more than today, the cheapest. Updates as A. Floats: about 3 elements each, small. The panel, only while open: about 78 elements and one 512 px picture, re-drawn once a swing.'
    })
]);
