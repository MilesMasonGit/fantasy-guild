import { useState, useMemo } from 'react';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { ArrowUpDown, Filter, Sparkles, Calculator, Map as MapIcon } from 'lucide-react';
import SpriteAuditDashboard from './SpriteAuditDashboard';
import AnchorElections from '../shared/AnchorElections';

const SEVERITY_ORDER = { Critical: 0, Warning: 1, Info: 2 };
const SEVERITY_COLORS = {
  Critical: 'var(--color-error, #ef4444)',
  Warning: 'var(--color-warning, #f59e0b)',
  Info: 'var(--color-info, #3b82f6)',
};

export default function AuditPanel({ openGenerate }) {
  const auditResults = useSimulationStore((s) => s.auditResults);
  const lastRun = useSimulationStore((s) => s.lastRunTimestamp);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'maps' | 'sprites'
  const mapReports = useSimulationStore((s) => s.mapReports);

  const [sortField, setSortField] = useState('severity');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterType, setFilterType] = useState('');

  const issueTypes = useMemo(() => [...new Set(auditResults.map((r) => r.issueType))], [auditResults]);

  const sorted = useMemo(() => {
    let list = filterType ? auditResults.filter((r) => r.issueType === filterType) : auditResults;

    list = [...list].sort((a, b) => {
      if (sortField === 'severity') {
        const diff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
        return sortAsc ? diff : -diff;
      }
      const aVal = (a[sortField] || '').toString().toLowerCase();
      const bVal = (b[sortField] || '').toString().toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return list;
  }, [auditResults, sortField, sortAsc, filterType]);

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Only the three collections the store actually holds can be selected. A row
  // about a Recipe or from the simulator names something the editor router has
  // no screen for, and jumping there would replace the editor with "Unknown
  // entity type".
  const SELECTABLE = ['item', 'token', 'map'];

  const handleRowClick = (issue) => {
    if (!issue.entityType || !issue.entityId) return;
    const type = issue.entityType.toLowerCase();
    if (SELECTABLE.includes(type)) setActiveEntity(issue.entityId, type);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Switcher */}
      <div className="flex gap-4 border-b mb-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <button
          onClick={() => setActiveTab('audit')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'audit' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Audit Issues
          {auditResults.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 font-mono">
              {auditResults.length}
            </span>
          )}
          {activeTab === 'audit' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />
          )}
        </button>
        <button
          onClick={() => setActiveTab('maps')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'maps' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Map Economics
          {mapReports.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 font-mono">
              {mapReports.filter((m) => m.pass === false).length}/{mapReports.filter((m) => !m.skipped).length}
            </span>
          )}
          {activeTab === 'maps' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sprites')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'sprites' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Sprite Audit
          {activeTab === 'sprites' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />
          )}
        </button>
      </div>

      {activeTab === 'sprites' ? (
        <SpriteAuditDashboard />
      ) : activeTab === 'maps' ? (
        <MapEconomicsTable reports={mapReports} lastRun={lastRun} />
      ) : !lastRun ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ color: 'var(--color-text-muted)' }}>
          <Calculator size={36} className="text-gray-600" />
          <p className="text-base font-semibold">No economy recalculation run yet</p>
          <p className="text-xs max-w-sm text-center">
            Click <strong>"Recalculate"</strong> in the top bar to run the economic simulator — it picks every cycle time from its Tempo band, elects one anchor source per item, derives item values, and audits the graph.
          </p>
        </div>
      ) : (
        <>
        <ChurnReport />
        <AnchorElections />
        <AuditListView
          auditResults={auditResults}
          issueTypes={issueTypes}
          sorted={sorted}
          sortField={sortField}
          sortAsc={sortAsc}
          filterType={filterType}
          setFilterType={setFilterType}
          toggleSort={toggleSort}
          handleRowClick={handleRowClick}
          openGenerate={openGenerate}
          lastRun={lastRun}
        />
        </>
      )}
    </div>
  );
}

/**
 * The Map table (plan §13.6, phase P7) — the Map check's whole verdict.
 *
 * One row per Map: its **derived** level (the pool-share-weighted mean of what
 * its entries ask of a hero), what it costs, what its burst scraps for against
 * the scrap bound, what its burst earns against the productive bound, and
 * pass/fail.
 *
 * ⚠️ **This is a read-out, not a lever.** Every input to the check is authored
 * — the price, the materials, the pool, each entry's rarity tag, each Token's
 * charges — so a failing Map is a refusal on the Audit Issues tab naming the
 * gap and the remedies, never a number this screen quietly moved.
 *
 * It lives here, beside the audit rows it explains, because that is where a
 * designer already goes after a Recalculate. (The panel itself was unrouted
 * until P6 gave it the Economy Audit tab.)
 */
