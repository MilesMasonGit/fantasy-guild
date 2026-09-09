import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, getKeyword, makeStatement } from '../systems/effects/statements.js';
import { rulesLinesOf } from '../systems/effects/statementText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **A firing rule lands where its sentence says it lands** (Effects Robustness P1).
 *
 * ## The bug this pins
 * `Grants` declares `filter: true`, so the editor let an author write *"when a
 * neighbour completes a cycle, grant 1 Copper to any adjacent Forge"* and
 * generated exactly that sentence. `TriggerSystem` then dropped the item on the
 * Token that fired, reading the filter never.
 *
 * It survived the whole of Unified Effects for a reason worth recording: the
 * **ambient** path has honoured filters since the grammar shipped
 * (`applicableStatements` matches every one), and no shipped content has ever
 * used a *triggered* `Grants` — all three authored `Grants` statements are
 * ambient. So the only code path carrying the bug was the only one nothing
 * exercised.
 *
 * ## What "honest" means is not the same for both keywords
 * * `Grants` **broadcasts** — a bonus to each named neighbour is four bonuses,
 *   which is what the sentence says and what the author priced.
 * * `Converts` picks **one destination** (ER-14) — it is an exchange with a
 *   fixed input, so producing onto every match would multiply the output while
 *   the Bank paid once.
 *
 * A filter matching nothing reaches nothing in both cases. Falling back to the
 * firing tile would make an unmatched filter silently universal, which is the
 * failure `matchesTokenTarget` already refuses for unknown modes.
 *
 * ## ⚠️ Why these assert on `addSprite` rather than on the board
 * A sprite does not remember which tile it came from — `addSprite` scatters it
 * 1–2 tiles away and **merges it into any nearby stack of the same item**. So
 * "how many Charcoal are lying on tile 16" is not a question the board can
 * answer, and two grants to two neighbours may well end up as one stack.
 *
 * The tile a grant was *addressed to* is the actual contract here, and it is the
 * argument `TriggerSystem` passes. Spying on it asserts the thing under test
 * instead of a rendering side effect downstream of it.
 */

// 15 and 16 are adjacent; 33 is not adjacent to either.
const SOURCE = 15, NEIGHBOUR = 16, FAR = 33;

/** Which tiles a given item was addressed to, in call order. */
function addressedTiles(spy, itemId) {
    return spy.mock.calls
        .filter(([kind, refId]) => kind === 'item' && refId === itemId)
        .map(([, , , sourceTile]) => sourceTile);
}

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** A triggered `Grants` aimed however the caller says. */
function grantTokenAimedAt(id, to) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'buff', rarity: 'rare', theme: 'fixture',
            uses: null, sprite: 'skill_industry',
            statements: [{
                id: `stm_${id}`, keyword: 'grants', to,
                when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
                payload: { type: 'BONUS_DROP', itemId: 'fixture_charcoal', chance: 100, quantity: 1 }
            }]
        }
    });
    return id;
}

/** A triggered `Converts` whose output is aimed however the caller says. */
function sigilAimedAt(id, to) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'buff', rarity: 'mythic', theme: 'fixture',
            uses: null, sprite: 'skill_occult',
            statements: [{
                id: `stm_${id}`, keyword: 'converts', to,
                when: {
                    event: 'ITEM_THRESHOLD', scope: 'global',
                    watchItemId: 'item_coal', threshold: 2, cooldownMs: 10000
                },
                payload: {
                    type: 'CONVERT',
                    consumes: [{ itemId: 'item_coal', quantity: 2 }],
                    produces: [{ itemId: 'fixture_charcoal', quantity: 1 }],
                    chance: 100
                }
            }]
        }
    });
    return id;
}

let addSprite;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    addSprite = vi.spyOn(SpriteLayer, 'addSprite');
});

afterEach(() => {
    TriggerSystem.teardown();
    addSprite.mockRestore();
});

