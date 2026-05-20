import React, { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Trash2, Plus } from 'lucide-react';

export default function LootTableEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const lootTable = useEntityStore((s) => s.lootTables[activeId]);
  const updateLootTable = useEntityStore((s) => s.updateLootTable);
  const deleteLootTable = useEntityStore((s) => s.deleteLootTable);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const items = useEntityStore((s) => s.items);

  const [newItemId, setNewItemId] = useState('');

  if (!lootTable) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}><p className="text-sm">Select a loot table to edit</p></div>;

  const update = (key, value) => updateLootTable(activeId, { [key]: value });

  const addEntry = () => {
    if (!newItemId) return;
    const entries = [...(lootTable.entries || [])];
    if (!entries.find(e => e.itemId === newItemId)) {
      entries.push({ itemId: newItemId, dropWeight: 1 });
      update('entries', entries);
    }
    setNewItemId('');
  };

  const updateEntryWeight = (itemId, weight) => {
    const entries = (lootTable.entries || []).map(e => 
      e.itemId === itemId ? { ...e, dropWeight: weight } : e
    );
    update('entries', entries);
  };

  const removeEntry = (itemId) => {
    const entries = (lootTable.entries || []).filter(e => e.itemId !== itemId);
    update('entries', entries);
  };

  const totalWeight = (lootTable.entries || []).reduce((sum, e) => sum + (e.dropWeight || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎲</span>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{lootTable.name}</h2>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{lootTable.id}</span>
          </div>
        </div>
        <button onClick={() => { deleteLootTable(activeId); clearActive(); }} className="btn-ghost flex items-center gap-1" style={{ color: 'var(--color-error)' }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <S title="Configuration">
        <div className="grid grid-cols-1 gap-3">
          <F label="Name">
            <input type="text" value={lootTable.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </F>
          <F label="Description">
            <input type="text" value={lootTable.description || ''} onChange={(e) => update('description', e.target.value)} className="w-full" />
          </F>
        </div>
      </S>

      <S title={`Pool Entries (Total Weight: ${totalWeight})`}>
        <div className="space-y-3">
          {(lootTable.entries || []).map((entry) => {
            const item = items[entry.itemId];
            const chance = totalWeight > 0 ? ((entry.dropWeight / totalWeight) * 100).toFixed(1) : 0;
            return (
              <div key={entry.itemId} className="flex items-center gap-3 p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]">
                <div className="flex-1 flex items-center gap-2">
                  <span>{item?.icon || '❓'}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item?.name || 'Unknown Item'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Weight:</span>
                  <input 
                    type="number" 
                    value={entry.dropWeight} 
                    onChange={(e) => updateEntryWeight(entry.itemId, Number(e.target.value))}
                    className="w-20 py-1 px-2 text-sm"
                    min="1"
                  />
                  <div className="w-16 text-right text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {chance}%
                  </div>
                  <button onClick={() => removeEntry(entry.itemId)} className="p-1 rounded hover:bg-white/5 text-[var(--color-error)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
            <select value={newItemId} onChange={(e) => setNewItemId(e.target.value)} className="flex-1 text-sm py-1.5">
              <option value="">Select an item to add...</option>
              {Object.values(items).map(item => (
                <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
              ))}
            </select>
            <button onClick={addEntry} disabled={!newItemId} className="btn-primary py-1.5 px-3 flex items-center gap-1 text-sm">
              <Plus size={14} /> Add to Pool
            </button>
          </div>
        </div>
      </S>
    </div>
  );
}

function S({ title, children }) { return <section className="rounded-lg p-4 border space-y-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}><h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>{children}</section>; }
function F({ label, children }) { return <div><label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>{children}</div>; }
