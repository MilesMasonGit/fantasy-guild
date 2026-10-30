import { useMemo, useState } from 'react';
import { BookOpen, Search, Plus, RefreshCw, ArrowUpCircle } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import {
  PLAN_STATUS, PLAN_STATUSES, PLAN_TIERS, PLAN_TEXT, tierLabel, tierOrNull,
} from '../../../../src/systems/progression/ledger/plan.js';
import {
  ledgerRows, filterLedgerRows, planPatch, stubPlan, reachText, LEDGER_KINDS, LEDGER_KIND_TEXT,
} from '../../engine/ledgerRows';
import { workspaceLedger } from '../../engine/ledgerReport';
import LedgerSettings from './LedgerSettings';

/**
 * The Ledger: every item, map, Token, enemy and recipe with the owner's plan for it (status, tier,
 * note), edited in place and written as the same `plan` block the editors' Plan section writes, and
 * the Ledger settings. Planned stubs are added here; Sync keeps them out of `data/`.
 * ⚠️ The reach column is worked out when the tab opens and on Refresh, not on every edit: it is the
 * whole reach engine over the workspace.
 */
export default function LedgerPanel({ setCurrentView }) {
  const [page, setPage] = useState('entries');

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{ background: '#0f0f12' }}>
      <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen size={18} style={{ color: 'var(--color-accent)' }} />
              Ledger
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Every entry with its plan: whether it is in the game, the stage it belongs to, and a note.
              Planned entries are stubs for content not made yet; they never reach the game.
            </p>
          </div>
          <div className="flex gap-1" role="tablist">
            {[['entries', 'Entries'], ['settings', 'Settings']].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={page === key}
                onClick={() => setPage(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: page === key ? 'var(--color-accent-muted)' : 'transparent',
                  color: page === key ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-subtle)', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {page === 'entries' ? <LedgerEntries setCurrentView={setCurrentView} /> : <LedgerSettings />}
      </div>
    </div>
  );
}

function LedgerEntries({ setCurrentView }) {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const recipePools = useEntityStore((s) => s.recipePools);

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [adding, setAdding] = useState(false);

  const workOutReach = () => {
    const ledger = workspaceLedger(useEntityStore.getState());
    return { reachOf: ledger.reachOf, at: new Date() };
  };
  const [reach, setReach] = useState(workOutReach);

  const rows = useMemo(() => ledgerRows({ items, tokens, recipePools }), [items, tokens, recipePools]);
  const shown = useMemo(() => filterLedgerRows(rows, { kind, status, tier, search }), [rows, kind, status, tier, search]);

  const tiers = useMemo(() => {
    const extra = rows.map((r) => r.tier).filter((t) => t !== null && !PLAN_TIERS.includes(t));
    return [...new Set([...PLAN_TIERS, ...extra])].sort((a, b) => a - b);
  }, [rows]);

  const counts = useMemo(() => {
    const out = Object.fromEntries(PLAN_STATUSES.map((s) => [s, 0]));
    for (const r of rows) out[r.status] += 1;
    return out;
  }, [rows]);

  const open = (row) => {
    const store = useEntityStore.getState();
    if (row.kind === 'recipe') {
      store.focusRecipe(row.id);
      setCurrentView?.('recipes');
    } else {
      store.setActiveEntity(row.id, row.collection === 'items' ? 'item' : 'token');
      setCurrentView?.('editor');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, id or note…"
            className="w-full pl-7"
            aria-label="Search the ledger"
          />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 120 }} aria-label="Filter by kind">
          <option value="">All kinds</option>
          {LEDGER_KINDS.map((k) => <option key={k} value={k}>{LEDGER_KIND_TEXT[k]}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 130 }} aria-label="Filter by status">
          <option value="">All statuses</option>
          {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_TEXT.status[s]} ({counts[s]})</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} style={{ width: 140 }} aria-label="Filter by tier">
          <option value="">All tiers</option>
          <option value="none">{PLAN_TEXT.noTier}</option>
          {tiers.map((t) => <option key={t} value={String(t)}>{tierLabel(t)}</option>)}
        </select>
        <span className="text-[11px] text-gray-600 whitespace-nowrap">{shown.length} of {rows.length}</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={13} /> Planned stub
        </button>
      </div>

      {adding && <StubForm tiers={tiers} onDone={() => setAdding(false)} />}

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 overflow-hidden">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>Name</th>
              <th style={{ ...head, textAlign: 'left', width: 70 }}>Kind</th>
              <th style={{ ...head, textAlign: 'left', width: 150 }}>Status</th>
              <th style={{ ...head, textAlign: 'left', width: 140 }}>Tier</th>
              <th style={{ ...head, textAlign: 'left', width: 130 }}>
                <span className="flex items-center gap-1.5">
                  First reach
                  <button
                    onClick={() => setReach(workOutReach())}
                    title={`Worked out at ${reach.at.toLocaleTimeString()}. Work it out again after edits.`}
                    aria-label="Refresh first reach"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  >
                    <RefreshCw size={10} />
                  </button>
                </span>
              </th>
              <th style={{ ...head, textAlign: 'left' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <LedgerRow key={row.rowKey} row={row} reach={reach.reachOf(row.ledgerKey)} tiers={tiers} onOpen={open} />
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="text-sm text-gray-600 py-10 text-center">Nothing matches.</p>}
      </section>
    </>
  );
}

