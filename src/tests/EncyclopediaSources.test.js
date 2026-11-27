// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { buildEncyclopedia, encyclopedia, hallLinesByRank, EVENT_WAY } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { waysIn, waysOut, wayInWord, wayOutWord, chartOf, layoutChart, yieldText, ranksText } from '../ui/components/encyclopedia/encyclopediaChart.js';
import { ChartView, yieldsText } from '../ui/components/encyclopedia/EncyclopediaChartView.jsx';
import { buildWorld, HOW, itemKey, tokenKey } from '../systems/progression/ledger/engine.js';
import { GUILD_UPGRADES, HALL_NODE } from '../config/guildUpgrades.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { withRequiredThree } from './fixtures/hallSky.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';
import en from '../i18n/en.json';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { poolForTool } from '../config/registries/catchPools.js';

/**
 * ⭐ The Encyclopedia lists every way the game really pays out an item, with amounts (brief 790 W7):
 * the Guild Hall's star lines and the Wishing Well at each rank, events as the source of their
 * Tokens, every catch pool with its tool and bait, a Token's second row for an item it gives twice,
 * a spawn with no weight never picked, as the engine picks; each source box shows its amount as the
 * card does (`×6`, `×2 · 50% base`).
 */

const I = itemKey;
const T = tokenKey;

afterEach(() => {
    cleanup();
    registerHallSky(null);
});

describe('a spawn with no weight is never picked, as the game picks (weightedPick); a retired turn gives nothing', () => {
    const content = (spawns, into) => {
        const ws = ledgerContent();
        ws.tokens.token_goblin_camp.spawner.spawns = spawns;
        ws.tokens.token_egg = { id: 'token_egg', name: 'Egg', turns: { chance: 10, into } };
        return ws;
    };
    const givesOf = (world, id) => world.rules.find(r => r.id === id)?.gives.map(g => [g.key, g.chance]) ?? null;

    it('a weightless or zero-weight spawn is left out; the rest share the draw', () => {
        const world = buildWorld(content(
            [{ typeId: 'token_goblin', weight: 3 }, { typeId: 'token_goblin_chief' }, { typeId: 'token_fire_elemental', weight: 0 }],
            [{ typeId: 'token_goblin', weight: 1 }, { typeId: 'token_goblin_chief' }]
        ));
        expect(givesOf(world, 'spawn:token_goblin_camp')).toEqual([[T('token_goblin'), 1]]);
        expect(givesOf(world, 'turn:token_egg')).toBeNull();
    });

    it('a spawner whose spawns all lack a weight spawns nothing', () => {
        const world = buildWorld(content([{ typeId: 'token_goblin' }], [{ typeId: 'token_goblin', weight: -1 }]));
        expect(givesOf(world, 'spawn:token_goblin_camp')).toBeNull();
        expect(givesOf(world, 'turn:token_egg')).toBeNull();
    });

    it('weights read as numbers, as the game reads them', () => {
        const world = buildWorld(content([{ typeId: 'token_goblin', weight: '1' }, { typeId: 'token_goblin_chief', weight: 3 }], []));
        expect(givesOf(world, 'spawn:token_goblin_camp')).toEqual([[T('token_goblin'), 0.25], [T('token_goblin_chief'), 0.75]]);
    });
});

