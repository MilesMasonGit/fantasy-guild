import { useMemo, useState } from 'react';
import { Layers, Search, Calculator, Check } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { SKILLS, TEMPO_NAMES } from '../../utils/constants';
import { SIM_PURPOSES } from '../../utils/simVocabulary';
import { fingerprint } from '../../engine/sim/answers';
import { progressionRows, groupBySkill, filterRows, recordPatch, NO_SKILL } from '../../engine/progressionRows';

/**
 * The **Progression** screen — every Token and recipe that has a work cycle, in
 * one list, grouped by skill and ordered by level.
 *
 * ## Why it exists
 *
 * The per-entity editors are the wrong shape for a question about *pacing*. The
 * shipped ladder is 36 Tokens on level 1, one on 70 and one on 90; seeing that
 * requires holding 45 records in your head, and fixing it requires opening 45
 * screens. This is the screen where a skill's ladder is one column you can read
 * top to bottom.
 *
 * ## Editing
 *
 * Level, Tempo and Purpose are editable inline and land **live**, like every
 * other field in the CMS. Which field an edit actually writes to depends on the
 * record — see `recordPatch`, which is where that decision lives and is tested.
 *
 * ⚠️ **The derived columns go stale the moment you edit**, and a stale number
 * read as a current one is this screen's worst failure. Staleness is not
 * tracked here: a row is stale when the record's fingerprint no longer matches
 * the one the simulator answered against, which is the **same mechanism**
 * `SimAnswer` already uses. One definition of stale, in one place.
 *
 * Selecting rows and setting a value across them is slice 3.
 */
