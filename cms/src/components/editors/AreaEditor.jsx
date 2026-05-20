import { useEntityStore } from '../../stores/useEntityStore';
import { Trash2 } from 'lucide-react';

export default function AreaEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const area = useEntityStore((s) => s.areas[activeId]);
  const updateArea = useEntityStore((s) => s.updateArea);
  const deleteArea = useEntityStore((s) => s.deleteArea);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const allTasks = useEntityStore((s) => s.tasks);
  const allEnemies = useEntityStore((s) => s.enemies);
  const allEncounters = useEntityStore((s) => s.quests || s.encounters || {});

  if (!area) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}><p className="text-sm">Select an area to edit</p></div>;

  const update = (key, value) => updateArea(activeId, { [key]: value });

  const assignedCards = [
    ...Object.values(allTasks || {}).map(t => ({ ...t, type: 'Task' })),
    ...Object.values(allEnemies || {}).map(e => ({ ...e, type: 'Enemy' })),
    ...Object.values(allEncounters || {}).map(enc => ({ ...enc, type: 'Encounter' }))
  ].filter(c => c.areaId === activeId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{area.icon}</span>
          <div><h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{area.name}</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{area.id}</span></div>
        </div>
        <button onClick={() => { deleteArea(activeId); clearActive(); }} className="btn-ghost flex items-center gap-1" style={{ color: 'var(--color-error)' }}><Trash2 size={14} /> Delete</button>
      </div>

      <S title="Diagnostics">
        <div className="grid grid-cols-2 gap-3">
          <D label="Expected Pack Value" value={area.expectedPackValue} color="var(--color-success)" />
          <D label="Est. Time to Purchase" value={area.estimatedTimeToPurchase} color="var(--color-quest)" />
        </div>
      </S>

      <S title="Configuration">
        <div className="grid grid-cols-2 gap-3">
          <F label="Name"><input type="text" value={area.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></F>
          <F label="Icon"><input type="text" value={area.icon} onChange={(e) => update('icon', e.target.value)} className="w-full" /></F>
          <F label="Total Fragments"><input type="number" value={area.totalFragments} onChange={(e) => update('totalFragments', Number(e.target.value))} className="w-full" /></F>
          <F label="Pack Base Cost (GP)"><input type="number" value={area.packBaseGoldCost} onChange={(e) => update('packBaseGoldCost', Number(e.target.value))} className="w-full" /></F>
          <F label="Pack Cost Scaling"><input type="number" step="0.01" value={area.packCostScaling} onChange={(e) => update('packCostScaling', Number(e.target.value))} className="w-full" /></F>
        </div>
      </S>

      <S title={`Assigned Card Pool (${assignedCards.length} cards)`}>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {assignedCards.map((card) => (
            <div key={card.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]" style={{ color: 'var(--color-text-secondary)' }}>
              <span>{card.icon || '•'}</span>
              <span className="font-medium">{card.name}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-white/5 opacity-50">{card.type}</span>
            </div>
          ))}
          {assignedCards.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
              No cards assigned to this area yet.
              <br />Assign an area in the Task, Enemy, or Encounter editors.
            </p>
          )}
        </div>
      </S>
    </div>
  );
}

function S({ title, children }) { return <section className="rounded-lg p-4 border space-y-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}><h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>{children}</section>; }
function F({ label, children }) { return <div><label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>{children}</div>; }
function D({ label, value, color }) { return <div><label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label><div className="px-3 py-1.5 rounded text-sm font-mono" style={{ background: 'var(--color-bg-base)', color: value != null ? color : 'var(--color-text-muted)' }}>{value ?? '—'}</div></div>; }
