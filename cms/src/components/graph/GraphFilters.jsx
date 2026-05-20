import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';

export default function GraphFilters({ filters, onFiltersChange }) {
  const areas = useEntityStore((s) => s.areas);
  const items = useEntityStore((s) => s.items);

  const update = (key, value) => {
    const next = { ...filters, [key]: value || undefined };
    // Clean undefined keys
    Object.keys(next).forEach((k) => { if (!next[k]) delete next[k]; });
    onFiltersChange(next);
  };

  return (
    <div className="flex items-center gap-3 mb-3 flex-wrap">
      <label className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Filters:</label>

      <select value={filters.areaId || ''} onChange={(e) => update('areaId', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
        <option value="">All Areas</option>
        {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <select value={filters.skill || ''} onChange={(e) => update('skill', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
        <option value="">All Skills</option>
        {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select value={filters.supplyChainItemId || ''} onChange={(e) => update('supplyChainItemId', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
        <option value="">No Supply Chain</option>
        {Object.values(items).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>

      {Object.keys(filters).length > 0 && (
        <button onClick={() => onFiltersChange({})} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>
          Clear All
        </button>
      )}
    </div>
  );
}