const cell = { padding: '5px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };
const STATUS_COLOR = { planned: 'var(--color-warning)', draft: 'var(--color-accent-hover)', live: 'var(--color-text-primary)', parked: 'var(--color-text-muted)' };

/** Write part of one row's plan block, where its record lives. */
function writePlan(row, patch) {
  const store = useEntityStore.getState();
  if (row.kind === 'recipe') {
    const record = (store.recipePools[row.poolSkill] || [])[row.index];
    if (record) store.updateRecipe(row.poolSkill, row.index, planPatch(record, patch));
  } else if (row.collection === 'items') {
    const record = store.items[row.id];
    if (record) store.updateItem(row.id, planPatch(record, patch));
  } else {
    const record = store.tokens[row.id];
    if (record) store.updateToken(row.id, planPatch(record, patch));
  }
}

function LedgerRow({ row, reach, tiers, onOpen }) {
  const [note, setNote] = useState(row.note);
  const [noteFor, setNoteFor] = useState(row.note);
  if (row.note !== noteFor) {
    setNoteFor(row.note);
    setNote(row.note);
  }
  const commitNote = () => { if (note !== row.note) writePlan(row, { note }); };

  return (
    <tr className="hover:bg-white/[0.03]" data-row={row.rowKey}>
      <td style={{ ...cell, color: 'var(--color-text-primary)' }}>
        <button
          onClick={() => onOpen(row)}
          className="underline text-left"
          title={row.id}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
        >
          {row.name}
        </button>
      </td>
      <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{LEDGER_KIND_TEXT[row.kind]}</td>
      <td style={cell}>
        <div className="flex items-center gap-1">
          <select
            value={row.status}
            onChange={(e) => writePlan(row, { status: e.target.value })}
            aria-label={`Status of ${row.name}`}
            style={{ width: '100%', padding: '2px 4px', fontSize: 11, color: STATUS_COLOR[row.status] }}
          >
            {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_TEXT.status[s]}</option>)}
          </select>
          {row.status === PLAN_STATUS.PLANNED && (
            <button
              onClick={() => writePlan(row, { status: PLAN_STATUS.DRAFT })}
              title="Promote to Draft: it then syncs to the game like Live content"
              aria-label={`Promote ${row.name} to Draft`}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent-hover)' }}
            >
              <ArrowUpCircle size={14} />
            </button>
          )}
        </div>
      </td>
      <td style={cell}>
        <select
          value={row.tier ?? ''}
          onChange={(e) => writePlan(row, { tier: tierOrNull(e.target.value) })}
          aria-label={`Tier of ${row.name}`}
          style={{ width: '100%', padding: '2px 4px', fontSize: 11, color: row.tier === null ? 'var(--color-text-muted)' : undefined }}
        >
          <option value="">{PLAN_TEXT.noTier}</option>
          {tiers.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
        </select>
      </td>
      <td style={{ ...cell, color: reachColor(row, reach) }} data-reach={row.ledgerKey}>{reachText(reach, tierLabel)}</td>
      <td style={cell}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNote(); }}
          aria-label={`Note on ${row.name}`}
          className="w-full"
          style={{ padding: '2px 6px', fontSize: 11 }}
        />
      </td>
    </tr>
  );
}

/** Muted when there is nothing to compare; the warning colour when reach and the owner's tier disagree. */
function reachColor(row, reach) {
  if (!reach || reach.planned || row.tier === null) return 'var(--color-text-muted)';
  if (reach.tier === null || reach.tier !== row.tier) return 'var(--color-warning)';
  return 'var(--color-text-secondary)';
}

const STUB_KINDS = LEDGER_KINDS;

function StubForm({ tiers, onDone }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('item');
  const [tier, setTier] = useState('');
  const [note, setNote] = useState('');
  const [skill, setSkill] = useState(SKILLS[0]?.id || '');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const plan = stubPlan({ tier: tierOrNull(tier), note });
    const store = useEntityStore.getState();
    if (kind === 'item') store.addItem({ name: trimmed, plan });
    else if (kind === 'map') store.addMap('map', { name: trimmed, plan });
    else if (kind === 'token') store.addToken({ name: trimmed, plan });
    else if (kind === 'enemy') store.addToken({ name: trimmed, enemy: { level: 1, style: 'melee' }, plan });
    else if (kind === 'recipe') store.addRecipe(skill, { name: trimmed, plan });
    setName('');
    setNote('');
  };

  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-3" aria-label="Add a Planned stub">
      <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        A Planned stub is a name, a stage and a note for content not made yet. It stays in the CMS and
        never syncs to the game until you promote it to Draft.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Name"
          aria-label="Stub name"
          style={{ width: 200 }}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Stub kind" style={{ width: 110 }}>
          {STUB_KINDS.map((k) => <option key={k} value={k}>{LEDGER_KIND_TEXT[k]}</option>)}
        </select>
        {kind === 'recipe' && (
          <select value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Stub skill" style={{ width: 130 }}>
            {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Stub tier" style={{ width: 140 }}>
          <option value="">{PLAN_TEXT.noTier}</option>
          {tiers.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Note"
          aria-label="Stub note"
          className="flex-1"
          style={{ minWidth: 160 }}
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="px-3 py-2 rounded-lg text-xs font-bold"
          style={{ background: 'var(--color-accent)', color: 'white', border: 'none', cursor: name.trim() ? 'pointer' : 'default', opacity: name.trim() ? 1 : 0.5 }}
        >
          Add
        </button>
        <button
          onClick={onDone}
          className="px-3 py-2 rounded-lg text-xs"
          style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </section>
  );
}
