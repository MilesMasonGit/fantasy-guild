import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { migratePromotionFields } from '../systems/effects/effectMigration.js';
import { KEYWORD, statementsOf, promotedJobOf } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';

/**
 * ⭐ **The Academies become rules** (Promotes rule P2).
 *
 * `promotion: { jobId }` → a library effect holding "Promotes the hero to …",
 * referenced by the Token. The same pure function runs over `data/` (by script)
 * and over the CMS workspace (on load), so both copies must convert identically
 * — which is why determinism and idempotence are tested as hard as the result.
 */

const academy = (id, jobId, extra = {}) => ({
    id, name: `${jobId} academy`, tokenType: 'buff', uses: 10, size: 2, requiresHero: true,
    config: null, promotion: { jobId }, ...extra,
});

describe('converting one Token', () => {
    const { tokens, effects, moved } = migratePromotionFields({ token_wiz: academy('token_wiz', 'wizard') });
    const token = tokens.token_wiz;
    const [ref] = token.effects;
    const effect = effects[ref.effectId];

    it('removes the field and references a new effect, keeping everything else', () => {
        expect(moved).toBe(1);
        expect('promotion' in token).toBe(false);
        expect(token).toMatchObject({ uses: 10, size: 2, requiresHero: true, tokenType: 'buff' });
        expect(token.effects).toEqual([{ effectId: 'effect_wizard_training', scale: 1 }]);
    });

    it('builds an effect named after the job, holding one Promotes rule', () => {
        expect(effect.name).toBe('Wizard Training');
        expect(effect.autoSyncId).toBe(true);
        const [statement] = statementsOf(effect);
        expect(statement).toMatchObject({ id: 'stm_promotes_wizard', keyword: KEYWORD.PROMOTES, payload: { jobId: 'wizard' } });
        expect(renderStatement(statement)).toBe('Promotes the hero to Wizard.');
    });

    it('makes the Token a promotion Token that names its job, once expanded', () => {
        const expanded = expandBearer(token, effects);
        expect(promotedJobOf(expanded)).toBe('wizard');
        expect(deriveTokenType(expanded).type).toBe('promotion');
    });
});

describe('⚠️ both copies must agree', () => {
    it('is deterministic: the same input gives byte-identical output', () => {
        const input = { a: academy('a', 'fighter'), b: academy('b', 'wizard') };
        const one = migratePromotionFields(input);
        const two = migratePromotionFields(input);
        expect(JSON.stringify(two)).toBe(JSON.stringify(one));
    });

    it('is idempotent: running on its own output changes nothing', () => {
        const first = migratePromotionFields({ a: academy('a', 'fighter') });
        const second = migratePromotionFields(first.tokens, { existing: first.effects });
        expect(second.moved).toBe(0);
        expect(second.tokens).toEqual(first.tokens);
        expect(second.effects).toEqual(first.effects);
    });

    it('does not mutate what it was given', () => {
        const input = { a: academy('a', 'fighter') };
        const snapshot = JSON.stringify(input);
        migratePromotionFields(input);
        expect(JSON.stringify(input)).toBe(snapshot);
    });
});

describe('sharing and reuse', () => {
    it('gives two Tokens promoting to the same job one shared effect', () => {
        const { tokens, effects } = migratePromotionFields({ a: academy('a', 'knight'), b: academy('b', 'knight') });
        expect(Object.keys(effects)).toEqual(['effect_knight_training']);
        expect(tokens.a.effects).toEqual(tokens.b.effects);
    });

    it('reuses a library effect that already holds exactly that rule', () => {
        const existing = { effect_barracks: { id: 'effect_barracks', name: 'Barracks', statements: [{ id: 'x', keyword: 'promotes', payload: { jobId: 'knight' } }] } };
        const { tokens, effects } = migratePromotionFields({ a: academy('a', 'knight') }, { existing });
        expect(tokens.a.effects).toEqual([{ effectId: 'effect_barracks', scale: 1 }]);
        expect(Object.keys(effects)).toEqual(['effect_barracks']);
    });

    it('never overwrites an unrelated effect that happens to have the id it wanted', () => {
        const existing = { effect_knight_training: { id: 'effect_knight_training', name: 'Something else', statements: [] } };
        const { tokens, effects } = migratePromotionFields({ a: academy('a', 'knight') }, { existing });
        expect(effects.effect_knight_training.name).toBe('Something else');
        expect(tokens.a.effects).toEqual([{ effectId: 'effect_knight_training_2', scale: 1 }]);
    });

    it('keeps the Token’s existing references, and never adds one twice', () => {
        const withRef = academy('a', 'knight', { effects: [{ effectId: 'effect_pickaxe', scale: 1 }, 'effect_knight_training'] });
        const existing = { effect_knight_training: { id: 'effect_knight_training', name: 'Knight Training', statements: [{ id: 's', keyword: 'promotes', payload: { jobId: 'knight' } }] } };
        const { tokens } = migratePromotionFields({ a: withRef }, { existing });
        expect(tokens.a.effects).toEqual([{ effectId: 'effect_pickaxe', scale: 1 }, 'effect_knight_training']);
        expect('promotion' in tokens.a).toBe(false);
    });
});

