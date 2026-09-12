import shippedTokens from '../../../data/tokens.json';
import shippedItems from '../../../data/items.json';
import shippedEffects from '../../../data/effects.json';
import { KEYWORD, KEYWORDS, makeStatement } from '../../systems/effects/statements.js';
import { renderStatement, upkeepLine, rulesLinesOf } from '../../systems/effects/statementText.js';
import { TRIGGER_EVENTS } from '../../config/registries/triggerRegistry.js';
import { MODIFIER_PALETTE } from '../../config/registries/modifierPalette.js';
import { REACHES } from '../../config/registries/reachRegistry.js';
import { ROLES } from '../../config/registries/roleRegistry.js';
import { FILTER_KINDS } from '../../config/registries/filterRegistry.js';
import { MAGNITUDE_STATS } from '../../config/registries/magnitudeRegistry.js';
import { PLACEMENTS } from '../../config/registries/placementRegistry.js';
import { RESTRICTION_KINDS } from '../../config/registries/restrictionPalette.js';
import { getAllStatusEffects } from '../../config/registries/statusRegistry.js';
import { getAllTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';

/**
 * ⭐ **Every rules sentence the game can print, as a list of cases** (Rules Line
 * P1).
 *
 * Shared by two tests that ask two different questions of the same corpus:
 *
 * * `RenderGolden` — is the TEXT byte-identical to the renderer before P1?
 * * `RenderSegments` — does every clickable word point at a slot the editor
 *   actually has?
 *
 * One list, so the two can never be protecting different sentences.
 *
 * Only 17 authored statements ship, and seventeen sentences cannot protect a
 * twenty-function renderer. So the corpus walks the **registries themselves** —
 * every palette axis at every bucket and sign, every moment with and without its
 * parameter, every reach against every target mode, every filter plain and
 * negated, every role, magnitude, placement, restriction and status — plus
 * everything shipped and every fixture. A new axis or moment joins the day it is
 * added.
 *
 * ⚠️ **Case keys are load-bearing.** The committed golden is keyed by them, so
 * renaming one is indistinguishable from a sentence disappearing.
 *
 * @returns {Array<{key: string, render: () => string, statement?: object, names?: object}>}
 *   `statement` is present for every case that renders ONE statement, which is
 *   what the segment test walks. Whole-Token and upkeep cases carry only `render`.
 */

/** Names from the shipped content, so sentences read the way the game reads. */
export const shippedNames = {
    token: (id) => shippedTokens[id]?.name || getAllTokenTypes?.()?.[id]?.name || id,
    item: (id) => shippedItems[id]?.name || id,
    effect: (id) => shippedEffects[id]?.name || id
};

/** Something stable to name a Token, an item and an effect by in synthetic cases. */
const FIX = { token: 'fixture_producer', item: 'fixture_oak_wood', item2: 'item_raw_shrimp', effect: 'fixture_effect_thorns' };

export function buildCorpus() {
    const cases = [];
    /** A case with no single statement behind it — a whole Token, an upkeep line. */
    const add = (key, render) => cases.push({ key, render });
    /** A case rendering exactly one statement. */
    const addS = (key, statement, names) =>
        cases.push({ key, statement, names, render: () => renderStatement(statement, names) });
    const S = (kw, extra = {}) => ({ ...makeStatement(kw), ...extra });

    // A library effect the Applies/Removes cases can name.
    registerEffects({
        [FIX.effect]: { id: FIX.effect, name: 'Thorns', statements: [{ ...makeStatement(KEYWORD.DEALS), id: 'stm_golden_thorns', payload: { amount: 1 } }] }
    });

    // ---- 1. Everything that ships ----------------------------------------
    for (const [id, entry] of Object.entries(shippedEffects)) {
        (entry.statements || []).forEach((st, i) => {
            addS(`shipped:effect:${id}:${i}`, st, shippedNames);
            addS(`shipped:effect:${id}:${i}:bare-names`, st);
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
                addS(`axis:${entry.type}:${bucket}:${value}`, S(KEYWORD.PROVIDES, { payload }));
            }
        }
        addS(`axis:${entry.type}:category`, S(KEYWORD.PROVIDES, { payload: { type: entry.type, bucket: 'flat', value: 2, category: 'mining' } }));
        addS(`axis:${entry.type}:category-unknown`, S(KEYWORD.PROVIDES, { payload: { type: entry.type, bucket: 'flat', value: 2, category: 'not_a_skill' } }));
        addS(`axis:${entry.type}:item`, S(KEYWORD.PROVIDES, { payload: { type: entry.type, bucket: 'flat', value: 25, itemId: FIX.item2, quantity: 3 } }), shippedNames);
    }
    addS('axis:unknown-type', S(KEYWORD.PROVIDES, { payload: { type: 'NOT_AN_AXIS', value: 3 } }));
    addS('axis:no-payload', S(KEYWORD.PROVIDES, { payload: undefined }));
    for (const status of Object.keys(getAllStatusEffects() || {})) {
        addS(`axis:STATUS_IMMUNITY:${status}`, S(KEYWORD.PROVIDES, { payload: { type: 'STATUS_IMMUNITY', bucket: 'flat', value: 1, category: status } }));
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
                addS(`target:${name}:${reach}:${JSON.stringify(to)}`, { ...make(), reach, to }, shippedNames);
            }
        }
        for (const kind of FILTER_KINDS) {
            for (const not of [false, true]) {
                const value = kind.id === 'charges_below' ? 3 : kind.id === 'tagged' ? 'Wet' : FIX.effect;
                addS(`filter:${name}:${kind.id}:${not}`, { ...make(), to: { mode: 'tag', value: 'Coast', filters: [{ kind: kind.id, value, not }] } }, shippedNames);
            }
        }
        addS(`filter:${name}:stacked`, { ...make(), reach: 'board', to: { mode: 'all', filters: [{ kind: 'tagged', value: 'Wet' }, { kind: 'worked', not: true }] } }, shippedNames);
    }

    // ---- 5. Every moment, with and without its parameter and a cooldown ----
    for (const t of TRIGGER_EVENTS) {
        for (const scope of t.scopes) {
            for (const extra of [{}, { cooldownMs: 5000 }, { watchItemId: FIX.item, threshold: 7 }, { watchItemId: '', threshold: 0 }]) {
                const when = { event: t.id, scope, ...extra };
                addS(`moment:${t.id}:${scope}:${JSON.stringify(extra)}`, S(KEYWORD.DEALS, { payload: { amount: 1 }, when }), shippedNames);
                addS(`moment:${t.id}:${scope}:${JSON.stringify(extra)}:grants`, S(KEYWORD.GRANTS, { payload: { itemId: FIX.item, quantity: 1 }, when }), shippedNames);
            }
        }
    }
    addS('moment:unknown-event', S(KEYWORD.DEALS, { payload: { amount: 1 }, when: { event: 'NOT_A_MOMENT', scope: 'self' } }));
    addS('moment:cooldown-odd', S(KEYWORD.DEALS, { payload: { amount: 1 }, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 12345 } }));

    // ---- 6. Roles, magnitudes, and the action verbs ------------------------
    for (const role of [undefined, 'nonsense', ...ROLES.map(r => r.id)]) {
        const target = role === undefined ? undefined : { role };
        addS(`role:deals:${role}`, S(KEYWORD.DEALS, { payload: { amount: 3 }, target }));
        addS(`role:deals-pierce:${role}`, S(KEYWORD.DEALS, { payload: { amount: 3, ignoresArmor: true }, target }));
        addS(`role:heals:${role}`, S(KEYWORD.HEALS, { payload: { amount: 4 }, target }));
        addS(`role:restores:${role}`, S(KEYWORD.RESTORES, { payload: { amount: 1 }, target }));
        addS(`role:restores-many:${role}`, S(KEYWORD.RESTORES, { payload: { amount: 3 }, target }));
        addS(`role:removes:${role}`, S(KEYWORD.REMOVES, { payload: { effectId: FIX.effect }, target }), { effect: () => 'Thorns' });
        addS(`role:removes-all:${role}`, S(KEYWORD.REMOVES, { payload: {}, target }));
    }
    for (const amount of [0, -2, 2.5, 'x', undefined]) {
        addS(`deals:amount:${amount}`, S(KEYWORD.DEALS, { payload: { amount } }));
        addS(`heals:amount:${amount}`, S(KEYWORD.HEALS, { payload: { amount } }));
    }
    for (const stat of [...MAGNITUDE_STATS.map(s => s.id), 'not_a_stat', undefined]) {
        addS(`magnitude:stat:${stat}:deals`, S(KEYWORD.DEALS, { payload: { amount: 10, magnitude: 'stat', stat } }));
        addS(`magnitude:stat:${stat}:heals`, S(KEYWORD.HEALS, { payload: { amount: 10, magnitude: 'stat', stat } }));
    }
    for (const counted of [undefined, { mode: 'all' }, { mode: 'all', reach: 'board' }, { mode: 'all', reach: 'self' },
        { mode: 'tag', value: 'Coast' }, { mode: 'tag', value: '' }, { mode: 'id', value: FIX.token }, { mode: 'id', value: '' },
        { mode: 'tag', value: 'Coast', filters: [{ kind: 'worked', not: true }] }]) {
        addS(`magnitude:count:${JSON.stringify(counted)}`, S(KEYWORD.DEALS, { payload: { amount: 2, magnitude: 'count' }, counted }), shippedNames);
    }
    addS('magnitude:flat-explicit', S(KEYWORD.DEALS, { payload: { amount: 7, magnitude: 'flat' } }));

    for (const placement of [undefined, 'nonsense', ...PLACEMENTS.map(p => p.id)]) {
        addS(`spawns:${placement}`, S(KEYWORD.SPAWNS, { payload: { typeId: FIX.token, placement } }), shippedNames);
    }
    addS('spawns:blank', S(KEYWORD.SPAWNS, { payload: {} }));
    addS('transforms', S(KEYWORD.TRANSFORMS, { payload: { typeId: FIX.token } }), shippedNames);
    addS('transforms:blank', S(KEYWORD.TRANSFORMS, { payload: {} }));

    // ---- 7. Applies, in every shape it has ---------------------------------
    for (const statusId of [...Object.keys(getAllStatusEffects() || {}), 'not_a_status']) {
        for (const stacks of [1, 3]) {
            for (const target of [undefined, 'enemy', 'hero']) {
                for (const chance of [100, 25]) {
                    const st = S(KEYWORD.APPLIES, { payload: { statusId, stacks, target, chance } });
                    addS(`applies:status:${statusId}:${stacks}:${target}:${chance}`, st);
                    addS(`applies:status:${statusId}:${stacks}:${target}:${chance}:triggered`,
                        { ...st, when: { event: 'CYCLE_COMPLETE', scope: 'adjacent' } });
                }
            }
        }
    }
    for (const durationMs of [0, 1500, 30000, undefined]) {
        for (const chance of [100, 40, undefined]) {
            addS(`applies:effect:${durationMs}:${chance}`, S(KEYWORD.APPLIES, { payload: { effectId: FIX.effect, scale: 2, durationMs, chance } }), { effect: () => 'Thorns' });
        }
    }
    addS('applies:effect:no-names', S(KEYWORD.APPLIES, { payload: { effectId: FIX.effect } }));

    // ---- 8. The station-shaped keywords, filled and blank ------------------
    addS('station', S(KEYWORD.STATION, { payload: { skill: 'cooking' } }));
    addS('station:unknown-skill', S(KEYWORD.STATION, { payload: { skill: 'not_a_skill' } }));
    addS('station:blank', S(KEYWORD.STATION, { payload: {} }));
    addS('acts-as', S(KEYWORD.ACTS_AS, { payload: { tag: 'net', tier: 2 } }));
    addS('acts-as:no-tier', S(KEYWORD.ACTS_AS, { payload: { tag: 'net' } }));
    addS('acts-as:blank', S(KEYWORD.ACTS_AS, { payload: {} }));
    addS('requires:tokens', S(KEYWORD.REQUIRES, { payload: { tokenIds: [FIX.token, 'fixture_seafood_producer'] } }), shippedNames);
    addS('requires:tag', S(KEYWORD.REQUIRES, { payload: { tag: 'net', minTier: 3 } }));
    addS('requires:tag-no-tier', S(KEYWORD.REQUIRES, { payload: { tag: 'net' } }));
    addS('requires:blank', S(KEYWORD.REQUIRES, { payload: {} }));
    addS('restocks', S(KEYWORD.RESTOCKS, { payload: { tokenIds: [FIX.token, 'fixture_seafood_producer'] } }), shippedNames);
    addS('restocks:blank', S(KEYWORD.RESTOCKS, { payload: {} }));
    addS('converts:blank', S(KEYWORD.CONVERTS, { payload: {} }));
    addS('converts:multi', S(KEYWORD.CONVERTS, { payload: {
        consumes: [{ itemId: FIX.item, quantity: 2 }, { itemId: FIX.item2 }],
        produces: [{ itemId: FIX.item2, quantity: 0 }]
    } }), shippedNames);
    for (const kind of [...RESTRICTION_KINDS.map(k => k.id), 'not_a_kind']) {
        for (const max of [0, 1, 4]) {
            addS(`cannot:${kind}:${max}`, S(KEYWORD.CANNOT, { payload: { kind, max }, to: { mode: 'tag', value: 'Coast' } }));
        }
    }
    for (const kw of KEYWORDS.map(k => k.id)) {
        addS(`keyword:${kw}:made-blank`, makeStatement(kw));
    }
    addS('keyword:unknown', { keyword: 'not_a_keyword', payload: {} });
    addS('keyword:missing', {});

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
