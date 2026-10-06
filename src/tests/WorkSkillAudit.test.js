import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * ⚠️ **Fixtures only.** There is deliberately no test that the shipped content
 * has zero blank skills: it has 17 today, and that is the owner's authoring job,
 * not a failure of this suite.
 */

const cycle = (skill) => ({
    skill, skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [],
});

/** The five shapes, as the game's registry holds them. */
const FIXTURES = {
    fx_ws_blank_bush: {
        id: 'fx_ws_blank_bush', name: 'Blank Bush', requiresHero: true, config: cycle(''),
    },
    fx_ws_missing_bush: {
        id: 'fx_ws_missing_bush', name: 'Missing Bush', config: { cycleTimeMs: 12000, inputs: [], outputs: [] },
    },
    fx_ws_enemy: {
        id: 'fx_ws_enemy', name: 'Blank Enemy', requiresHero: true,
        enemy: { level: 1, style: 'melee' }, config: cycle(''),
    },
    fx_ws_promotion: {
        id: 'fx_ws_promotion', name: 'Blank Academy', requiresHero: true, config: cycle(''),
        statements: [{ id: 'fx_ws_p', keyword: 'promotes', payload: { jobId: 'wizard' } }],
    },
    fx_ws_passive: {
        id: 'fx_ws_passive', name: 'Heroless Well', requiresHero: false, config: cycle(''),
    },
    fx_ws_skilled: {
        id: 'fx_ws_skilled', name: 'Skilled Bush', requiresHero: true, config: cycle('nature'),
    },
};

const FLAGGED = ['fx_ws_blank_bush', 'fx_ws_missing_bush'];
const EXEMPT = ['fx_ws_enemy', 'fx_ws_promotion', 'fx_ws_passive', 'fx_ws_skilled'];

describe('FP-47 — the game\'s boot audit names a hero-worked Token with no skill', () => {
    beforeAll(() => registerTokenTypes(FIXTURES));

    const skillFindings = (id) => auditContent()
        .filter((f) => f.where === `Token "${id}"` && f.what.includes('names no skill'));

    it.each(FLAGGED)('flags %s', (id) => {
        const [hit] = skillFindings(id);
        expect(hit, `${id} was not flagged`).toBeTruthy();
        expect(hit.what).toContain('FP-47');
        expect(hit.what).toContain('will not be workable');
    });

    it.each(EXEMPT)('does not flag %s', (id) => {
        expect(skillFindings(id)).toEqual([]);
    });
});

describe('FP-47 — the CMS Economy Audit tab names the same Tokens', () => {
    const skillRows = (tokens, effects) => auditConnectivity({ items: {}, tokens, effects })
        .filter((r) => r.entityType === 'Token' && r.details.includes('names no skill'));

    it('flags the blank and missing skills, as a clickable Token row', () => {
        const rows = skillRows(FIXTURES);
        expect(rows.map((r) => r.entityId).sort()).toEqual([...FLAGGED].sort());
        expect(rows[0].severity).toBe('Warning');
        expect(rows[0].details).toContain('FP-47');
    });

    it('recognises a Promotion Token whose Promotes rule lives in the effect library', () => {
        // The CMS stores references, not statements — the exemption must still hold.
        const effects = {
            fx_ws_training: {
                id: 'fx_ws_training', name: 'Training',
                statements: [{ id: 'fx_ws_t', keyword: 'promotes', payload: { jobId: 'wizard' } }],
            },
        };
        const tokens = {
            fx_ws_ref_academy: {
                id: 'fx_ws_ref_academy', name: 'Ref Academy', requiresHero: true, config: cycle(''),
                effects: [{ effectId: 'fx_ws_training', scale: 1 }],
            },
        };
        expect(skillRows(tokens, effects)).toEqual([]);
    });
});

describe('FP-47 — the Token editor shows it while the owner edits the Token', () => {
    const originalFetch = globalThis.fetch;
    const reset = () => useEntityStore.setState({
        items: {}, tokens: {}, maps: {}, recipePools: {}, effects: {},
        activeEntityId: null, activeEntityType: null,
    });

    beforeEach(() => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
        );
        reset();
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        useSimulationStore.getState().clearResults();
        reset();
    });

    const renderToken = (def) => {
        useEntityStore.setState({ tokens: { [def.id]: structuredClone(def) } });
        useEntityStore.getState().setActiveEntity(def.id, 'token');
        return render(React.createElement(TokenEditor)).container.textContent;
    };

    it('warns on a blank-skill Token', () => {
        const text = renderToken(FIXTURES.fx_ws_blank_bush);
        expect(text).toContain('names no skill');
        expect(text).toContain('FP-47');
    });

    it.each(['fx_ws_enemy', 'fx_ws_passive', 'fx_ws_skilled'])('says nothing on %s', (id) => {
        expect(renderToken(FIXTURES[id])).not.toContain('names no skill');
    });
});

describe('FP-47 — a skill picked in the CMS reaches the game file', () => {
    afterEach(() => useSimulationStore.getState().clearResults());

    it('writes config.skill through Recalculate into the tokens.json sync payload', () => {
        // The owner's path: pick a skill in Work Cycle → Skill (which calls
        // `updateToken` with the new config), Recalculate, Sync. No file is written.
        useEntityStore.setState({
            items: {}, maps: {}, recipePools: {}, effects: {},
            tokens: { fx_ws_blank_bush: structuredClone(FIXTURES.fx_ws_blank_bush) },
            activeEntityId: null, activeEntityType: null,
        });
        const token = useEntityStore.getState().tokens.fx_ws_blank_bush;
        useEntityStore.getState().updateToken('fx_ws_blank_bush', { config: { ...token.config, skill: 'nature' } });

        const files = syncFiles(useEntityStore.getState().recalculateEconomy());
        expect(files['tokens.json'].fx_ws_blank_bush.config.skill).toBe('nature');
    });
});
