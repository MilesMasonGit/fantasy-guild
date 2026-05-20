import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TYPE_COLORS = {
  item: { bg: '#60a5fa20', border: '#60a5fa', text: '#60a5fa' },
  task: { bg: '#34d39920', border: '#34d399', text: '#34d399' },
  enemy: { bg: '#f8717120', border: '#f87171', text: '#f87171' },
};

function EntityNode({ data }) {
  const colors = TYPE_COLORS[data.entityType] || TYPE_COLORS.item;

  return (
    <div style={{
      background: 'var(--color-bg-elevated)',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '8px 12px',
      minWidth: 140,
      fontSize: 12,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: colors.border }} />
      <Handle type="source" position={Position.Right} style={{ background: colors.border }} />

      <div className="flex items-center gap-2 mb-1">
        <span>{data.icon}</span>
        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{data.label}</span>
      </div>

      <div className="flex gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {data.trueCost != null && data.trueCost > 0 && <span>{data.trueCost} GP</span>}
        {data.ev != null && <span>EV: {data.ev.toFixed(2)}</span>}
        {data.targetEV != null && !data.ev && <span>Target: {data.targetEV}</span>}
        {data.tier != null && <span>T{data.tier}</span>}
      </div>
    </div>
  );
}

export default memo(EntityNode);
