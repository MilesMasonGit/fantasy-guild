import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import './fixtures/testTokens.js';
import shippedTokens from '../../data/tokens.json';
import shippedItems from '../../data/items.json';
import shippedEffects from '../../data/effects.json';
import { KEYWORD, KEYWORDS, makeStatement, statementsOf } from '../systems/effects/statements.js';
import { renderStatement, upkeepLine, rulesLinesOf } from '../systems/effects/statementText.js';
import { TRIGGER_EVENTS } from '../config/registries/triggerRegistry.js';
import { MODIFIER_PALETTE } from '../config/registries/modifierPalette.js';
import { REACHES } from '../config/registries/reachRegistry.js';
import { ROLES } from '../config/registries/roleRegistry.js';
import { FILTER_KINDS } from '../config/registries/filterRegistry.js';
import { MAGNITUDE_STATS } from '../config/registries/magnitudeRegistry.js';
import { PLACEMENTS } from '../config/registries/placementRegistry.js';
import { RESTRICTION_KINDS } from '../config/registries/restrictionPalette.js';
import { getAllStatusEffects } from '../config/registries/statusRegistry.js';
import { getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';

/**
 * ⭐ **Every rules sentence the game can print, pinned byte for byte** (Rules
 * Line P1).
 *
 * P1 teaches `renderStatement` to return *segments* — which word came from which
 * decision — so the editor can make those words clickable. That touches every
 * branch of a 700-line file which prints every rule in the game: the Token
 * inspector, the Guild Hall panel, the CMS, `description` fields.
 *
 * ⚠️ **A refactor that drops a comma changes rules text everywhere and nothing
 * else would fail.** That is why this file was written and its golden captured
 * BEFORE the refactor, from the renderer as it stood. The golden is the old
 * renderer's output; the test asserts the new one agrees with it exactly.
 *
 * ## Why a synthetic matrix, not just shipped content
 * Only 17 authored statements ship, all in `data/effects.json`. Seventeen
 * sentences cannot protect twenty functions. So the corpus is built by walking
 * the **registries themselves** — every palette axis at every bucket and sign,
 * every moment with and without its parameter, every reach against every target
 * mode, every filter plain and negated, every role, magnitude, placement,
 * restriction and status — plus everything shipped and every fixture.
 *
 * Walking the registries means a new axis or moment joins the corpus the day it
 * is added, rather than whenever somebody remembers.
 *
 * ## Regenerating
 * ONLY when a wording change is intended:
 *
 *     UPDATE_RENDER_GOLDEN=1 npx vitest run src/tests/RenderGolden.test.js
 *
 * and read the diff of `renderGolden.json` before committing it. The diff IS
 * the review of what every player will see change.
 */

const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'renderGolden.json');
const UPDATE = !!process.env.UPDATE_RENDER_GOLDEN;

/** Names from the shipped content, so sentences read the way the game reads. */
const shippedNames = {
    token: (id) => shippedTokens[id]?.name || getAllTokenTypes?.()?.[id]?.name || id,
    item: (id) => shippedItems[id]?.name || id,
    effect: (id) => shippedEffects[id]?.name || id
};

/** Something stable to name a Token, an item and an effect by in synthetic cases. */
const FIX = { token: 'fixture_producer', item: 'fixture_oak_wood', item2: 'item_raw_shrimp', effect: 'fixture_effect_thorns' };

