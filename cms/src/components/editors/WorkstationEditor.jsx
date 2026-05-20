import { useEntityStore } from '../../stores/useEntityStore';
import { Trash2 } from 'lucide-react';

export default function WorkstationEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const workstation = useEntityStore((s) => s.workstations[activeId]);
  const updateWorkstation = useEntityStore((s) => s.updateWorkstation);
  const deleteWorkstation = useEntityStore((s) => s.deleteWorkstation);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
  const subskills = useEntityStore((s) => s.subskills);
  const recipes = useEntityStore((s) => s.recipes);

  if (!workstation) return <Empty text="Select a workstation from the sidebar to edit" />;

  const update = (key, value) => updateWorkstation(activeId, { [key]: value });

  const validRecipes = Object.values(recipes).filter((r) => r.subskillId === workstation.subskillId && r.levelRequirement <= workstation.skillCap);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header icon="🔨" name={workstation.name} id={workstation.id} onDelete={() => { deleteWorkstation(activeId); clearActive(); }} />

      {/* Core Fields */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input type="text" value={workstation.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></Field>
          <Field label="Area">
            <select value={workstation.areaId} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Subskill">
            <select value={workstation.subskillId} onChange={(e) => update('subskillId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(subskills).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Skill Cap (Max Level)"><input type="number" min={1} max={99} value={workstation.skillCap} onChange={(e) => update('skillCap', Number(e.target.value))} className="w-full" /></Field>
        </div>
      </Section>

      <Section title={`Supported Recipes (${validRecipes.length})`}>
        {validRecipes.length === 0 ? (
          <p className="text-xs text-center p-4" style={{ color: 'var(--color-text-muted)' }}>No recipes fit this workstation's subskill and skill cap.</p>
        ) : (
          <div className="space-y-2">
            {validRecipes.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded text-xs" style={{ background: 'var(--color-bg-base)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{r.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>Lv. {r.levelRequirement}</span>
                </div>
                <div className="flex gap-3">
                  <span style={{ color: 'var(--color-success)' }}>EV: {r.calculatedEV?.toFixed(2) || '—'}</span>
                  <span style={{ color: 'var(--color-item)' }}>{r.goldPerMinute?.toFixed(1) || '—'} GP/m</span>
                </div>
              </div>
            ))}
          </div>
        )}
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