describe('no row dropped: an item a Token gives twice, every catch pool', () => {
    /** The Oak Tree also finds Oak Wood (2 to 3) on its rare table. */
    const twice = () => {
        const ws = ledgerContent();
        ws.tokens.token_oak_tree.config.outputs[0] = { itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 2 };
        ws.tokens.token_oak_tree.rareTable = { chance: 1, entries: [{ itemId: 'item_oak_wood', weight: 1, minQty: 2, maxQty: 3 }] };
        return ws;
    };

    it('the outputs and the rare table: two rows, two ways in, two lines out', () => {
        const book = buildEncyclopedia(twice());
        const rows = book.sourcesOf(I('item_oak_wood')).filter(r => r.via === T('token_oak_tree'));
        expect(rows.map(r => [r.rare, r.min, r.max, r.chance])).toEqual([[false, 1, 2, 1], [true, 2, 3, 0.01]]);
        const ways = waysIn(book, I('item_oak_wood')).filter(w => w.from === T('token_oak_tree'));
        expect(ways.map(w => [yieldText(w.yields), w.chance, wayInWord(book, w).word])).toEqual([['×1–2', 1, 'gives'], ['×2–3', 0.01, 'finds']]);
        const outs = waysOut(book, T('token_oak_tree')).filter(w => w.to === I('item_oak_wood'));
        expect(outs.map(w => [yieldText(w.yields), wayOutWord(book, T('token_oak_tree'), w).tip])).toEqual([['×1–2', 'gives'], ['×2–3', 'rareFind']]);
    });

    it('a rare find of one shows no count, as the card\'s Rare finds; a catch shows only its odds', () => {
        const ws = twice();
        ws.tokens.token_oak_tree.rareTable.entries[0] = { itemId: 'item_oak_wood', weight: 1, minQty: 1, maxQty: 1 };
        const book = buildEncyclopedia(ws);
        const rare = waysIn(book, I('item_oak_wood')).find(w => w.rare);
        expect(rare.yields).toBeNull();
        expect(waysIn(book, I('item_trout')).every(w => w.yields === null)).toBe(true);
    });

    it('every catch pool is a way in: its bait spent, its tool held (never used up), both named on the line', () => {
        const book = buildEncyclopedia(ledgerContent());
        const shrimp = waysIn(book, I('item_shrimp'));
        const trout = waysIn(book, I('item_trout'));
        expect(shrimp.map(w => [w.how, w.from, w.inputs])).toEqual([[HOW.CATCH, T('token_coast'), [{ key: I('item_fishing_trap'), quantity: null, held: true }]]]);
        expect(trout.map(w => w.inputs)).toEqual([[{ key: I('item_worm'), quantity: 1 }, { key: I('item_fishing_rod'), quantity: null, held: true }]]);
        expect(wayInWord(book, shrimp[0])).toEqual({ word: 'catch', tip: 'catchWith', args: { tool: 'Trap' } });
        expect(wayInWord(book, trout[0])).toEqual({ word: 'catch', tip: 'catchBait', args: { tool: 'Fishing Rod', bait: 'Worm' } });
        // The water's own page: a line out per pool's catch, each naming its pool.
        expect(waysOut(book, T('token_coast')).map(w => [w.to, wayOutWord(book, T('token_coast'), w).tip]))
            .toEqual([[I('item_shrimp'), 'catchWith'], [I('item_trout'), 'catchBait']]);
    });

    it('the same fish from two pools of one water: a way in for each, at its own odds', () => {
        const ws = ledgerContent();
        ws.tokens.token_coast.catchPools[1].catches.push({ itemId: 'item_shrimp', weight: 3 });
        const book = buildEncyclopedia(ws);
        const ways = waysIn(book, I('item_shrimp'));
        expect(ways.map(w => [w.from, w.chance, w.bait])).toEqual([[T('token_coast'), 1, null], [T('token_coast'), 0.75, 'Worm']]);
        expect(waysOut(book, T('token_coast')).filter(w => w.to === I('item_shrimp')).map(w => w.chance)).toEqual([1, 0.75]);
    });

    it('the held tool\'s line carries its word, "held", below it and past the box\'s tab', () => {
        const book = buildEncyclopedia(ledgerContent());
        const lay = layoutChart(chartOf(book, I('item_trout')));
        const held = lay.words.find(w => w.word === 'held');
        expect(held).toMatchObject({ side: 'in', below: true, from: I('item_fishing_rod'), to: I('item_trout') });
        const rod = lay.nodes.find(n => n.node.key === I('item_fishing_rod'));
        expect(rod.node.need).toBeNull();
        const tab = lay.stems.find(s => s.id === `${rod.id}|out`);
        expect(held.x).toBe(rod.x + rod.w + (tab ? tab.w : 0) + 6);
        expect(held.y).toBeGreaterThan(rod.y + rod.h / 2);
    });
});