function buildCorpus() {
    /** @type {Array<[string, () => string]>} */
    const cases = [];
    const add = (key, fn) => cases.push([key, fn]);
    const S = (kw, extra = {}) => ({ ...makeStatement(kw), ...extra });
    const R = (st, names) => () => renderStatement(st, names);

    // A library effect the Applies/Removes cases can name.
    registerEffects({
        [FIX.effect]: { id: FIX.effect, name: 'Thorns', statements: [{ ...makeStatement(KEYWORD.DEALS), id: 'stm_golden_thorns', payload: { amount: 1 } }] }
    });

    // ---- 1. Everything that ships ----------------------------------------
    for (const [id, entry] of Object.entries(shippedEffects)) {
        (entry.statements || []).forEach((st, i) => {
            add(`shipped:effect:${id}:${i}`, R(st, shippedNames));
            add(`shipped:effect:${id}:${i}:bare-names`, R(st));
            add(`shipped:effect:${id}:${i}:upkeep`, () => upkeepLine(st, shippedNames));
        });
    }
    for (const id of Object.keys(shippedTokens).sort()) {
        add(`shipped:token:${id}:rules`, () => JSON.stringify(rulesLinesOf(shippedTokens[id], shippedNames)));
    }
    for (const id of Object.keys(shippedItems).sort()) {
        add(`shipped:item:${id}:rules`, () => JSON.stringify(rulesLinesOf(shippedItems[id], shippedNames)));
    }

    // ---- 2. Every fixture Token -----------------------------------------
    const fixtures = getAllTokenTypes();
    for (const id of Object.keys(fixtures).filter(k => k.startsWith('fixture_')).sort()) {
        add(`fixture:token:${id}:rules`, () => JSON.stringify(rulesLinesOf(fixtures[id], shippedNames)));
    }

    // ---- 3. Every palette axis, every bucket, every sign ------------------
    for (const entry of MODIFIER_PALETTE) {
        for (const bucket of ['flat', 'percentage', 'multiplier', undefined]) {
            for (const value of [5, -5, 0.25, -0.25, 0, 1.5]) {
                const payload = { type: entry.type, bucket, value };
                add(`axis:${entry.type}:${bucket}:${value}`, R(S(KEYWORD.PROVIDES, { payload })));
            }
        }
        add(`axis:${entry.type}:category`, R(S(KEYWORD.PROVIDES, { payload: { type: entry.type, bucket: 'flat', value: 2, category: 'mining' } })));
        add(`axis:${entry.type}:category-unknown`, R(S(KEYWORD.PROVIDES, { payload: { type: entry.type, bucket: 'flat', value: 2, category: 'not_a_skill' } })));
        add(`axis:${entry.type}:item`, R(S(KEYWORD.PROVIDES, { payload: { type: entry.type, bucket: 'flat', value: 25, itemId: FIX.item2, quantity: 3 } }), shippedNames));
    }
    add('axis:unknown-type', R(S(KEYWORD.PROVIDES, { payload: { type: 'NOT_AN_AXIS', value: 3 } })));
    add('axis:no-payload', R(S(KEYWORD.PROVIDES, { payload: undefined })));
    for (const status of Object.keys(getAllStatusEffects() || {})) {
        add(`axis:STATUS_IMMUNITY:${status}`, R(S(KEYWORD.PROVIDES, { payload: { type: 'STATUS_IMMUNITY', bucket: 'flat', value: 1, category: status } })));
    }

    // ---- 4. Every reach against every target mode, for every filtered keyword
    const modes = [
        undefined, { mode: 'all' }, { mode: 'tag', value: 'Coast' }, { mode: 'tag', value: '' },
        { mode: 'id', value: FIX.token }, { mode: 'id', value: '' },
        { mode: 'tokenType', value: 'resource' }, { mode: 'tokenType', value: '' },
        { mode: 'wharrgarbl', value: 'x' }
    ];
    const reachIds = [undefined, ...REACHES.map(r => r.id)];
    const filtered = {
        provides: () => S(KEYWORD.PROVIDES, { payload: { type: 'YIELD', bucket: 'percentage', value: 0.25 } }),
        providesReads: () => S(KEYWORD.PROVIDES, { payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.2 } }),
        grants: () => S(KEYWORD.GRANTS, { payload: { itemId: FIX.item, quantity: 2, chance: 40 } }),
        appliesEffect: () => S(KEYWORD.APPLIES, { payload: { effectId: FIX.effect, durationMs: 30000, chance: 50 } }),
        converts: () => S(KEYWORD.CONVERTS, { payload: { consumes: [{ itemId: FIX.item, quantity: 2 }], produces: [{ itemId: FIX.item2, quantity: 1 }] } }),
        cannot: () => S(KEYWORD.CANNOT, { payload: { kind: RESTRICTION_KINDS[0]?.id, max: 2 } })
    };
    for (const [name, make] of Object.entries(filtered)) {
        for (const reach of reachIds) {
            for (const to of modes) {
                const st = { ...make(), reach, to };
                add(`target:${name}:${reach}:${JSON.stringify(to)}`, R(st, shippedNames));
            }
        }
        for (const kind of FILTER_KINDS) {
            for (const not of [false, true]) {
                const value = kind.id === 'charges_below' ? 3 : kind.id === 'tagged' ? 'Wet' : FIX.effect;
                const st = { ...make(), to: { mode: 'tag', value: 'Coast', filters: [{ kind: kind.id, value, not }] } };
                add(`filter:${name}:${kind.id}:${not}`, R(st, shippedNames));
            }
        }
        const stacked = { ...make(), reach: 'board', to: { mode: 'all', filters: [{ kind: 'tagged', value: 'Wet' }, { kind: 'worked', not: true }] } };
        add(`filter:${name}:stacked`, R(stacked, shippedNames));
    }

    // ---- 5. Every moment, with and without its parameter and a cooldown ----
    for (const t of TRIGGER_EVENTS) {
        for (const scope of t.scopes) {
            for (const extra of [{}, { cooldownMs: 5000 }, { watchItemId: FIX.item, threshold: 7 }, { watchItemId: '', threshold: 0 }]) {
                const when = { event: t.id, scope, ...extra };
                add(`moment:${t.id}:${scope}:${JSON.stringify(extra)}`, R(S(KEYWORD.DEALS, { payload: { amount: 1 }, when }), shippedNames));
                add(`moment:${t.id}:${scope}:${JSON.stringify(extra)}:grants`, R(S(KEYWORD.GRANTS, { payload: { itemId: FIX.item, quantity: 1 }, when }), shippedNames));
            }
        }
    }
    add('moment:unknown-event', R(S(KEYWORD.DEALS, { payload: { amount: 1 }, when: { event: 'NOT_A_MOMENT', scope: 'self' } })));
    add('moment:cooldown-odd', R(S(KEYWORD.DEALS, { payload: { amount: 1 }, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 12345 } })));

    // ---- 6. Roles, magnitudes, and the action verbs ------------------------
    for (const role of [undefined, 'nonsense', ...ROLES.map(r => r.id)]) {
        const target = role === undefined ? undefined : { role };
        add(`role:deals:${role}`, R(S(KEYWORD.DEALS, { payload: { amount: 3 }, target })));
        add(`role:deals-pierce:${role}`, R(S(KEYWORD.DEALS, { payload: { amount: 3, ignoresArmor: true }, target })));
        add(`role:heals:${role}`, R(S(KEYWORD.HEALS, { payload: { amount: 4 }, target })));
        add(`role:restores:${role}`, R(S(KEYWORD.RESTORES, { payload: { amount: 1 }, target })));
        add(`role:restores-many:${role}`, R(S(KEYWORD.RESTORES, { payload: { amount: 3 }, target })));
        add(`role:removes:${role}`, R(S(KEYWORD.REMOVES, { payload: { effectId: FIX.effect }, target }), { effect: () => 'Thorns' }));
        add(`role:removes-all:${role}`, R(S(KEYWORD.REMOVES, { payload: {}, target })));
    }
    for (const amount of [0, -2, 2.5, 'x', undefined]) {
        add(`deals:amount:${amount}`, R(S(KEYWORD.DEALS, { payload: { amount } })));
        add(`heals:amount:${amount}`, R(S(KEYWORD.HEALS, { payload: { amount } })));
    }
    for (const stat of [...MAGNITUDE_STATS.map(s => s.id), 'not_a_stat', undefined]) {
        add(`magnitude:stat:${stat}:deals`, R(S(KEYWORD.DEALS, { payload: { amount: 10, magnitude: 'stat', stat } })));
        add(`magnitude:stat:${stat}:heals`, R(S(KEYWORD.HEALS, { payload: { amount: 10, magnitude: 'stat', stat } })));
    }
    for (const counted of [undefined, { mode: 'all' }, { mode: 'all', reach: 'board' }, { mode: 'all', reach: 'self' },
        { mode: 'tag', value: 'Coast' }, { mode: 'tag', value: '' }, { mode: 'id', value: FIX.token }, { mode: 'id', value: '' },
        { mode: 'tag', value: 'Coast', filters: [{ kind: 'worked', not: true }] }]) {
        add(`magnitude:count:${JSON.stringify(counted)}`, R(S(KEYWORD.DEALS, { payload: { amount: 2, magnitude: 'count' }, counted }), shippedNames));
    }
    add('magnitude:flat-explicit', R(S(KEYWORD.DEALS, { payload: { amount: 7, magnitude: 'flat' } })));

    for (const placement of [undefined, 'nonsense', ...PLACEMENTS.map(p => p.id)]) {
        add(`spawns:${placement}`, R(S(KEYWORD.SPAWNS, { payload: { typeId: FIX.token, placement } }), shippedNames));
    }
    add('spawns:blank', R(S(KEYWORD.SPAWNS, { payload: {} })));
    add('transforms', R(S(KEYWORD.TRANSFORMS, { payload: { typeId: FIX.token } }), shippedNames));
    add('transforms:blank', R(S(KEYWORD.TRANSFORMS, { payload: {} })));

    // ---- 7. Applies, in every shape it has ---------------------------------
    for (const statusId of [...Object.keys(getAllStatusEffects() || {}), 'not_a_status']) {
        for (const stacks of [1, 3]) {
            for (const target of [undefined, 'enemy', 'hero']) {
                for (const chance of [100, 25]) {
                    const st = S(KEYWORD.APPLIES, { payload: { statusId, stacks, target, chance } });
                    add(`applies:status:${statusId}:${stacks}:${target}:${chance}`, R(st));
                    add(`applies:status:${statusId}:${stacks}:${target}:${chance}:triggered`,
                        R({ ...st, when: { event: 'CYCLE_COMPLETE', scope: 'adjacent' } }));
                }
            }
        }
    }
    for (const durationMs of [0, 1500, 30000, undefined]) {
        for (const chance of [100, 40, undefined]) {
            add(`applies:effect:${durationMs}:${chance}`, R(S(KEYWORD.APPLIES, { payload: { effectId: FIX.effect, scale: 2, durationMs, chance } }), { effect: () => 'Thorns' }));
        }
    }
    add('applies:effect:no-names', R(S(KEYWORD.APPLIES, { payload: { effectId: FIX.effect } })));

    // ---- 8. The station-shaped keywords, filled and blank ------------------
    add('station', R(S(KEYWORD.STATION, { payload: { skill: 'cooking' } })));
    add('station:unknown-skill', R(S(KEYWORD.STATION, { payload: { skill: 'not_a_skill' } })));
    add('station:blank', R(S(KEYWORD.STATION, { payload: {} })));
    add('acts-as', R(S(KEYWORD.ACTS_AS, { payload: { tag: 'net', tier: 2 } })));
    add('acts-as:no-tier', R(S(KEYWORD.ACTS_AS, { payload: { tag: 'net' } })));
    add('acts-as:blank', R(S(KEYWORD.ACTS_AS, { payload: {} })));
    add('requires:tokens', R(S(KEYWORD.REQUIRES, { payload: { tokenIds: [FIX.token, 'fixture_seafood_producer'] } }), shippedNames));
    add('requires:tag', R(S(KEYWORD.REQUIRES, { payload: { tag: 'net', minTier: 3 } })));
    add('requires:tag-no-tier', R(S(KEYWORD.REQUIRES, { payload: { tag: 'net' } })));
    add('requires:blank', R(S(KEYWORD.REQUIRES, { payload: {} })));
    add('restocks', R(S(KEYWORD.RESTOCKS, { payload: { tokenIds: [FIX.token, 'fixture_seafood_producer'] } }), shippedNames));
    add('restocks:blank', R(S(KEYWORD.RESTOCKS, { payload: {} })));
    add('converts:blank', R(S(KEYWORD.CONVERTS, { payload: {} })));
    add('converts:multi', R(S(KEYWORD.CONVERTS, { payload: {
        consumes: [{ itemId: FIX.item, quantity: 2 }, { itemId: FIX.item2 }],
        produces: [{ itemId: FIX.item2, quantity: 0 }]
    } }), shippedNames));
    for (const kind of [...RESTRICTION_KINDS.map(k => k.id), 'not_a_kind']) {
        for (const max of [0, 1, 4]) {
            add(`cannot:${kind}:${max}`, R(S(KEYWORD.CANNOT, { payload: { kind, max }, to: { mode: 'tag', value: 'Coast' } })));
        }
    }
    for (const kw of KEYWORDS.map(k => k.id)) {
        add(`keyword:${kw}:made-blank`, R(makeStatement(kw)));
    }
    add('keyword:unknown', R({ keyword: 'not_a_keyword', payload: {} }));
    add('keyword:missing', R({}));

    // ---- 9. Upkeep, as its own line ---------------------------------------
    for (const upkeep of [undefined, { items: [] }, { items: [{ itemId: FIX.item, quantity: 1 }], cadenceMs: 30000 },
        { items: [{ itemId: FIX.item }, { itemId: FIX.item2, quantity: 3 }], cadenceMs: 12345 },
        { items: [{ itemId: FIX.item, quantity: 2 }] }]) {
        add(`upkeep:${JSON.stringify(upkeep)}`, () => upkeepLine(S(KEYWORD.PROVIDES, { upkeep }), shippedNames));
    }

    // ---- 10. A whole Token with requirements, statements and upkeep --------
    add('rules:composite', () => JSON.stringify(rulesLinesOf({
        acceptedTokens: [{ tag: 'net', minTier: 2 }, { tokenIds: [FIX.token] }],
        statements: [
            { ...S(KEYWORD.PROVIDES, { payload: { type: 'YIELD', bucket: 'percentage', value: 0.1 } }), upkeep: { items: [{ itemId: FIX.item, quantity: 1 }], cadenceMs: 30000 } },
            S(KEYWORD.DEALS, { payload: { amount: 2 }, when: { event: 'CYCLE_COMPLETE', scope: 'adjacent', cooldownMs: 4000 } })
        ]
    }, shippedNames)));

    return cases;
}

