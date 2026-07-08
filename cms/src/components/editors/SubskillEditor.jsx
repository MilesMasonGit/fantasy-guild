import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import { slugify } from '../../utils/idGenerator';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';

export default function SubskillEditor({ openGenerate }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const subskill = useEntityStore((s) => s.subskills[activeId]);
  const updateSubskill = useEntityStore((s) => s.updateSubskill);
  const deleteSubskill = useEntityStore((s) => s.deleteSubskill);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const tasks = useEntityStore((s) => s.tasks);
  const stations = useEntityStore((s) => s.stations);

  if (!subskill) return <Empty text="Select a subskill from the sidebar to edit" />;

  const update = (key, value) => updateSubskill(activeId, { [key]: value });

  // Find where this subskill is used
  const usedInTasks = Object.values(tasks).filter(t => t.subskill === subskill.id);
  const usedInStations = Object.values(stations).filter(w => w.subskillId === subskill.id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header 
        icon="🎓" 
        name={subskill.name} 
        id={subskill.id} 
        onDelete={() => { deleteSubskill(activeId); clearActive(); }} 
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'subskill',
          name: subskill.name,
        }) : null}
      />

      {/* Core Fields */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name">
            <input type="text" value={subskill.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          
          <IdSyncField entity={subskill} entityType="subskill" onUpdate={update} />

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
              className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
            />
            <div className="flex flex-col ml-2">
              <label htmlFor="isRecipeSkill" className="text-xs font-bold text-white select-none cursor-pointer">
                Is Recipe Skill
              </label>
              <span className="text-[9px] text-gray-400 leading-normal mt-0.5">
                Check this if this subskill is used at a Station to craft Recipes (e.g. Smelting or Alchemy).
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* Usage References */}
      <Section title="Usage References">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold mb-2 text-gray-400">Stations using this Subskill ({usedInStations.length})</h4>
            {usedInStations.length === 0 ? (
              <p className="text-xs text-gray-600">No stations assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usedInStations.map(w => (
                  <span key={w.id} className="text-xs px-2 py-1 rounded bg-black/40 border border-white/5 text-gray-300">
                    {w.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-2 text-gray-400">Tasks using this Subskill ({usedInTasks.length})</h4>
            {usedInTasks.length === 0 ? (
              <p className="text-xs text-gray-600">No tasks assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usedInTasks.map(t => (
                  <span key={t.id} className="text-xs px-2 py-1 rounded bg-black/40 border border-white/5 text-gray-300">
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
