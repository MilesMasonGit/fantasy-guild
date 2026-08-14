import { useState, useMemo } from 'react';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { ArrowUpDown, Filter, Sparkles, Calculator } from 'lucide-react';
import SpriteAuditDashboard from './SpriteAuditDashboard';

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
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'sprites'

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

  const handleRowClick = (issue) => {
    if (issue.entityType && issue.entityId && issue.entityId !== 'solver_refusal') {
      const type = issue.entityType.toLowerCase();
      setActiveEntity(issue.entityId, type);
    }
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
      ) : !lastRun ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ color: 'var(--color-text-muted)' }}>
          <Calculator size={36} className="text-gray-600" />
          <p className="text-base font-semibold">No economy recalculation run yet</p>
          <p className="text-xs max-w-sm text-center">
            Click <strong>"Recalculate"</strong> in the top bar to run the Phase 8 balance engine, solve item trueCosts, token yields, and audit the graph.
          </p>
        </div>
      ) : (
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