/** Render the whole corpus. A throw is part of the behaviour, so it is pinned too. */
function renderCorpus() {
    const out = {};
    for (const [key, fn] of buildCorpus()) {
        if (key in out) throw new Error(`duplicate golden key: ${key}`);
        try {
            out[key] = fn();
        } catch (err) {
            out[key] = `THROWS: ${err?.message || err}`;
        }
    }
    return out;
}

describe('⭐ rules text is byte-identical to the renderer before P1', () => {
    const actual = renderCorpus();

    if (UPDATE) {
        it('writes a new golden (UPDATE_RENDER_GOLDEN is set)', () => {
            const sorted = Object.fromEntries(Object.keys(actual).sort().map(k => [k, actual[k]]));
            fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
            expect(Object.keys(sorted).length).toBeGreaterThan(0);
        });
        return;
    }

    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));

    it('covers a corpus large enough to mean something', () => {
        expect(Object.keys(golden).length).toBeGreaterThan(500);
    });

    it('⚠️ has exactly the same cases as the golden — none added, none lost', () => {
        // A case silently dropping out of the corpus is a sentence that stopped
        // being protected, which is how a guarantee rots without failing.
        expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
    });

    it('⭐ renders every case exactly as the golden says', () => {
        const drift = Object.keys(golden)
            .filter(k => actual[k] !== golden[k])
            .map(k => `${k}\n    was: ${golden[k]}\n    now: ${actual[k]}`);
        expect(drift, `${drift.length} sentence(s) changed:\n${drift.slice(0, 15).join('\n')}`).toEqual([]);
    });
});
