// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor';
import {
    HIDEOUT_KIND as CMS_HIDEOUT_KIND, stealOf as cmsStealOf, caughtCurveOf as cmsCaughtCurveOf, crimeFindings as cmsCrimeFindings,
    STATION_KINDS as CMS_STATION_KINDS, stationKindsOfSkill as cmsStationKindsOfSkill
} from '../../cms/src/utils/constants';
import { HIDEOUT_KIND, stealOf, caughtCurveOf, CAUGHT_DEFAULTS } from '../config/registries/crime.js';
import { crimeFindings } from '../systems/core/crimeRule.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Crime in the CMS (brief 810 K4): an enemy's steal table (lines, rare finds, the camp's Crime level,
 * a theft's XP) and a Hideout's caught curve, carried through Recalculate, Sync and a reload exactly
 * as written and gone without a trace when emptied; the Hideout station kind offered on Crime; the
 * Quiet effect in the palette; and the content rule both audits share.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools };
}
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))
));
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));
const serialise = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.stringify(files[f], null, 2)]));
const reload = (text) => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(text[f])]))
));
const tokenOf = (files, id) => files['tokens.json'][id];

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

// The cow ships with a steal table of its own; these tests build one from nothing.
function openCowWithNoSteal() {
    useEntityStore.getState().updateToken('token_cow', { steal: undefined });
    return openToken('token_cow');
}

function openToken(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor)).container;
}

const STEAL = {
    crimeLevel: 6,
    xp: 4,
    outputs: [{ itemId: 'item_wheat', chance: 80, minQty: 1, maxQty: 2 }],
    rareTable: { chance: 2, entries: [{ itemId: 'item_milk', weight: 1, minQty: 1, maxQty: 1 }] }
};

describe('the vocabulary comes from the game', () => {
    it('the CMS reads Crime\'s words from the game: the Hideout kind on Crime, the steal table, the curve', () => {
        expect(CMS_HIDEOUT_KIND).toBe(HIDEOUT_KIND);
        expect(CMS_STATION_KINDS).toContain(HIDEOUT_KIND);
        expect(cmsStationKindsOfSkill('crime')).toEqual([HIDEOUT_KIND]);
        expect(cmsStealOf).toBe(stealOf);
        expect(cmsCaughtCurveOf).toBe(caughtCurveOf);
        expect(cmsCrimeFindings).toBe(crimeFindings);
    });

    it('Quiet is in the palette the effect editor offers, as points narrowed to Crime', () => {
        const row = getPaletteEntry(EFFECT_TYPES.QUIET);
        expect(row).toMatchObject({ label: 'Quiet', buckets: ['flat'], categories: 'skill', skillsOnly: ['crime'] });
        expect(row.explains).toBeTruthy();
    });
});

describe('⭐ an enemy\'s steal table', () => {
    it('the enemy editor writes a steal line and the camp\'s Crime level, and an emptied table leaves no key', () => {
        const container = openCowWithNoSteal();
        const block = () => container.querySelector('[data-field="steal-table"]');
        expect(block()).not.toBeNull();
        fireEvent.click(within(block()).getByText('Add a stolen item'));
        let steal = useEntityStore.getState().tokens.token_cow.steal;
        expect(steal.outputs).toEqual([{ itemId: '', chance: 100, minQty: 1, maxQty: 1 }]);
        fireEvent.change(block().querySelector('[data-steal-item]'), { target: { value: 'item_wheat' } });
        fireEvent.change(block().querySelector('[data-steal-crime-level] input'), { target: { value: '7' } });
        steal = useEntityStore.getState().tokens.token_cow.steal;
        expect(steal).toEqual({ outputs: [{ itemId: 'item_wheat', chance: 100, minQty: 1, maxQty: 1 }], crimeLevel: 7 });
        fireEvent.click(block().querySelector('[data-remove-steal]'));
        expect(useEntityStore.getState().tokens.token_cow.steal).toBeUndefined();
        expect(JSON.stringify(tokenOf(syncPayload(), 'token_cow'))).not.toContain('"steal"');
    });

    it('no steal table is offered on a Token that is no enemy', () => {
        const container = openToken('token_cow_pasture');
        expect(container.querySelector('[data-field="steal-table"]')).toBeNull();
    });

    it('survives Recalculate, Sync and a reload exactly as written', () => {
        useEntityStore.getState().updateToken('token_cow', { steal: STEAL });
        const first = syncPayload();
        expect(tokenOf(first, 'token_cow').steal).toEqual(STEAL);
        reload(serialise(first));
        expect(tokenOf(syncPayload(), 'token_cow').steal).toEqual(STEAL);
    });
});

