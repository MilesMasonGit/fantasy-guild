import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { PROFILE } from '../../cms/src/engine/ledger/profiles.js';
import { contentOf, workspaceLedger } from '../../cms/src/engine/ledgerReport.js';
import { workspaceFromDataFiles } from '../../cms/src/engine/changePacks.js';
import { paceContent, potionWebContent } from './fixtures/paceWorld.js';

/**
 * The ledger report's speed: the pace weighs hundreds of thousands of setups, so a setup it only
 * weighs is rated for its numbers alone (`numbersOf`), and the parts of a rate many setups share
 * (the hero's rules, the Token's tile, the guild-wide scope, each one's share of an axis) are worked
 * out once. Each must give exactly what the whole rate, worked out afresh, gives: the report is the
 * same to the last digit. Counts, not times, so a busy machine cannot fail them.
 */

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const load = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const loadIf = (name, fallback) => (fs.existsSync(path.join(DATA, name)) ? load(name) : fallback);

/** The shipped content as the ledger report reads it, its world and events included. */
function shippedWorkspace() {
    return workspaceFromDataFiles({
        items: load('items.json'), tokens: load('tokens.json'), effects: loadIf('effects.json', {}),
        tokenRecipes: loadIf('tokenRecipes.json', []), starterCamp: loadIf('starterCamp.json', null),
        skillPerks: loadIf('skillPerks.json', null), hallStars: loadIf('hallStars.json', null),
        world: loadIf('world.json', null), events: loadIf('events.json', null)
    });
}

/** Every number told apart, NaN, the infinities and -0 too. */
const exact = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0)) ? `#${Object.is(x, -0) ? '-0' : x}` : x));

const numbersOfRate = (r) => (r.ok === false && !('items' in r) ? r : { ok: r.ok, cyclesPerHour: r.cyclesPerHour, items: r.items, inputs: r.inputs, boostInputs: r.boostInputs, xp: r.xp });

/**
 * Setups each work is weighed in: the bare one, each boost on offer on its own, all of them at once,
 * and the bare one at a level well past the work's gate (its milestone perks).
 */
function setupsOf(pace, work, cap) {
    const ctx = pace.profiles.contextOf(work.target);
    const bare = pace.profiles.bareSetup(ctx, cap);
    const offers = pace.profiles.offers(ctx, cap);
    const out = [bare, ...offers.map(o => o.apply(bare))];
    if (offers.length > 1) out.push(offers.reduce((s, o) => o.apply(s), bare));
    out.push(pace.profiles.bareSetup(ctx, cap, (ctx.gate ?? 1) + 20));
    return out;
}

describe('a rate weighed for its numbers alone', () => {
    it('gives every work of the shipped content exactly the numbers its whole rate has, in every setup', () => {
        const ws = shippedWorkspace();
        const pace = buildPace(contentOf(ws), workspaceLedger(ws), ws.planSettings);
        let checked = 0;
        for (const work of pace.works) {
            if (work.tier === null) continue;
            for (const setup of setupsOf(pace, work, pace.maxTier)) {
                const numbers = pace.book.numbersOf(work.target, setup);
                expect([work.key, exact(numbers)]).toEqual([work.key, exact(numbersOfRate(pace.book.rateOf(work.target, setup)))]);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(1000);
    }, 60000);
});

describe('the parts of a rate kept for the setups that share them', () => {
    it('rate every setup as a rate book worked out afresh for it does', () => {
        const ws = shippedWorkspace();
        const content = contentOf(ws);
        const pace = buildPace(content, workspaceLedger(ws), ws.planSettings);
        const shared = buildRateBook(content);
        // The works with the most on offer, where setups share the most parts: a fresh book for each setup.
        const works = pace.works.filter(w => w.tier !== null)
            .map(w => ({ w, n: pace.profiles.offers(pace.profiles.contextOf(w.target), pace.maxTier).length }))
            .sort((a, b) => b.n - a.n || a.w.key.localeCompare(b.w.key)).slice(0, 12).map(x => x.w);
        let checked = 0;
        for (const work of works) {
            for (const setup of setupsOf(pace, work, pace.maxTier)) {
                const kept = shared.rateOf(work.target, setup);
                expect([work.key, exact(kept)]).toEqual([work.key, exact(buildRateBook(content).rateOf(work.target, setup))]);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(100);
    }, 60000);

    it('keep each scope\'s share of an axis apart for every narrowing it is asked', () => {
        const c = paceContent();
        c.items.item_stone = { id: 'item_stone', name: 'Stone', type: 'material' };
        c.tokens.token_vein.config.outputs.push({ itemId: 'item_stone', chance: 100, minQty: 1, maxQty: 1 });
        const book = buildRateBook(c);
        // One guild-wide rule narrowed to Mining, the same scope for both works: the vein first, then the oak.
        const guild = [{ type: 'YIELD', bucket: 'percentage', value: 0.5, target: { category: 'mining' }, source: 'test:mining-yield' }];
        const vein = book.rateOf({ token: 'token_vein' }, { guild });
        const oak = book.rateOf({ token: 'token_oak' }, { guild });
        expect(exact(oak.items)).toBe(exact(buildRateBook(c).rateOf({ token: 'token_oak' }, {}).items));
        expect(vein.items.item_copper_ore).toBeGreaterThan(buildRateBook(c).rateOf({ token: 'token_vein' }, {}).items.item_copper_ore);
        // The Mine's double drop is narrowed to Copper Ore: the Stone beside it lands as it did.
        const mined = book.rateOf({ token: 'token_vein' }, { supports: ['token_mine'] });
        const bare = book.rateOf({ token: 'token_vein' }, {});
        expect(mined.items.item_copper_ore).toBeCloseTo(bare.items.item_copper_ore * 1.25);
        expect(mined.items.item_stone).toBe(bare.items.item_stone);
    });

    it('works out one hero for setups that differ only in what stands beside the work', () => {
        const book = buildRateBook(paceContent());
        const target = { token: 'token_vein' };
        for (const supports of [[], ['token_mine'], ['token_statue'], ['token_mine', 'token_statue']]) book.rateOf(target, { supports });
        expect(book.parts.hero.size).toBe(1);
        expect(book.parts.tile.size).toBe(4);
    });
});

describe('the profiles weigh setups by their numbers', () => {
    it('rate in full only the setups they keep', () => {
        const c = potionWebContent(14);
        const book = buildRateBook(c);
        let full = 0;
        let numbers = 0;
        const counted = {
            ...book,
            rateOf: (t, s) => { full++; return book.rateOf(t, s); },
            numbersOf: (t, s) => { numbers++; return book.numbersOf(t, s); }
        };
        const pace = buildPace(c, buildLedger(c), null, { book: counted });
        // Maxed at one bush reads the herbs' supply it needs: each work weighs every potion at Typical and
        // again at Maxed, and keeps one setup a profile (a hero holding one dose: today 332 weighed against
        // 183 kept; weighed in full, none would be weighed by its numbers).
        pace.rateAt({ token: 'token_bush_0' }, PROFILE.MAXED);
        expect(numbers).toBeGreaterThan(1.5 * full);
    });
});