describe('a triggered Grants reaches the neighbour its filter names', () => {
    it('addresses the NAMED neighbour, not the Token that fired', () => {
        // The producer at SOURCE completes a cycle; the granting Token beside it
        // is aimed at the producer by id, so the grant must go to SOURCE.
        grantTokenAimedAt('fixture_grant_at_producer', { mode: 'id', value: 'fixture_producer' });

        place(SOURCE, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_grant_at_producer');

        run(13000);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([SOURCE]);
    });

    it('grants NOTHING when the filter names something that is not there', () => {
        // ⚠️ The regression that matters most. Before P1 this dropped an item on
        // the firing tile — an unmatched filter behaved as though it had matched.
        grantTokenAimedAt('fixture_grant_at_absent', { mode: 'id', value: 'fixture_gated' });

        place(SOURCE, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_grant_at_absent');

        run(13000);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([]);
    });

    it('still spends the charge, because the charge burns on SERVICE (CMS-26)', () => {
        // A rule whose filter matched nothing has still served the event. The
        // wear rule is about the firing, not about whether anything landed —
        // the same reason a 0%-chance proc still costs a charge.
        registerTokenTypes({
            fixture_grant_wearing_unmatched: {
                id: 'fixture_grant_wearing_unmatched', name: 'Wearing Unmatched',
                tokenType: 'buff', rarity: 'rare', theme: 'fixture',
                uses: 3, sprite: 'skill_industry',
                statements: [{
                    id: 'stm_wearing_unmatched', keyword: 'grants',
                    to: { mode: 'id', value: 'fixture_gated' },
                    when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 0 },
                    payload: { type: 'BONUS_DROP', itemId: 'fixture_charcoal', chance: 100, quantity: 1 }
                }]
            }
        });

        place(SOURCE, 'fixture_producer', 'hero_1');
        const granter = place(NEIGHBOUR, 'fixture_grant_wearing_unmatched');

        run(13000);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([]);
        expect(granter.usesRemaining).toBe(2);
    });

    it('reaches every match when the filter is "all"', () => {
        // "To every adjacent Token" means all of them, which is what the
        // sentence says — and what the ambient path has always done.
        grantTokenAimedAt('fixture_grant_at_all', { mode: 'all', value: '' });

        place(NEIGHBOUR, 'fixture_grant_at_all');
        place(SOURCE, 'fixture_producer', 'hero_1');
        place(17, 'fixture_passive');
        place(23, 'fixture_passive');

        run(13000);

        // Every occupied neighbour of the granter, and never the granter itself.
        const addressed = addressedTiles(addSprite, 'fixture_charcoal');
        expect(new Set(addressed)).toEqual(new Set([SOURCE, 17, 23]));
        expect(addressed).not.toContain(NEIGHBOUR);
    });

    it('a rule carrying NO filter still lands on the Token that fired', () => {
        // The unfiltered case is what every authored rule relies on, so it must
        // not have moved. `to: null` is what `makeStatement` produces for a
        // keyword that cannot aim, and what a hand-authored fixture omits.
        grantTokenAimedAt('fixture_grant_unfiltered', null);

        place(SOURCE, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_grant_unfiltered');

        run(13000);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([NEIGHBOUR]);
    });

    it('does not reach a matching Token that is not adjacent', () => {
        grantTokenAimedAt('fixture_grant_far', { mode: 'id', value: 'fixture_passive' });

        place(SOURCE, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_grant_far');
        place(FAR, 'fixture_passive');

        run(13000);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([]);
    });
});

describe('Converts aims at ONE destination (ER-14)', () => {
    it('produces onto the named neighbour rather than onto itself', () => {
        sigilAimedAt('fixture_sigil_at_passive', { mode: 'id', value: 'fixture_passive' });

        place(SOURCE, 'fixture_sigil_at_passive');
        place(NEIGHBOUR, 'fixture_passive');
        // No `run()` — the Sigil does not cycle. Adding stock is the event.
        InventoryManager.addItem('item_coal', 2);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([NEIGHBOUR]);
    });

    it('produces ONCE even when several neighbours match', () => {
        // ⚠️ The rule that keeps the exchange honest. A conversion consumes a
        // fixed input; broadcasting the output would be free money, which is the
        // trap UE-7 names for scale, arriving here through the filter instead.
        sigilAimedAt('fixture_sigil_at_all', { mode: 'tag', value: 'seafood' });

        place(SOURCE, 'fixture_sigil_at_all');
        place(NEIGHBOUR, 'fixture_seafood_producer');
        place(14, 'fixture_seafood_producer');
        place(22, 'fixture_seafood_producer');
        InventoryManager.addItem('item_coal', 2);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toHaveLength(1);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });

    it('picks the lowest-indexed match, so the destination is deterministic', () => {
        sigilAimedAt('fixture_sigil_deterministic', { mode: 'tag', value: 'seafood' });

        place(SOURCE, 'fixture_sigil_deterministic');
        place(22, 'fixture_seafood_producer');
        place(14, 'fixture_seafood_producer');   // lower index, placed second
        InventoryManager.addItem('item_coal', 2);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([14]);
    });

    it('⚠️ the EDITOR DEFAULT produces on its own tile, not on a neighbour', () => {
        /**
         * The shape `makeStatement` actually produces: `to: { mode: 'all' }`.
         *
         * This was the live bug. `all` is truthy, so the runtime went looking
         * for a neighbour and put the output on whichever Token sat at the
         * lowest adjacent index — while the sentence named no destination and
         * the CMS hint said the output "lands on this Token itself". Every
         * conversion authored after the sentence editor landed was affected.
         *
         * The renderer and the editor were both right; the runtime was the half
         * that lied.
         */
        sigilAimedAt('fixture_sigil_default', { mode: 'all', value: '' });

        place(SOURCE, 'fixture_sigil_default');
        place(NEIGHBOUR, 'fixture_passive');
        place(14, 'fixture_passive');
        InventoryManager.addItem('item_coal', 2);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([SOURCE]);
    });

    it('spends the inputs but produces nothing when the filter matches nothing', () => {
        sigilAimedAt('fixture_sigil_at_absent', { mode: 'id', value: 'fixture_gated' });

        place(SOURCE, 'fixture_sigil_at_absent');
        place(NEIGHBOUR, 'fixture_passive');
        InventoryManager.addItem('item_coal', 2);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([]);
        // The exchange is all-or-nothing on the INPUT side only: the coal was
        // affordable and was spent, exactly as a failed cycle still costs its
        // inputs. Producing nothing is the filter's answer, not a refund.
        expect(InventoryManager.getItemCount('item_coal')).toBe(0);
    });

    it('an unfiltered conversion still produces on its own tile (D-40)', () => {
        place(SOURCE, 'fixture_sigil');
        place(NEIGHBOUR, 'fixture_passive');
        InventoryManager.addItem('item_coal', 2);

        expect(addressedTiles(addSprite, 'fixture_charcoal')).toEqual([SOURCE]);
    });
});

describe('the grammar and the sentence agree', () => {
    it('Converts declares a filter now, and the four that cannot aim still do not', () => {
        expect(getKeyword(KEYWORD.CONVERTS).filter).toBe(true);
        for (const id of [KEYWORD.ACTS_AS, KEYWORD.REQUIRES, KEYWORD.RESTOCKS, KEYWORD.STATION]) {
            expect(getKeyword(id).filter).toBe(false);
        }
    });

    it('a new Converts statement is born with a filter it can use', () => {
        const statement = makeStatement(KEYWORD.CONVERTS);
        expect(statement.to).toEqual({ mode: 'all', value: '' });
    });

    it('says where the output goes, in the singular', () => {
        const statement = {
            ...makeStatement(KEYWORD.CONVERTS),
            to: { mode: 'tag', value: 'Coast' },
            payload: {
                type: 'CONVERT',
                consumes: [{ itemId: 'item_coal', quantity: 2 }],
                produces: [{ itemId: 'item_bones', quantity: 1 }],
                chance: 100
            }
        };
        const [line] = rulesLinesOf({ statements: [statement] });

        expect(line).toContain('onto the nearest adjacent Coast Token');
        // ⚠️ Never the plural broadcast phrasing the other keywords use — the
        // runtime picks one destination and the sentence must not promise more.
        expect(line).not.toContain('every adjacent Token');
    });

    it('says nothing about a destination when there is no filter', () => {
        const statement = {
            ...makeStatement(KEYWORD.CONVERTS),
            payload: {
                type: 'CONVERT',
                consumes: [{ itemId: 'item_coal', quantity: 2 }],
                produces: [{ itemId: 'item_bones', quantity: 1 }],
                chance: 100
            }
        };
        const [line] = rulesLinesOf({ statements: [statement] });

        expect(line).not.toContain('onto the nearest');
    });
});