describe('⭐ a Hideout', () => {
    function addHideout() {
        const id = useEntityStore.getState().addToken({ name: 'Fixture Hideout' });
        useEntityStore.getState().updateToken(id, {
            config: { skill: 'crime', skillRequired: 1, cycleTimeMs: 12000, xp: 2, inputs: [], outputs: [] },
            statements: [{ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } }]
        });
        return id;
    }

    it('a Crime station of the Hideout kind shows its caught curve, which writes only what differs from the defaults', () => {
        const id = addHideout();
        const container = openToken(id);
        const block = container.querySelector('[data-field="hideout"]');
        expect(block).not.toBeNull();
        expect(block.querySelector('[data-hideout-sample]').textContent).toContain(`${CAUGHT_DEFAULTS.evenChance}% at its level`);
        fireEvent.change(block.querySelector('[data-hideout-field="evenChance"] input'), { target: { value: '40' } });
        expect(useEntityStore.getState().tokens[id].hideout).toEqual({ evenChance: 40 });
        fireEvent.change(block.querySelector('[data-hideout-field="evenChance"] input'), { target: { value: String(CAUGHT_DEFAULTS.evenChance) } });
        expect(useEntityStore.getState().tokens[id].hideout).toBeUndefined();
        expect(JSON.stringify(tokenOf(syncPayload(), id))).not.toContain('"hideout"');
    });

    it('its curve survives Recalculate, Sync and a reload', () => {
        const id = addHideout();
        useEntityStore.getState().updateToken(id, { hideout: { evenChance: 30, perLevel: 4 } });
        const first = syncPayload();
        expect(tokenOf(first, id).hideout).toEqual({ evenChance: 30, perLevel: 4 });
        reload(serialise(first));
        expect(tokenOf(syncPayload(), id).hideout).toEqual({ evenChance: 30, perLevel: 4 });
    });
});

