import React, { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Trash2, Plus } from 'lucide-react';

export default function EncounterTableEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const encounterTable = useEntityStore((s) => s.encounterTables[activeId]);
  const updateEncounterTable = useEntityStore((s) => s.updateEncounterTable);
  const deleteEncounterTable = useEntityStore((s) => s.deleteEncounterTable);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const encounters = useEntityStore((s) => s.encounters);

  const [newEncounterId, setNewEncounterId] = useState('');

  if (!encounterTable) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}><p className="text-sm">Select an encounter table to edit</p></div>;

  const update = (key, value) => updateEncounterTable(activeId, { [key]: value });

  const addEntry = () => {
    if (!newEncounterId) return;
    const entries = [...(encounterTable.entries || [])];
    if (!entries.find(e => e.encounterId === newEncounterId)) {
      entries.push({ encounterId: newEncounterId, dropWeight: 1 });
      update('entries', entries);
    }
    setNewEncounterId('');
  };

  const updateEntryWeight = (encounterId, weight) => {
    const entries = (encounterTable.entries || []).map(e => 
      e.encounterId === encounterId ? { ...e, dropWeight: weight } : e
    );
    update('entries', entries);
  };

  const removeEntry = (encounterId) => {
    const entries = (encounterTable.entries || []).filter(e => e.encounterId !== encounterId);
    update('entries', entries);
  };

  const totalWeight = (encounterTable.entries || []).reduce((sum, e) => sum + (e.dropWeight || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚔️</span>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{encounterTable.name}</h2>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{encounterTable.id}</span>
          </div>
        </div>
        <button onClick={() => { deleteEncounterTable(activeId); clearActive(); }} className="btn-ghost flex items-center gap-1" style={{ color: 'var(--color-error)' }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <S title="Configuration">
        <div className="grid grid-cols-1 gap-3">
          <F label="Name">
            <input type="text" value={encounterTable.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </F>
          <F label="Description">
            <input type="text" value={encounterTable.description || ''} onChange={(e) => update('description', e.target.value)} className="w-full" />
          </F>
        </div>
      </S>

      <S title={`Pool Entries (Total Weight: ${totalWeight})`}>
        <div className="space-y-3">
          {(encounterTable.entries || []).map((entry) => {
            const encounter = encounters[entry.encounterId];
            const chance = totalWeight > 0 ? ((entry.dropWeight / totalWeight) * 100).toFixed(1) : 0;
            return (
              <div key={entry.encounterId} className="flex items-center gap-3 p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]">
                <div className="flex-1 flex items-center gap-2">
                  <span>{encounter?.icon || '🚩'}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{encounter?.name || 'Unknown Encounter'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Weight:</span>
                  <input 
                    type="number" 
                    value={entry.dropWeight} 
                    onChange={(e) => updateEntryWeight(entry.encounterId, Number(e.target.value))}
                    className="w-20 py-1 px-2 text-sm"
                    min="1"
                  />
                  <div className="w-16 text-right text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {chance}%
                  </div>
                  <button onClick={() => removeEntry(entry.encounterId)} className="p-1 rounded hover:bg-white/5 text-[var(--color-error)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
            <select value={newEncounterId} onChange={(e) => setNewEncounterId(e.target.value)} className="flex-1 text-sm py-1.5">
              <option value="">Select an encounter to add...</option>
              {Object.values(encounters).map(enc => (
                <option key={enc.id} value={enc.id}>{enc.icon || '🚩'} {enc.name}</option>
              ))}
            </select>
            <button onClick={addEntry} disabled={!newEncounterId} className="btn-primary py-1.5 px-3 flex items-center gap-1 text-sm">
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