describe('amounts on every source line, as the card shows them', () => {
    const book = buildEncyclopedia(ledgerContent());

    it('a box says how many its way gives: a vein, a drop, a recipe, a bonus, Passive Production', () => {
        const amount = (key, from) => yieldText(waysIn(book, key).find(w => w.from === from)?.yields);
        expect(amount(I('item_copper_ore'), T('token_copper_vein'))).toBe('×1–2');
        expect(amount(I('item_honey'), T('token_goblin'))).toBe('×1');
        expect(amount(I('item_bird_nest'), T('token_birdwatcher'))).toBe('×1');
        expect(amount(I('item_seed'), T('token_guild_hall'))).toBe('×2');
        const smelt = waysIn(book, I('item_copper_ingot'))[0];
        expect([smelt.how, yieldText(smelt.yields)]).toEqual([HOW.CRAFT, '×1']);
    });

    it('a Token spawned, grown or placed gives no count', () => {
        expect(waysIn(book, T('token_goblin')).every(w => w.yields === null)).toBe(true);
        expect(waysIn(book, T('token_oak_tree')).every(w => w.yields === null)).toBe(true);
    });

    it('writes an amount and a Hall track\'s ranks', () => {
        expect(yieldText({ min: 6, max: 6 })).toBe('×6');
        expect(yieldText({ min: 2, max: 4 })).toBe('×2–4');
        expect(yieldText(null)).toBeNull();
        const steps = (...q) => q.map((quantity, i) => ({ rank: i + 1, quantity }));
        expect(ranksText(steps(2, 5, 8))).toBe('rank 1 ×2, rank 2 ×5, rank 3 ×8');
        // A rank that pays what the one before did is not named again.
        expect(ranksText(steps(1, 1, 2, 2, 3))).toBe('rank 1 ×1, rank 3 ×2, rank 5 ×3');
        const well = steps(10, 20, 30, 40, 50, 60, 70, 80, 90, 100);
        // A box has two lines: "rank" named once, a long list kept to its first and last.
        expect(ranksText(steps(2, 5, 8), { short: true })).toBe('rank 1 ×2, 2 ×5, 3 ×8');
        expect(ranksText(well, { short: true })).toBe('rank 1 ×10 … 10 ×100');
        expect(ranksText(well)).toBe(well.map(r => `rank ${r.rank} ×${r.quantity}`).join(', '));
        expect(ranksText(steps(1200), { short: true })).toBe('rank 1 ×1,200');
    });
});

describe('the Guild Hall pays at every rank: its star lines and the Wishing Well', () => {
    /** A Woodpile star paying Oak Wood 2, 5, 8 by rank, and a star that pays nothing. */
    const SKY = {
        constellations: { well_x: { id: 'well_x', name: 'Well X', label: { x: 0, y: 1 } } },
        stars: {
            es_woodpile: {
                id: 'es_woodpile', constellation: 'well_x', name: 'Woodpile', node: { x: 0, y: 1.2 }, links: [HALL_NODE],
                ranks: [2, 5, 8].map((quantity, i) => ({ tier: i, price: [{ itemId: 'item_seed', quantity: 1 }], rules: [], lines: [{ itemId: 'item_oak_wood', quantity }] }))
            },
            es_quiet: { id: 'es_quiet', constellation: 'well_x', name: 'Quiet', node: { x: 0.3, y: 1.2 }, links: [HALL_NODE], ranks: [{ tier: 0, price: [], rules: [], lines: [] }] }
        }
    };

    it('reads what each track pays the Hall at each rank through the game\'s own Passive Production lines', () => {
        registerHallSky(withRequiredThree(SKY));
        const rows = hallLinesByRank(GUILD_UPGRADES);
        expect(rows.find(r => r.trackId === 'es_woodpile')).toEqual({
            trackId: 'es_woodpile', name: 'Woodpile', itemId: 'item_oak_wood',
            ranks: [{ rank: 1, quantity: 2 }, { rank: 2, quantity: 5 }, { rank: 3, quantity: 8 }]
        });
        const well = rows.find(r => r.trackId === 'wishing_well');
        expect([well.itemId, well.ranks.length, well.ranks[0], well.ranks.at(-1)]).toEqual(['item_water', 10, { rank: 1, quantity: 10 }, { rank: 10, quantity: 100 }]);
        // Bank Tabs, Bunk Beds and a star with no lines pay nothing.
        expect(rows.filter(r => !['es_woodpile', 'wishing_well'].includes(r.trackId))).toEqual([]);
    });

    it('a star line is a way in from the Guild Hall: the star on its line, its ranks on the box and in the hover', () => {
        registerHallSky(withRequiredThree(SKY));
        const book = buildEncyclopedia({ ...ledgerContent(), hallProduction: hallLinesByRank(GUILD_UPGRADES) });
        const way = waysIn(book, I('item_oak_wood')).find(w => w.how === HOW.UPGRADE);
        expect(way).toMatchObject({ from: T('token_guild_hall'), caption: 'hallStar', captionArgs: { star: 'Woodpile' }, star: 'Woodpile' });
        expect(yieldsText({ ranks: way.ranks })).toBe('rank 1 ×2, 2 ×5, 3 ×8');
        expect(wayInWord(book, way)).toEqual({ word: 'gives', tip: 'givesHall', args: { star: 'Woodpile', ranks: 'rank 1 ×2, rank 2 ×5, rank 3 ×8' } });
        // The Hall's page: what it gives, each track at its ranks, beside its own Passive Production.
        expect(waysOut(book, T('token_guild_hall')).map(w => [w.to, w.how])).toEqual(expect.arrayContaining([
            [I('item_oak_wood'), HOW.UPGRADE], [I('item_water'), HOW.UPGRADE], [I('item_seed'), HOW.TRICKLE]
        ]));
    });

    it('the Wishing Well at every rank stands for the ledger\'s Well, which knows only rank 1', () => {
        const ledgerOnly = buildEncyclopedia(ledgerContent());
        expect(ledgerOnly.sourcesOf(I('item_water')).filter(r => r.how === HOW.UPGRADE).map(r => r.ranks ?? null)).toEqual([null]);
        const book = buildEncyclopedia({ ...ledgerContent(), hallProduction: hallLinesByRank(GUILD_UPGRADES) });
        const rows = book.sourcesOf(I('item_water')).filter(r => r.how === HOW.UPGRADE);
        expect(rows.map(r => [r.star.name, r.ranks.length])).toEqual([['Wishing Well', 10]]);
    });
});

