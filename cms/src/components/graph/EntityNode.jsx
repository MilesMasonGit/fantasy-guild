import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TYPE_COLORS = {
  item: { bg: '#60a5fa20', border: '#60a5fa', text: '#60a5fa' },
  task: { bg: '#34d39920', border: '#34d399', text: '#34d399' },
  enemy: { bg: '#f8717120', border: '#f87171', text: '#f87171' },
  recipe: { bg: '#a855f720', border: '#a855f7', text: '#a855f7' },
};

function EntityNode({ data }) {
  const colors = TYPE_COLORS[data.entityType] || TYPE_COLORS.item;

  return (
    <div style={{
      background: 'var(--color-bg-elevated)',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '8px 12px',
      minWidth: 160,
      fontSize: 12,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: colors.border }} />
      <Handle type="source" position={Position.Right} style={{ background: colors.border }} />

      <div className="flex items-center gap-2 mb-1">
        <span>{data.icon}</span>
        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{data.label}</span>
      </div>

      <div className="flex flex-col gap-0.5 text-[10px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
        {data.entityType === 'item' && (
          <div>
            <span>Cost: {data.trueCost ?? 0} GP</span>
            <span className="mx-1 opacity-40">|</span>
            <span>Sell: {data.sellPrice ?? 0} GP</span>
          </div>
        )}
        {(data.entityType === 'task' || data.entityType === 'recipe') && (
          <>
            <div>
              <span>Speed: {data.baseTickTime ? (data.baseTickTime / 1000).toFixed(1) : 0}s</span>
              <span className="mx-1 opacity-40">|</span>
              <span>Cost: ⚡{data.energyCost ?? 0}</span>
            </div>
            <div className="text-[9px] opacity-80 mt-0.5">
              <span>XP: {data.xpAwarded ?? 0} ({data.xpPerMinute ?? 0}/m)</span>
              <span className="mx-1 opacity-40">|</span>
              <span className="text-emerald-400 font-medium">{data.goldPerMinute ?? 0} GP/m</span>
            </div>
          </>
        )}
        {data.entityType === 'enemy' && (
          <div>
            <span>HP: {data.hp ?? 0}</span>
            <span className="mx-1 opacity-40">|</span>
            <span>Atk: {data.combatStat ?? 0}</span>
            <span className="mx-1 opacity-40">|</span>
            <span className="font-bold text-red-400">T{data.tier ?? 1}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(EntityNode);