function MapEconomicsTable({ reports, lastRun }) {
  if (!lastRun || reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ color: 'var(--color-text-muted)' }}>
        <MapIcon size={36} className="text-gray-600" />
        <p className="text-base font-semibold">No Map check run yet</p>
        <p className="text-xs max-w-sm text-center">
          Click <strong>"Recalculate"</strong> in the top bar. The Map check prices every pool
          entry out of its Map's scrap budget and asks whether the burst pays for itself.
        </p>
      </div>
    );
  }

  const gold = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '—');
  const cell = { padding: '6px 10px', borderBottom: '1px solid var(--color-border-subtle)' };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="mb-3">
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Map Economics</h2>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          A burst is priced twice: what it scraps for, and what it earns if it is used. Both
          bounds move with the Map's derived level. Guild-hall Maps are skipped — they drop a
          scripted tutorial sequence, not a weighted burst.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <strong>In reach</strong> is the pacing ladder (§13.2, P8): the earliest day a player
          on the Pace dials' curves could have earned this Map's cost, at the assumed hours per
          day. Gross income with no spending — read it as an ordering, and nudge a price until
          the ladder lands where you want the progression to feel.
        </p>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead className="sticky top-0" style={{ background: 'var(--color-bg-surface)' }}>
            <tr style={{ color: 'var(--color-text-muted)' }}>
              <th style={{ ...cell, textAlign: 'left' }}>Map</th>
              <th style={{ ...cell, textAlign: 'right' }}>Level</th>
              <th style={{ ...cell, textAlign: 'right' }}>Cost</th>
              <th style={{ ...cell, textAlign: 'right' }}>In reach</th>
              <th style={{ ...cell, textAlign: 'right' }}>Scrap</th>
              <th style={{ ...cell, textAlign: 'right' }}>Bound</th>
              <th style={{ ...cell, textAlign: 'right' }}>Productive</th>
              <th style={{ ...cell, textAlign: 'right' }}>Bound</th>
              <th style={{ ...cell, textAlign: 'left' }}>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((m) => {
              if (m.skipped) {
                return (
                  <tr key={m.id} style={{ color: 'var(--color-text-muted)' }}>
                    <td style={cell}>{m.name}</td>
                    <td style={{ ...cell, textAlign: 'center' }} colSpan={8}>
                      skipped — {m.skipped === 'guild-hall' ? 'guild-hall Maps drop a scripted sequence' : 'the pool is empty'}
                    </td>
                  </tr>
                );
              }
              const verdict = m.pass
                ? 'pass'
                : [m.scrapRich && 'scrap-rich', m.underwater && 'underwater'].filter(Boolean).join(' · ');
              return (
                <tr key={m.id} style={{ color: 'var(--color-text-secondary)' }}>
                  <td style={cell}>{m.name}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.level.toFixed(0)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{gold(m.cost)}g</td>
                  <td style={{ ...cell, textAlign: 'right', color: 'var(--color-text-muted)' }}>
                    {Number.isFinite(m.dayInReach) ? `day ${m.dayInReach.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: m.scrapRich ? SEVERITY_COLORS.Warning : undefined }}>{gold(m.scrapSide)}g</td>
                  <td style={{ ...cell, textAlign: 'right', color: 'var(--color-text-muted)' }}>{gold(m.scrapBound)}g</td>
                  <td style={{ ...cell, textAlign: 'right', color: m.underwater ? SEVERITY_COLORS.Warning : undefined }}>{gold(m.productiveSide)}g</td>
                  <td style={{ ...cell, textAlign: 'right', color: 'var(--color-text-muted)' }}>{gold(m.productiveBound)}g</td>
                  <td style={{ ...cell, color: m.pass ? 'var(--color-success, #10b981)' : SEVERITY_COLORS.Warning }}>{verdict}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
        Every failing Map has a matching row on the Audit Issues tab with its remedies. Nothing
        here is adjusted for you: a Map's price, pool and rarity tags are all authored.
      </p>
    </div>
  );
}

/**
 * The churn report (plan §15.2, phase P6) — the Dashboard zone's first tenant.
 *
 * After every Recalculate: how many values moved, the largest movers, which
 * sources the lever policy re-tuned, and which refusals are new or cleared
 * since the previous run. This is criterion 6 — *adding one Token must not
 * silently re-price half the game* — made visible; without it that promise is
 * only a claim.
 *
 * ⚠️ The first run of a session has nothing to diff against, so it reports a
 * refusal *total* and claims nothing new. That is stated on screen rather than
 * left for someone to wonder about.
 */
function ChurnReport() {
  const churn = useSimulationStore((s) => s.churnReport);
  if (!churn) return null;

  return (
    <div
      className="rounded-lg border p-3 mb-4"
      style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}
    >
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
        Churn — what the last Recalculate changed
      </h3>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <span><strong style={{ color: 'var(--color-text-primary)' }}>{churn.valuesChanged}</strong> values changed</span>
        <span><strong style={{ color: 'var(--color-text-primary)' }}>{churn.itemsPriced}</strong> items priced</span>
        <span><strong style={{ color: 'var(--color-text-primary)' }}>{churn.tuned.length}</strong> sources re-tuned</span>
        <span><strong style={{ color: 'var(--color-text-primary)' }}>{churn.refusals.total}</strong> refusals</span>
        {churn.refusals.new.length > 0 && (
          <span style={{ color: 'var(--color-warning, #f59e0b)' }}>{churn.refusals.new.length} new</span>
        )}
        {churn.refusals.cleared.length > 0 && (
          <span style={{ color: 'var(--color-success, #10b981)' }}>{churn.refusals.cleared.length} cleared</span>
        )}
      </div>

      {churn.largestMovers.length > 0 && (
        <div className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold">Largest movers: </span>
          {churn.largestMovers.map((m) => `${m.itemId} ${m.from ?? '—'}g → ${m.to ?? '—'}g`).join('  ·  ')}
        </div>
      )}

      {churn.tuned.length > 0 && (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold">Re-tuned: </span>
          {churn.tuned.map((t) => `${t.name} (${t.diff})`).join('  ·  ')}
        </div>
      )}
    </div>
  );
}

function AuditListView({
  auditResults,
  issueTypes,
  sorted,
  sortField,
  sortAsc,
  filterType,
  setFilterType,
  toggleSort,
  handleRowClick,
  openGenerate,
  lastRun,
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Economy Audit Results
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {auditResults.length} issues identified • Last calculation: {new Date(lastRun).toLocaleTimeString()}
          </p>
          {/* The Dashboard caption (plan §14/§15.2): what a severity means here,
              so a row reads as an instruction rather than as a complaint. */}
          <p className="text-[10px] max-w-xl leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            <strong>Critical</strong> is content the simulator could not price at all;{' '}
            <strong>Warning</strong> is priced but outside its band, with the levers exhausted;{' '}
            <strong>Info</strong> is judgement the simulator exercised and thought you should see.
            Every row names the tag or the dial to change next — nothing here is a number to type.
          </p>
        </div>
        {/* Filter chips */}
        <div className="flex items-center gap-1">
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          <button
            onClick={() => setFilterType('')}
            className="px-2 py-1 rounded text-xs"
            style={{
              background: !filterType ? 'var(--color-accent)' : 'var(--color-bg-surface)',
              color: !filterType ? 'white' : 'var(--color-text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {issueTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: filterType === type ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                color: filterType === type ? 'white' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-surface)' }}>
              {['entityName', 'entityType', 'issueType', 'severity', 'details'].map((field) => (
                <th
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer select-none"
                  style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <span className="flex items-center gap-1">
                    {field === 'entityName'
                      ? 'Entity'
                      : field === 'entityType'
                      ? 'Type'
                      : field === 'issueType'
                      ? 'Category'
                      : field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field && <ArrowUpDown size={10} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, i) => (
              <tr
                key={i}
                onClick={() => handleRowClick(issue)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {issue.entityName}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {issue.entityType}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {issue.issueType}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      color: SEVERITY_COLORS[issue.severity],
                      background: `${SEVERITY_COLORS[issue.severity]}15`,
                    }}
                  >
                    {issue.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {issue.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-success, #10b981)' }}>
            <p className="text-sm font-medium">✅ All items, tokens, and recipes are connected and valid!</p>
          </div>
        )}
      </div>
    </div>
  );
}
