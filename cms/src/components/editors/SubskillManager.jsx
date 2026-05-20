import { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import { Trash2, Plus } from 'lucide-react';

export default function SubskillManager() {
  const subskills = useEntityStore((s) => s.subskills);
  const addSubskill = useEntityStore((s) => s.addSubskill);
  const updateSubskill = useEntityStore((s) => s.updateSubskill);
  const deleteSubskill = useEntityStore((s) => s.deleteSubskill);
  const [newName, setNewName] = useState('');
  const [newSkill, setNewSkill] = useState('nature');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addSubskill({ name: newName.trim(), parentSkill: newSkill });
    setNewName('');
  };

  const grouped = SKILLS.map((skill) => ({
    ...skill,
    subskills: Object.values(subskills).filter((s) => s.parentSkill === skill.id),
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Subskill Manager</h2>

      {/* Add New */}
      <div className="flex items-center gap-2">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New subskill name..." className="flex-1" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <select value={newSkill} onChange={(e) => setNewSkill(e.target.value)} className="w-32">
          {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-1"><Plus size={14} /> Add</button>
      </div>

      {/* Grouped List */}
      {grouped.map((skill) => (
        <section key={skill.id} className="rounded-lg p-4 border space-y-2" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{skill.name}</h3>
          {skill.subskills.length === 0 && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No subskills yet</p>}
          {skill.subskills.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2">
              <input type="text" value={sub.name} onChange={(e) => updateSubskill(sub.id, { name: e.target.value })} className="flex-1" style={{ fontSize: 13 }} />
              <button onClick={() => deleteSubskill(sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
