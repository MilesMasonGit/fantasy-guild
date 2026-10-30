import { useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';

import {
  CHECKS, CHECK_GROUP_TEXT, SEVERITIES, SEVERITY_TEXT, filterFindings,
} from '../../../../src/systems/progression/ledger/checks.js';

export const SEVERITY_COLOR = { block: 'var(--color-error)', warn: 'var(--color-warning)', info: 'var(--color-text-muted)' };

/** A severity as a small coloured chip. */
export function SeverityChip({ severity }) {
  return (
    <span
      className="inline-block rounded px-1.5 text-[9px] font-black uppercase tracking-wider"
      style={{ color: SEVERITY_COLOR[severity], border: `1px solid ${SEVERITY_COLOR[severity]}`, lineHeight: '14px' }}
    >
      {SEVERITY_TEXT[severity]}
    </span>
  );
}

/**
 * The problems list: every finding of the ledger's checks (integrity, plan against data, luck and
 * access, pacing), filtered by severity, group, check and text; a name opens the entry's page, a
 * skill its row on the Pace page. Parked entries are silenced and never listed.
 */
export default function LedgerProblems({ report, onRefresh, onOpen, onOpenSkill = () => {} }) {
  const [severity, setSeverity] = useState('');
  const [group, setGroup] = useState('');
  const [check, setCheck] = useState('');
  const [search, setSearch] = useState('');

  const { findings } = report;
  const shown = useMemo(() => filterFindings(findings, { severity, group, check, search }), [findings, severity, group, check, search]);
  const count = (pred) => findings.filter(pred).length;
  const checks = Object.entries(CHECKS).filter(([id, c]) => (!group || c.group === group) && findings.some((f) => f.check === id));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or problem…"
            className="w-full pl-7"
            aria-label="Search the problems"
          />
        </div>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ width: 120 }} aria-label="Filter by severity">
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_TEXT[s]} ({count((f) => f.severity === s)})</option>)}
        </select>
        <select value={group} onChange={(e) => { setGroup(e.target.value); setCheck(''); }} style={{ width: 210 }} aria-label="Filter by group">
          <option value="">All groups</option>
          {Object.entries(CHECK_GROUP_TEXT).map(([g, label]) => <option key={g} value={g}>{g}. {label} ({count((f) => f.group === g)})</option>)}
        </select>
        <select value={check} onChange={(e) => setCheck(e.target.value)} style={{ width: 230 }} aria-label="Filter by check">
          <option value="">All checks</option>
          {checks.map(([id, c]) => <option key={id} value={id}>{c.label} ({count((f) => f.check === id)})</option>)}
        </select>
        <span className="text-[11px] text-gray-600 whitespace-nowrap">{shown.length} of {findings.length}</span>
        <button
          onClick={onRefresh}
          title={`Worked out at ${report.at.toLocaleTimeString()}. Work it out again after edits.`}
          aria-label="Refresh the problems"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 overflow-hidden">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 64 }}>Severity</th>
              <th style={{ ...head, textAlign: 'left', width: 170 }}>Entry</th>
              <th style={{ ...head, textAlign: 'left', width: 200 }}>Check</th>
              <th style={{ ...head, textAlign: 'left' }}>What is wrong</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.id} className="hover:bg-white/[0.03]" data-finding={f.check}>
                <td style={cell}><SeverityChip severity={f.severity} /></td>
                <td style={{ ...cell, color: 'var(--color-text-primary)' }}>
                  {/^(item|token|recipe|skill):/.test(f.key) ? (
                    <button
                      onClick={() => (f.key.startsWith('skill:') ? onOpenSkill(f.key.slice(6)) : onOpen(f.key))}
                      className="underline text-left"
                      title={f.key}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                    >
                      {f.name}
                    </button>
                  ) : f.name}
                  <span className="ml-1 text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{f.key.split(':')[0]}</span>
                </td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{f.group}.</span> {CHECKS[f.check]?.label}
                </td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{f.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="text-sm text-gray-600 py-10 text-center">No problems match.</p>}
      </section>
    </>
  );
}

const cell = { padding: '5px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };
