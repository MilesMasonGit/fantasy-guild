import { useEntityStore } from '../../stores/useEntityStore';
import EntitySelect from '../shared/EntitySelect';
import { Trash2, Plus } from 'lucide-react';

export default function EncounterEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const encounter = useEntityStore((s) => s.encounters[activeId]);
  const updateEncounter = useEntityStore((s) => s.updateEncounter);
  const deleteEncounter = useEntityStore((s) => s.deleteEncounter);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);

  if (!encounter) return <Empty text="Select an encounter from the sidebar to edit" />;

  const update = (key, value) => updateEncounter(activeId, { [key]: value });

  const addAssignedEnemy = () => update('assignedEnemies', [...(encounter.assignedEnemies || []), { enemyId: '', spawnChance: 1 }]);
  const removeAssignedEnemy = (i) => update('assignedEnemies', (encounter.assignedEnemies || []).filter((_, idx) => idx !== i));
  const updateAssignedEnemy = (i, patch) => update('assignedEnemies', (encounter.assignedEnemies || []).map((e, idx) => idx === i ? { ...e, ...patch } : e));

  const assignedEnemies = encounter.assignedEnemies || [];
  const totalSpawnChance = assignedEnemies.reduce((sum, e) => sum + (e.spawnChance || 0), 0);
  const isValidDeck = Math.abs(totalSpawnChance - 1) < 0.001;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header icon="⚔️" name={encounter.name} id={encounter.id} onDelete={() => { deleteEncounter(activeId); clearActive(); }} />

      {/* Diagnostics */}
      <Section title="Diagnostics (Calculated)">
        <div className="grid grid-cols-3 gap-3">
          <Diag label="Calculated EV" value={encounter.calculatedEV} color="var(--color-success)" />
          <Diag label="GP/min" value={encounter.goldPerMinute} color="var(--color-item)" />
          <Diag label="XP/min" value={encounter.xpPerMinute} color="var(--color-quest)" />
        </div>
      </Section>

      {/* Core Fields */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input type="text" value={encounter.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></Field>
          <Field label="Area">
            <select value={encounter.areaId} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Encounter Deck">
        <div className="mb-4 p-3 rounded border flex items-center justify-between" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Total Spawn Chance</span>
          <span className={`text-sm font-bold font-mono ${isValidDeck ? '' : 'text-red-400'}`} style={{ color: isValidDeck ? 'var(--color-success)' : undefined }}>
            {(totalSpawnChance * 100).toFixed(0)}%
          </span>
        </div>
        {assignedEnemies.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-1 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="flex-1">Enemy</span>
            <span className="w-20">Chance</span>
            <span className="w-4"></span>
          </div>
        )}
        {assignedEnemies.map((e, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className="flex-1">
              <EntitySelect value={e.enemyId} onChange={(id) => updateAssignedEnemy(i, { enemyId: id })} entityType="enemy" placeholder="Select an enemy..." />
            </div>
            <input type="number" step="0.01" min={0} max={1} value={e.spawnChance} onChange={(ev) => updateAssignedEnemy(i, { spawnChance: Number(ev.target.value) })} className="w-20" placeholder="%" />
            <button onClick={() => removeAssignedEnemy(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={addAssignedEnemy} className="btn-ghost flex items-center gap-1 text-xs mt-2"><Plus size={12} /> Add Enemy</button>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-lg p-4 border space-y-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
      <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children }) { return <div><label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>{children}</div>; }
function Diag({ label, value, color }) {
  return (
    <div>
      {label && <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>}
      <div className="px-3 py-1.5 rounded text-sm font-mono" style={{ background: 'var(--color-bg-base)', color: value != null ? color : 'var(--color-text-muted)' }}>
        {value != null ? (typeof value === 'number' ? value.toFixed(2) : value) : '—'}
      </div>
    </div>
  );
}
function Header({ icon, name, id, onDelete }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div><h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{name}</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{id}</span></div>
      </div>
      <button onClick={onDelete} className="btn-ghost flex items-center gap-1" style={{ color: 'var(--color-error)' }}><Trash2 size={14} /> Delete</button>
    </div>
  );
}
function Empty({ text }) { return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}><p className="text-sm">{text}</p></div>; }