describe('what it leaves alone', () => {
    it('passes Tokens without the field through untouched, as the same objects', () => {
        const plain = { id: 'plain', name: 'Oak' };
        const { tokens, moved } = migratePromotionFields({ plain });
        expect(moved).toBe(0);
        expect(tokens.plain).toBe(plain);
    });

    it('leaves a field naming no job exactly as it is', () => {
        const blank = { id: 'b', promotion: { jobId: '' } };
        const odd = { id: 'o', promotion: {} };
        const { tokens, effects, moved } = migratePromotionFields({ b: blank, o: odd });
        expect(moved).toBe(0);
        expect(tokens.b).toBe(blank);
        expect(tokens.o).toBe(odd);
        expect(effects).toEqual({});
    });

    it('still converts an unknown job, so it shows up instead of vanishing', () => {
        const { tokens, effects } = migratePromotionFields({ a: academy('a', 'not_a_job') });
        const effect = effects[tokens.a.effects[0].effectId];
        expect(renderStatement(statementsOf(effect)[0])).toBe('Promotes the hero to not_a_job.');
    });
});

describe('⭐ the CMS converts a workspace on every load path', () => {
    const reset = () => useEntityStore.setState({
        items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null
    });
    beforeEach(reset);
    afterEach(reset);

    const workspace = () => ({
        items: {},
        tokens: { token_wizard_academy: academy('token_wizard_academy', 'wizard') },
        effects: { effect_pickaxe: { id: 'effect_pickaxe', name: 'Pickaxe', statements: [{ id: 'p', keyword: 'acts_as', payload: { tag: 'pickaxe', tier: 1 } }] } },
        maps: {},
        recipePools: {},
    });

    it('on a workspace import (hydrate)', () => {
        useEntityStore.getState().hydrate(workspace());
        const { tokens, effects } = useEntityStore.getState();
        expect('promotion' in tokens.token_wizard_academy).toBe(false);
        expect(tokens.token_wizard_academy.effects).toEqual([{ effectId: 'effect_wizard_training', scale: 1 }]);
        expect(effects.effect_wizard_training.name).toBe('Wizard Training');
        expect(effects.effect_pickaxe.name).toBe('Pickaxe');
    });

    it('on a browser reload (persist merge) — and agrees with the script’s function exactly', () => {
        const persisted = workspace();
        const merged = useEntityStore.persist.getOptions().merge(persisted, useEntityStore.getState());
        const direct = migratePromotionFields(persisted.tokens, { existing: persisted.effects });
        expect(merged.tokens).toEqual(direct.tokens);
        expect(merged.effects).toEqual(direct.effects);
    });

    it('on a numbered-version upgrade (persist migrate)', () => {
        const migrated = useEntityStore.persist.getOptions().migrate(workspace(), 0);
        expect('promotion' in migrated.tokens.token_wizard_academy).toBe(false);
        expect(migrated.effects.effect_wizard_training).toBeTruthy();
    });

    it('leaves a workspace without the field untouched', () => {
        const persisted = workspace();
        delete persisted.tokens.token_wizard_academy.promotion;
        const merged = useEntityStore.persist.getOptions().merge(persisted, useEntityStore.getState());
        expect(merged.effects).toEqual(persisted.effects);
    });
});

describe('the shipped data', () => {
    const data = (file) => JSON.parse(readFileSync(join(process.cwd(), 'data', file), 'utf8'));

    it('⚠️ carries no promotion field — every Academy is a Promotes rule', () => {
        const tokens = data('tokens.json');
        expect(Object.values(tokens).filter((t) => 'promotion' in t).map((t) => t.id)).toEqual([]);
    });

    it('names the jobs the Academies were authored with', () => {
        const tokens = data('tokens.json');
        const effects = data('effects.json');
        expect(promotedJobOf(expandBearer(tokens.token_wizard_academy, effects))).toBe('wizard');
        expect(promotedJobOf(expandBearer(tokens.token_fighter_s_academy, effects))).toBe('fighter');
    });

    it('uses the shared function in the data script, never a copy of it', () => {
        const script = readFileSync(join(process.cwd(), 'scripts', 'migrate-promotion-rules.mjs'), 'utf8');
        expect(script).toContain("import { migratePromotionFields } from '../src/systems/effects/effectMigration.js'");
    });
});
