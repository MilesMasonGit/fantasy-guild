import { useMemo, useState } from 'react';
import { Layers, Search } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import { progressionRows, groupBySkill, filterRows, NO_SKILL } from '../../engine/progressionRows';

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
 * ## Read-only, for now
 *
 * Slice 1 of the plan (`docs/progression_screen_plan_v1.md`) is the list alone.
 * Editing level, Tempo and Purpose inline, and setting them across a ticked
 * selection, are slices 2 and 3. Landing the reading half first is deliberate:
 * the level lives in **two different fields** depending on the record, and a
 * writer built on a misread would corrupt content rather than merely display it
 * wrongly.
 *
 * ⚠️ The derived columns show what the **last** Recalculate decided. Nothing on
 * this screen edits yet, so nothing here can be stale — the stale marking
 * arrives with the editing that can make it stale.
 */
export default function ProgressionPanel() {
    const tokens = useEntityStore((s) => s.tokens);
    const recipePools = useEntityStore((s) => s.recipePools);
    const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

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

function SkillGroup({ label, rows, noSkill, onOpen }) {
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
                    {rows.map((row) => (
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
                            <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                                {row.level}
                            </td>
                            <td style={{ ...cell, color: row.tempo ? 'var(--color-text-secondary)' : 'var(--color-warning)' }}>
                                {row.tempo || 'untagged'}
                            </td>
                            <td style={{ ...cell, color: row.purpose ? 'var(--color-text-secondary)' : 'var(--color-warning)' }}>
                                {row.purpose || 'untagged'}
                            </td>
                            <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                                {Number.isFinite(row.cycleTimeMs) ? `${Math.round(row.cycleTimeMs / 1000)}s` : '—'}
                            </td>
                            <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                                {Number.isFinite(row.xp) ? row.xp : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