export default function ProgressionPanel() {
    const tokens = useEntityStore((s) => s.tokens);
    const recipePools = useEntityStore((s) => s.recipePools);
    const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
    const updateToken = useEntityStore((s) => s.updateToken);
    const updateRecipe = useEntityStore((s) => s.updateRecipe);
    const recalculateEconomy = useEntityStore((s) => s.recalculateEconomy);
    const simAnswers = useSimulationStore((s) => s.simAnswers);
    const globals = useGlobalStore();
    const [recalcDone, setRecalcDone] = useState(false);

    /**
     * Apply one inline edit.
     *
     * The row says which record and where it lives; `recordPatch` says which
     * field the value belongs in. Neither decision is made here.
     */
    const edit = (row, patch) => {
        if (row.kind === 'token') {
            const current = tokens[row.id];
            if (!current) return;
            updateToken(row.id, recordPatch(row, current, patch));
        } else {
            const current = (recipePools[row.poolSkill] || [])[row.index];
            if (!current) return;
            updateRecipe(row.poolSkill, row.index, recordPatch(row, current, patch));
        }
    };

    /**
     * Has this record changed since the simulator last answered for it?
     *
     * ⚠️ Deliberately the same test `SimAnswer` makes, against the same stored
     * fingerprint. A second definition of "stale" that disagreed with the one
     * in the editors would be worse than none.
     */
    const staleOf = (row) => {
        const answer = simAnswers[row.id];
        if (!answer) return false;
        const record = row.kind === 'token'
            ? tokens[row.id]
            : (recipePools[row.poolSkill] || [])[row.index];
        return fingerprint(record) !== answer.fingerprint;
    };

    const handleRecalculate = () => {
        recalculateEconomy(globals);
        setRecalcDone(true);
        setTimeout(() => setRecalcDone(false), 2000);
    };

    const [search, setSearch] = useState('');
    const [skill, setSkill] = useState('all');

    const rows = useMemo(
        () => progressionRows({ tokens, recipePools }),
        [tokens, recipePools]
    );

    const groups = useMemo(() => {
        const filtered = filterRows(rows, {
            search,
            skill: skill === 'all' ? '' : skill,
        });
        return groupBySkill(filtered);
    }, [rows, search, skill]);

    const shown = groups.reduce((n, [, group]) => n + group.length, 0);
    const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;

    // Only skills the content actually uses, so the filter offers real choices
    // rather than the registry's 27.
    const usedSkills = useMemo(() => {
        const used = new Set(rows.map((r) => r.skill || NO_SKILL));
        return SKILLS.filter((s) => used.has(s.id)).map((s) => s.id)
            .concat(used.has(NO_SKILL) ? [NO_SKILL] : []);
    }, [rows]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar" style={{ background: '#0f0f12' }}>
            <div className="max-w-5xl mx-auto px-8 py-6 space-y-5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Layers size={18} style={{ color: 'var(--color-accent)' }} />
                        Progression
                    </h2>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Every Token and recipe that does work, by the skill it needs and the
                        level it needs it at.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or id…"
                            className="w-full pl-7"
                        />
                    </div>
                    <select value={skill} onChange={(e) => setSkill(e.target.value)} style={{ width: 180 }}>
                        <option value="all">All skills</option>
                        {usedSkills.map((id) => (
                            <option key={id || 'none'} value={id}>
                                {id === NO_SKILL ? 'No skill' : skillName(id)}
                            </option>
                        ))}
                    </select>
                    <span className="text-[11px] text-gray-600 whitespace-nowrap">
                        {shown} of {rows.length}
                    </span>
                    {/* The same Recalculate as the top bar, within reach of the
                        edits that make its numbers wrong. */}
                    <button
                        onClick={handleRecalculate}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
                        style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
                    >
                        {recalcDone ? <Check size={13} /> : <Calculator size={13} />}
                        {recalcDone ? 'Done' : 'Recalculate'}
                    </button>
                </div>

                {groups.length === 0 ? (
                    <p className="text-sm text-gray-600 py-10 text-center">Nothing matches.</p>
                ) : (
                    groups.map(([skillId, group]) => (
                        <SkillGroup
                            key={skillId || 'none'}
                            label={skillId === NO_SKILL ? 'No skill' : skillName(skillId)}
                            rows={group}
                            noSkill={skillId === NO_SKILL}
                            onEdit={edit}
                            staleOf={staleOf}
                            onOpen={(row) => {
                                // A recipe lives in a pool rather than a keyed
                                // collection, so only a Token can be selected
                                // as an entity; a recipe opens its pool.
                                if (row.kind === 'token') setActiveEntity(row.id, 'token');
                            }}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

const cell = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

function SkillGroup({ label, rows, noSkill, onOpen, onEdit, staleOf }) {
    return (
        <section className="rounded-xl border bg-[#1a1a1e] border-white/10 overflow-hidden">
            <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: noSkill ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                    {label}
                </h3>
                <span className="text-[10px] text-gray-600">{rows.length}</span>
            </div>

            {noSkill && (
                <p className="px-4 py-2 text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    These do work but name no skill, so they sit on no ladder and no hero levels
                    up for them. Set a skill in the Token editor.
                </p>
            )}

            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{ ...head, textAlign: 'left' }}>Name</th>
                        <th style={{ ...head, textAlign: 'left', width: 70 }}>Kind</th>
                        <th style={{ ...head, textAlign: 'right', width: 60 }}>Level</th>
                        <th style={{ ...head, textAlign: 'left', width: 80 }}>Tempo</th>
                        <th style={{ ...head, textAlign: 'left', width: 80 }}>Purpose</th>
                        <th style={{ ...head, textAlign: 'right', width: 70 }}>Cycle</th>
                        <th style={{ ...head, textAlign: 'right', width: 60 }}>XP</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                      const stale = staleOf(row);
                      return (
                        <tr key={row.rowKey} className="hover:bg-white/[0.03]">
                            <td style={{ ...cell, color: 'var(--color-text-primary)' }}>
                                {row.kind === 'token' ? (
                                    <button
                                        onClick={() => onOpen(row)}
                                        className="underline text-left"
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                                    >
                                        {row.name}
                                    </button>
                                ) : row.name}
                            </td>
                            <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{row.kind}</td>
                            <td style={{ ...cell, textAlign: 'right' }}>
                                <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={row.level}
                                    onChange={(e) => onEdit(row, { level: e.target.value })}
                                    className="w-full text-right"
                                    style={{ fontFamily: 'monospace', padding: '2px 6px', fontSize: 11 }}
                                />
                            </td>
                            <td style={cell}>
                                <select
                                    value={row.tempo || ''}
                                    onChange={(e) => onEdit(row, { tempo: e.target.value })}
                                    style={{ width: '100%', padding: '2px 4px', fontSize: 11, color: row.tempo ? undefined : 'var(--color-warning)' }}
                                >
                                    <option value="">untagged</option>
                                    {TEMPO_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </td>
                            <td style={cell}>
                                <select
                                    value={row.purpose || ''}
                                    onChange={(e) => onEdit(row, { purpose: e.target.value })}
                                    style={{ width: '100%', padding: '2px 4px', fontSize: 11, color: row.purpose ? undefined : 'var(--color-warning)' }}
                                >
                                    <option value="">untagged</option>
                                    {SIM_PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </td>
                            {/* Derived, and dimmed with a dot once the record
                                has moved on from the answer they came from. */}
                            <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)', opacity: stale ? 0.4 : 1 }}>
                                {stale && <span title="Out of date — Recalculate" style={{ color: 'var(--color-warning)', opacity: 1 }}>• </span>}
                                {Number.isFinite(row.cycleTimeMs) ? `${Math.round(row.cycleTimeMs / 1000)}s` : '—'}
                            </td>
                            <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)', opacity: stale ? 0.4 : 1 }}>
                                {Number.isFinite(row.xp) ? row.xp : '—'}
                            </td>
                        </tr>
                      );
                    })}
                </tbody>
            </table>
        </section>
    );
}
