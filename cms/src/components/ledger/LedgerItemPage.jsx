import { useMemo } from 'react';
import { ArrowLeft, RefreshCw, Pencil } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import {
  PLAN_STATUSES, PLAN_TEXT, PLAN_TIERS, tierLabel, tierOrNull,
} from '../../../../src/systems/progression/ledger/plan.js';
import { ruleIndex, CHECKS } from '../../../../src/systems/progression/ledger/checks.js';
import { parseKey, LEDGER_ENGINE_TEXT } from '../../../../src/systems/progression/ledger/engine.js';
import { ledgerRows, LEDGER_KIND_TEXT } from '../../engine/ledgerRows';
import { sourcesOf, usesOf, effectiveTier, effortText, firstReachText } from '../../engine/ledgerPage';
import { SeverityChip } from './LedgerProblems';
import LedgerTree, { tierColor } from './LedgerTree';
import { openInEditor, writePlan } from './ledgerActions';
import LedgerRates, { LedgerPathTime } from './LedgerRates';

/**
 * An entry's page in the Ledger: its status and set tier against the tier it is first reached at, the
 * path there, its path time at each profile, its rates (a Token's or recipe's work with every
 * factor switchable; an item's supply), its problems, every source and every use, and for an item its
 * whole ingredient tree as a layered diagram with its effort. Any name on it opens that entry's page.
 * ⚠️ Reach, trees and problems are the report's (worked out when the tab opened or on Refresh); the
 * status and tier selects write the record at once and show the new value, the rest after Refresh.
 */