describe('an event is the source of the Token it lands', () => {
    const events = (extra = {}) => ({
        event_comet: { id: 'event_comet', name: 'Iron Vein', typeId: 'token_iron_vein', kind: 'node', weight: 10 },
        event_odd: { id: 'event_odd', name: 'Glitter', typeId: 'token_wild_hive', kind: 'node', weight: 5 },
        event_never: { id: 'event_never', name: 'Never', typeId: 'token_coal_vein', kind: 'node', weight: 0 },
        event_kindless: { id: 'event_kindless', name: 'Kindless', typeId: 'token_copper_vein', weight: 5 },
        ...extra
    });

    it('a way in with no box, named "Special event"; under another name than its Token\'s, that name too', () => {
        const book = buildEncyclopedia({ ...ledgerContent(), events: events() });
        const [vein] = waysIn(book, T('token_iron_vein')).filter(w => w.how === EVENT_WAY);
        expect(vein).toMatchObject({ caption: 'event', from: null, inputs: [] });
        const [hive] = waysIn(book, T('token_wild_hive')).filter(w => w.how === EVENT_WAY);
        expect(hive).toMatchObject({ caption: 'eventNamed', captionArgs: { name: 'Glitter' } });
        expect(wayInWord(book, vein)).toBeNull();
    });

    it('an event that can never land (no weight, no kind) is no way in', () => {
        const book = buildEncyclopedia({ ...ledgerContent(), events: events() });
        expect(book.sourcesOf(T('token_coal_vein')).some(r => r.how === EVENT_WAY)).toBe(false);
        expect(book.sourcesOf(T('token_copper_vein')).some(r => r.how === EVENT_WAY)).toBe(false);
    });

    it('an event changes no reach: its Token stays out of the total until had, as luck', () => {
        const without = buildEncyclopedia(ledgerContent());
        const withEvents = buildEncyclopedia({ ...ledgerContent(), events: events() });
        for (const key of [T('token_iron_vein'), T('token_wild_hive')]) expect(withEvents.reachOf(key)).toEqual(without.reachOf(key));
    });
});

