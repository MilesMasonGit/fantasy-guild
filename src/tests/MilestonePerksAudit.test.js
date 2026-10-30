import { describe, it, expect, vi } from 'vitest';

/**
 * The boot audit reads the perk tables as authored: a perk naming a missing effect is named, and an
 * effect only a perk uses is not reported as used by nothing.
 */

vi.mock('../config/DatabaseManager.js', async (importOriginal) => {
    const real = await importOriginal();
    const effects = Object.values(real.DatabaseManager.effectFilesSingle)[0];
    const library = effects.default || effects;
    const [someEffect] = Object.keys(library);
    return {
        ...real,
        DatabaseManager: {
            ...real.DatabaseManager,
            effectFilesSingle: {
                '/data/effects.json': { default: { ...library, effect_k4_audit_only_perk: {
                    id: 'effect_k4_audit_only_perk', name: 'K4 Audit Perk',
                    statements: [{ id: 'stm_k4_audit', keyword: 'provides', payload: { type: 'ARMOR', bucket: 'flat', value: 1 } }]
                } } }
            },
            skillPerkFilesSingle: {
                '/data/skillPerks.json': { default: {
                    melee: { id: 'melee', perks: [{ level: 10, effectId: 'effect_k4_audit_only_perk' }, { level: 25, effectId: 'effect_k4_missing' }] },
                    mining: { id: 'mining', perks: [{ level: 10, effectId: someEffect }] }
                } }
            }
        }
    };
});

const { auditContent } = await import('../systems/core/ContentAudit.js');
const { perkRowsFor } = await import('../config/registries/perkRegistry.js');

describe('the boot audit and authored perks', () => {
    it('loads the tables from data/skillPerks.json', () => {
        expect(perkRowsFor('melee').map(r => r.level)).toEqual([10, 25]);
    });

    it('names a perk whose effect is missing, and counts a perk as a use of its effect', () => {
        const findings = auditContent();
        expect(findings.filter(f => f.where === 'Skill "melee"').map(f => f.what)).toEqual([
            expect.stringMatching(/its level 25 perk points at the effect "effect_k4_missing", which does not exist/)
        ]);
        expect(findings.some(f => f.where === 'Effect "K4 Audit Perk"')).toBe(false);
    });
});