export default function LedgerItemPage({ entryKey, report, onOpen, onBack, onRefresh, setCurrentView }) {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const recipePools = useEntityStore((s) => s.recipePools);
  const state = useMemo(() => ({ items, tokens, recipePools }), [items, tokens, recipePools]);
  const row = useMemo(() => ledgerRows(state).find((r) => r.ledgerKey === entryKey) || null, [state, entryKey]);

  const { ledger } = report;
  const index = useMemo(() => ruleIndex(ledger.world), [ledger]);
  const at = ledger.reachOf(entryKey);
  const { kind, id } = parseKey(entryKey);
  const sources = useMemo(() => sourcesOf(ledger, entryKey, index), [ledger, entryKey, index]);
  const uses = useMemo(() => usesOf(ledger, entryKey, index), [ledger, entryKey, index]);
  const tree = useMemo(() => (kind === 'item' && at && !at.planned ? ledger.treeOf(id) : null), [ledger, kind, id, at]);
  const findings = report.byKey.get(entryKey) || [];

  if (!row) {
    return (
      <section className="space-y-3">
        <BackBar onBack={onBack} onRefresh={onRefresh} />
        <p className="text-sm text-gray-500">This entry is no longer in the workspace.</p>
      </section>
    );
  }

  const computed = at && !at.planned ? at.tier : null;
  const light = row.tier === null ? 'none' : computed === null ? 'never' : computed === row.tier ? 'match' : 'differ';
  const LIGHT = {
    none: ['var(--color-text-muted)', 'No tier set to compare with'],
    never: ['var(--color-error)', 'Never reachable'],
    match: ['var(--color-success)', 'First reached in its tier'],
    differ: ['var(--color-warning)', computed !== null && computed < row.tier ? 'Reached before its tier' : 'Reached after its tier'],
  };
  const tiers = [...new Set([...PLAN_TIERS, ...(row.tier !== null ? [row.tier] : [])])].sort((a, b) => a - b);
  const tierOf = (key) => effectiveTier(state, ledger, key);
  const luckOf = (key) => !!ledger.reachOf(key)?.luckOnly;
  const isEntry = (key) => /^(item|token|recipe):/.test(key || '');

  return (
    <section className="space-y-4" aria-label={`Ledger page of ${row.name}`}>
      <BackBar onBack={onBack} onRefresh={onRefresh} at={report.at} onEdit={() => openInEditor(entryKey, setCurrentView)} />

      <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold text-white">{row.name}</h3>
          <span className="text-[11px] text-gray-500">{LEDGER_KIND_TEXT[row.kind]} · {row.id}</span>
          <select
            value={row.status}
            onChange={(e) => writePlan(row, { status: e.target.value })}
            aria-label={`Status of ${row.name}`}
            style={{ width: 110, padding: '2px 4px', fontSize: 11 }}
          >
            {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_TEXT.status[s]}</option>)}
          </select>
          <select
            value={row.tier ?? ''}
            onChange={(e) => writePlan(row, { tier: tierOrNull(e.target.value) })}
            aria-label={`Tier of ${row.name}`}
            style={{ width: 130, padding: '2px 4px', fontSize: 11 }}
          >
            <option value="">{PLAN_TEXT.noTier}</option>
            {tiers.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
          </select>
          <span className="flex items-center gap-1.5 text-[11px]" data-light={light} style={{ color: LIGHT[light][0] }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: LIGHT[light][0], display: 'inline-block' }} />
            {LIGHT[light][1]}
          </span>
        </div>

        <dl className="grid gap-x-6 gap-y-1.5 text-[11px]" style={{ gridTemplateColumns: 'max-content 1fr' }}>
          <Fact label="Set tier">{tierLabel(row.tier)}</Fact>
          <Fact label="First reach"><span data-first-reach>{firstReachText(at, tierLabel)}</span></Fact>
          <Fact label="Path"><span data-path>{ledger.pathOf(entryKey)}</span></Fact>
          {tree && (
            <>
              <Fact label="Effort">
                <span data-effort>{effortText(tree.effortMs)}</span>
                {!tree.complete && <span className="text-gray-500"> at least (a fight or a source has no time)</span>}
              </Fact>
              <Fact label="Skills">{tree.skills.length ? tree.skills.map((s) => LEDGER_ENGINE_TEXT.level(s, '').trim()).join(', ') : '—'}</Fact>
              <Fact label="Depth">{tree.depth}</Fact>
              <Fact label="Origins">
                {tree.origins.length ? tree.origins.map((o, i) => (
                  <span key={o.id}>{i > 0 && ', '}<EntryLink k={`item:${o.id}`} name={o.name} onOpen={onOpen} /> ({tierLabel(o.tier)})</span>
                )) : '—'}
              </Fact>
            </>
          )}
          {row.note && <Fact label="Note">{row.note}</Fact>}
        </dl>
      </div>

      {tree && (
        <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Ingredient tree">
          <div className="flex flex-wrap items-center gap-4">
            <h4 className={sectionHead}>Ingredient tree</h4>
            <span className="text-[10px] text-gray-500 flex items-center gap-3">
              {[0, 1, 2, 3].map((t) => (
                <span key={t} className="flex items-center gap-1"><span style={{ width: 8, height: 8, background: tierColor(t), display: 'inline-block', borderRadius: 2 }} />{tierLabel(t)}</span>
              ))}
              <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, background: tierColor(null), display: 'inline-block', borderRadius: 2 }} />no tier</span>
              <span style={{ color: '#ef4444' }}>red: from a later tier</span>
              <span>dashed: luck only</span>
            </span>
          </div>
          <p className="text-[10px] text-gray-500">
            For one {row.name}: each box is what it takes and how it is made, its colour its tier (the set one, else first reach); time is hero time at the content's own rates.
          </p>
          <LedgerTree tree={tree.tree} tierOf={tierOf} luckOf={luckOf} rootTier={tierOf(entryKey)} onOpen={(k) => k !== entryKey && onOpen(k)} />
        </div>
      )}
      {report.pace && at && !at.planned && <LedgerPathTime pace={report.pace} ledger={ledger} entryKey={entryKey} onOpen={onOpen} />}
      {report.pace && <LedgerRates pace={report.pace} ledger={ledger} entryKey={entryKey} onOpen={onOpen} />}
      <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Problems">
        <h4 className={sectionHead}>Problems ({findings.length})</h4>
        {findings.length === 0 && <p className="text-[11px] text-gray-500">The checks find nothing here.</p>}
        {findings.map((f) => (
          <div key={f.id} className="flex items-start gap-2 text-[11px]" data-finding={f.check}>
            <SeverityChip severity={f.severity} />
            <span style={{ color: 'var(--color-text-muted)', minWidth: 190 }}>{f.group}. {CHECKS[f.check]?.label}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{f.message}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-1.5" aria-label="Sources">
          <h4 className={sectionHead}>Sources ({sources.length})</h4>
          {sources.length === 0 && <p className="text-[11px] text-gray-500">Nothing makes, gives or places it.</p>}
          {sources.map((s) => (
            <div key={s.id} className="text-[11px] flex items-baseline gap-2" data-source={s.how}>
              <span style={{ color: tierColor(s.tier), minWidth: 82 }}>{s.tier === null ? 'never' : tierLabel(s.tier)}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {s.howText}{' '}
                {s.viaKey && <EntryLink k={s.viaKey} name={s.viaName} onOpen={onOpen} />}
                {s.atName && <span className="text-gray-500"> at {s.atName}</span>}
                {s.gates.length > 0 && <span className="text-gray-500"> · {[...new Set(s.gates)].join(', ')}</span>}
                {s.oneOff && <span style={{ color: 'var(--color-warning)' }}> · one-off</span>}
                {s.firstKill ? <span style={{ color: 'var(--color-warning)' }}> · first kill</span>
                  : Number.isFinite(s.chance) && s.chance < 1 && <span style={{ color: s.chance < 0.05 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}> · {LEDGER_ENGINE_TEXT.chance(s.chance)}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-1.5" aria-label="Uses">
          <h4 className={sectionHead}>Uses ({uses.length})</h4>
          {uses.length === 0 && <p className="text-[11px] text-gray-500">Nothing spends or needs it.</p>}
          <div className="space-y-1.5 overflow-y-auto custom-scrollbar" style={{ maxHeight: 320 }}>
          {uses.map((u) => (
            <div key={u.key} className="text-[11px]" data-use={u.key} style={{ color: 'var(--color-text-secondary)' }}>
              <span className="text-gray-500">{u.useText}</span>{' '}
              {isEntry(u.key) ? <EntryLink k={u.key} name={u.name} onOpen={onOpen} /> : u.name}
              <span className="ml-1 text-[9px] text-gray-600">{parseKey(u.key).kind}</span>
            </div>
          ))}
          </div>
        </div>
      </div>

    </section>
  );
}

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';

function Fact({ label, children }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd style={{ color: 'var(--color-text-secondary)' }}>{children}</dd>
    </>
  );
}

function EntryLink({ k, name, onOpen }) {
  if (!/^(item|token|recipe):/.test(k)) return <span>{name}</span>;
  return (
    <button
      onClick={() => onOpen(k)}
      className="underline"
      title={k}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}
    >
      {name}
    </button>
  );
}

function BackBar({ onBack, onRefresh, at, onEdit }) {
  const btn = { background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' };
  return (
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={btn} aria-label="Back to the list">
        <ArrowLeft size={12} /> Back
      </button>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
        style={btn}
        title={at ? `Worked out at ${at.toLocaleTimeString()}. Work it out again after edits.` : undefined}
      >
        <RefreshCw size={12} /> Refresh
      </button>
      {onEdit && (
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={btn}>
          <Pencil size={12} /> Edit in its editor
        </button>
      )}
    </div>
  );
}
