import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import { Trash2 } from 'lucide-react';

export default function SubskillEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const subskill = useEntityStore((s) => s.subskills[activeId]);
  const updateSubskill = useEntityStore((s) => s.updateSubskill);
  const deleteSubskill = useEntityStore((s) => s.deleteSubskill);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const tasks = useEntityStore((s) => s.tasks);
  const workstations = useEntityStore((s) => s.workstations);

  if (!subskill) return <Empty text="Select a subskill from the sidebar to edit" />;

  const update = (key, value) => updateSubskill(activeId, { [key]: value });

  // Find where this subskill is used
  const usedInTasks = Object.values(tasks).filter(t => t.subskill === subskill.id);
  const usedInWorkstations = Object.values(workstations).filter(w => w.subskillId === subskill.id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header icon="🎓" name={subskill.name} id={subskill.id} onDelete={() => { deleteSubskill(activeId); clearActive(); }} />

      {/* Core Fields */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input type="text" value={subskill.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></Field>
          <Field label="Parent Skill">
            <select value={subskill.parentSkill} onChange={(e) => update('parentSkill', e.target.value)} className="w-full">
              {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2 flex items-center gap-2 mt-2">
            <input 
              type="checkbox" 
              id="isRecipeSkill"
              checked={subskill.isRecipeSkill} 
              onChange={(e) => update('isRecipeSkill', e.target.checked)} 
            />
            <label htmlFor="isRecipeSkill" className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
              Is Recipe Skill
            </label>
            <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
              (Check this if this subskill is used at a Workstation to craft Recipes, e.g., Smelting or Alchemy)
            </span>
          </div>
        </div>
      </Section>

      {/* Usage References */}
      <Section title="Usage References">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Workstations using this Subskill ({usedInWorkstations.length})</h4>
            {usedInWorkstations.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No workstations assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usedInWorkstations.map(w => (
                  <span key={w.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
                    {w.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Tasks using this Subskill ({usedInTasks.length})</h4>
            {usedInTasks.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No tasks assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usedInTasks.map(t => (
                  <span key={t.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
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