describe('the content rule, shared by both audits', () => {
    const cow = { id: 'cow', name: 'Cow', enemy: { level: 1 }, steal: { outputs: [{ itemId: 'wheat' }] } };
    const pasture = { id: 'pasture', name: 'Pasture', spawner: { spawns: [{ typeId: 'cow', weight: 1 }] } };
    const items = { wheat: { id: 'wheat' } };
    const messages = (content) => crimeFindings(content).map(f => `${f.entityId}: ${f.message}`);

    it('a sound steal table and Hideout say nothing', () => {
        const hideout = { id: 'hide', statements: [{ keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } }], config: { outputs: [] } };
        expect(messages({ tokens: { cow, pasture, hide: hideout }, items })).toEqual([]);
    });

    it('names a table that cannot be rolled, a curve out of range and a Hideout\'s own drops', () => {
        const found = messages({
            tokens: {
                cow: { ...cow, steal: { crimeLevel: 0, outputs: [{ itemId: 'nope' }, { tokenId: 'x' }, {}] } },
                pasture,
                rock: { id: 'rock', name: 'Rock', steal: { outputs: [{ itemId: 'wheat' }] } },
                boss: { id: 'boss', name: 'Boss', enemy: { level: 9 }, steal: { outputs: [{ itemId: 'wheat' }] } },
                tent: { id: 'tent', name: 'Tent', spawner: { spawns: [{ typeId: 'boss', weight: 1 }] } },
                hide: {
                    id: 'hide', rareTable: { chance: 1, entries: [] }, hideout: { minChance: 90, maxChance: 50, evenChance: 120 },
                    statements: [{ keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } }],
                    config: { outputs: [{ itemId: 'wheat' }] }
                },
                plain: { id: 'plain', hideout: { evenChance: 10 } }
            },
            items,
            recipes: [{ id: 'r1', name: 'Stray', stationKinds: [HIDEOUT_KIND] }],
            bossCampIds: ['tent']
        });
        const expectOne = (pattern) => expect(found.filter(m => pattern.test(m)), pattern.toString()).toHaveLength(1);
        expectOne(/^cow: .*"nope", which the game does not have/);
        expectOne(/^cow: .*names a Token/);
        expectOne(/^cow: .*line 3 names no item/);
        expectOne(/^cow: .*Crime level is 0/);
        expectOne(/^rock: .*is no enemy/);
        expectOne(/^boss: .*bosses are never robbed/);
        expectOne(/^hide: .*evenChance is 120/);
        expectOne(/^hide: .*floor reads as the ceiling/);
        expectOne(/^hide: .*outputs of its own/);
        expectOne(/^hide: .*rare drop table of its own/);
        expectOne(/^plain: .*no Hideout/);
        expectOne(/^r1: .*Made at Hideout/);
    });

    it('the CMS Economy Audit says it too, the boss camps read from the world tables', () => {
        const store = useEntityStore.getState();
        store.updateToken('token_goblin_chief', { steal: { outputs: [{ itemId: 'item_wheat' }] } });
        const s = useEntityStore.getState();
        const issues = auditConnectivity({
            items: s.items, tokens: s.tokens, recipes: {}, effects: s.effects,
            world: { kits: [{ id: 'k', bossCamps: ['token_chief_tent'] }] }
        });
        expect(issues.some(i => i.entityId === 'token_goblin_chief' && /bosses are never robbed/.test(i.details))).toBe(true);
    });

    it('an item only a steal table yields is reached: the audit counts a theft as its source', () => {
        const items = { pearl: { id: 'pearl', name: 'Pearl' }, gem: { id: 'gem', name: 'Gem' } };
        const tokens = {
            crab: { id: 'crab', name: 'Crab', enemy: { level: 3 }, steal: { outputs: [{ itemId: 'pearl' }], rareTable: { chance: 1, entries: [{ itemId: 'gem', weight: 1 }] } } }
        };
        const unreachable = auditConnectivity({ items, tokens, recipes: {}, effects: {} })
            .filter(i => i.entityType === 'Item' && /Unreachable/.test(i.details)).map(i => i.entityId);
        expect(unreachable).toEqual([]);
    });

    it('the shipped content raises no Crime finding at boot', () => {
        // A whole word: a Stealth finding is not a Crime one.
        const crime = auditContent().filter(f => /(?<![a-z])steal(?![a-z])|Hideout|caught curve|robbed/i.test(f.message || f.what || JSON.stringify(f)));
        expect(crime).toEqual([]);
    });

    it('a well-formed Hideout draws no line at boot: it runs no recipe, so Crime needs no recipe pool', () => {
        registerTokenTypes({ fixture_cms_cr_hideout: {
            id: 'fixture_cms_cr_hideout', name: 'Fixture Audit Hideout', tokenType: 'station', rarity: 'common', uses: null, sprite: 't_campfire', requiresHero: true,
            config: { skill: 'crime', skillRequired: 1, cycleTimeMs: 12000, xp: 2, inputs: [], outputs: [] },
            statements: [{ id: 'stm_cms_cr_hideout_works', keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } }]
        } });
        expect(auditContent().filter(f => JSON.stringify(f).includes('fixture_cms_cr_hideout'))).toEqual([]);
    });
});