describe('the shipped content', () => {
    const book = encyclopedia();
    const from = (key, via) => waysIn(book, key).filter(w => w.from === via);

    it('Oak Wood: the Woodpile on the Guild Hall at ranks 1 to 3; Copper Ore, Stone and Coal likewise', () => {
        const pile = waysIn(book, I('item_oak_wood')).find(w => w.star === 'Woodpile');
        expect(pile).toMatchObject({ how: HOW.UPGRADE, from: T('token_guild_hall') });
        expect(pile.ranks.length).toBeGreaterThan(0);
        for (const id of ['item_copper_ore', 'item_stone', 'item_coal']) {
            expect(waysIn(book, I(id)).some(w => w.how === HOW.UPGRADE && w.from === T('token_guild_hall')), id).toBe(true);
        }
    });

    it('Water: the Wishing Well at every rank', () => {
        const well = waysIn(book, I('item_water')).find(w => w.star === 'Wishing Well');
        expect(well.ranks.map(r => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('Copper Ore from the Copper Comet, ×6; the Copper Comet from its special event', () => {
        expect(from(I('item_copper_ore'), T('token_copper_comet')).map(w => yieldText(w.yields))).toEqual(['×6']);
        expect(waysIn(book, T('token_copper_comet')).map(w => w.how)).toEqual([EVENT_WAY]);
    });

    it('Trout from the Fish Shoal: a catch, at its share of the pool a rod fishes on the Starter Camp\'s pond', () => {
        // Every catch pool of a water is a way in (the fixture world's Coast, above); a catch lands one fish, so no amount.
        const pond = poolForTool(getTokenType('token_fish_shoal'), 'fishing_rod', { water: 'fresh', biomes: ['meadow'] });
        const share = pond.catches.find(c => c.itemId === 'item_trout').weight / pond.catches.reduce((n, c) => n + c.weight, 0);
        expect(from(I('item_trout'), T('token_fish_shoal')).map(w => [yieldText(w.yields), w.chance, w.how])).toEqual([[null, share, HOW.CATCH]]);
    });

    it('Blackberries from the Berry Thicket, ×2 at 50 %', () => {
        expect(from(I('item_blackberry'), T('token_berry_thicket')).map(w => [yieldText(w.yields), w.chance])).toEqual([['×2', 0.5]]);
    });

    it('every new word and hover sentence is in the strings file', () => {
        for (const key of ['finds', 'held']) expect(typeof en.encyclopedia.line[key]).toBe('string');
        for (const key of ['rareFind', 'givesHall', 'catchWith', 'catchBait', 'held']) expect(en.encyclopedia.lineTip[key]).toMatch(/\{from\}.*\{to\}|\{to\}.*\{from\}/);
        for (const key of ['event', 'eventNamed', 'hallStar']) expect(typeof en.encyclopedia.via[key]).toBe('string');
    });
});

describe('on the page', () => {
    const metrics = { nodeW: 220, nodeH: 60, gapX: 310, reach: 48, stemH: 20, markH: 32, markIcon: 32, markText: 18, ink: 16, word: 14, wordLift: 4, wordPad: 6, wordStop: 16, rowGap: 8, orGap: 20, bandPad: 4, highEntry: 14 };
    const view = (book, key) => render(React.createElement(ChartView, {
        book, chart: chartOf(book, key), metrics, rect: { left: 0, top: 0, width: 1600, height: 900 },
        focusAt: 's', glide: null, got: null, heroes: [], startName: book.nameOf(key), onNode: () => {}, onStem: () => {}
    }));
    const box = (c, key) => c.querySelector(`[data-codex-key="${key}"][data-codex-side="in"]`);

    it('a source box reads its amount, then its odds: "×2 ·" "50% base"', () => {
        const book = encyclopedia();
        const { container } = view(book, I('item_blackberry'));
        const thicket = box(container, T('token_berry_thicket'));
        expect(thicket.querySelector('[data-codex-gives]').textContent).toBe('×2 ·');
        expect(thicket.querySelector('[data-codex-chance]').textContent).toBe('50% base');
    });

    it('a sure way reads its amount alone; the Guild Hall its star\'s ranks', () => {
        const book = encyclopedia();
        const { container } = view(book, I('item_copper_ore'));
        const comet = box(container, T('token_copper_comet'));
        expect(comet.querySelector('[data-codex-gives]').textContent).toBe('×6');
        expect(comet.querySelector('[data-codex-chance]')).toBeNull();
        const hall = box(container, T('token_guild_hall'));
        expect(hall.querySelector('[data-codex-gives]').textContent).toMatch(/^rank 1 ×\d+/);
        expect([...container.querySelectorAll('[data-codex-caption]')].map(c => c.textContent)).toContain('Copper Spring');
    });

    it('the held tool\'s word and the catch\'s hover sentence name the tool', () => {
        // The fixture world's Coast: the shipped fixed waters are retired, and spots come with the Fishing pack.
        const book = buildEncyclopedia(ledgerContent());
        const { container } = view(book, I('item_trout'));
        expect([...container.querySelectorAll('[data-codex-word="held"]')].length).toBeGreaterThan(0);
        expect(box(container, I('item_fishing_rod') ).querySelector('[data-codex-need]')).toBeNull();
    });
});
