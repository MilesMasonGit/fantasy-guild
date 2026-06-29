import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { SKILLS, PERSONALITY_TAGS } from '../../utils/constants';
import EntitySelect from '../shared/EntitySelect';
import { Trash2, Plus, Star, Lock, Unlock, Settings2, Ghost, ArrowRight, Search, X, Swords, Image, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export default function TaskEditor() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const task = useEntityStore((s) => s.tasks[activeId]);
  const updateTask = useEntityStore((s) => s.updateTask);
  const deleteTask = useEntityStore((s) => s.deleteTask);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
  const subskills = useEntityStore((s) => s.subskills);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const proposals = useSimulationStore((s) => s.proposals);
  const taskUpdates = useSimulationStore((s) => s.taskUpdates) || {};
  const taskProposals = proposals?.tasks || {};
  const [tagSearch, setTagSearch] = useState('');

  if (!task) return <Empty text="Select a task from the sidebar to edit" />;

  const update = (key, value) => updateTask(activeId, { [key]: value });
  const relevantSubskills = Object.values(subskills).filter((s) => s.parentSkill === task.skill);
  const isEncounterOnly = task.preset === 'BASIC_COMBAT' || 
                          task.cardType === 'combat' || 
                          !!task.enemyId || 
                          (task.traits && task.traits.some(t => t.type === 'combat')) ||
                          task.skill === 'combat' ||
                          (task.outputs && task.outputs.length > 0 && task.outputs.every(o => o.type === 'encounter'));

  const addInput = () => update('inputs', [...task.inputs, { id: '', quantity: 1 }]);
  const removeInput = (i) => update('inputs', task.inputs.filter((_, idx) => idx !== i));
  const updateInput = (i, patch) => update('inputs', task.inputs.map((inp, idx) => idx === i ? { ...inp, ...patch } : inp));

  const addOutput = () => update('outputs', [...task.outputs, { id: '', quantity: 1, chance: 1, isPrimaryOutput: false }]);
  const removeOutput = (i) => update('outputs', task.outputs.filter((_, idx) => idx !== i));
  const updateOutput = (i, patch) => update('outputs', task.outputs.map((out, idx) => idx === i ? { ...out, ...patch } : out));

  const toggleFieldLock = (field) => {
    const fieldLocks = task.fieldLocks || { quantity: false, xpAwarded: false };
    update('fieldLocks', { ...fieldLocks, [field]: !fieldLocks[field] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header 
        name={task.name} 
        id={task.id} 
        sprite={task.background}
        isBackground={true}
        onDelete={() => { deleteTask(activeId); clearActive(); }} 
      />


      {/* Core Configuration */}
      <Section title="Configuration" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name">
            <input type="text" value={task.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="World Area">
            <select value={task.areaId} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">Global / None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          {!isEncounterOnly && (
            <>
              <Field label="Skill">
                <select value={task.skill} onChange={(e) => update('skill', e.target.value)} className="w-full">
                  {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Subskill">
                <select value={task.subskill || ''} onChange={(e) => update('subskill', e.target.value)} className="w-full">
                  <option value="">None / Base</option>
                  {relevantSubskills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Skill Level Requirement">
                <input type="number" min={1} max={99} value={task.skillRequirement || 1} onChange={(e) => update('skillRequirement', Number(e.target.value))} className="w-full" />
              </Field>
              <Field label="Energy Cost">
                <input type="number" value={task.energyCost} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full" /></Field>
              <Field label="Tick Time (s)">
                <input 
                  type="number" 
                  step="0.1" 
                  value={task.baseTickTime / 1000} 
                  onChange={(e) => update('baseTickTime', Math.round(Number(e.target.value) * 1000))} 
                  className="w-full" 
                />
              </Field>
              <div className="flex flex-col gap-1">
                 <div className="flex items-end gap-2">
                    <Field label="XP Awarded" className="flex-1">
                      <input 
                        type="number" 
                        value={task.xpAwarded} 
                        onChange={(e) => update('xpAwarded', Number(e.target.value))} 
                        className={`w-full ${task.fieldLocks?.xpAwarded ? 'opacity-50 pointer-events-none' : ''}`} 
                      />
                    </Field>
                    <button 
                      onClick={() => toggleFieldLock('xpAwarded')}
                      className={`mb-1 p-2 rounded ${task.fieldLocks?.xpAwarded ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500'}`}
                      title="Lock XP field from solver"
                    >
                      {task.fieldLocks?.xpAwarded ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                 </div>
                 {taskProposals[activeId]?.xpAwarded && (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold px-1">
                       <Ghost size={10} /> Proposed: {taskProposals[activeId].xpAwarded}
                     </div>
                  )}
              </div>
            </>
          )}

          <Field label="Sprite Reference" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-16 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(() => {
                  const resolvedPath = task.background ? resolveSpritePath(task.background) : null;
                  if (resolvedPath) {
                    const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
                    return (
                      <>
                        <img 
                          src={imgSrc} 
                          className="w-full h-full object-cover pixel-art animate-fade-in" 
                          alt="Sprite" 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fb = e.target.nextElementSibling;
                            if (fb) fb.style.display = 'block';
                          }} 
                        />
                        <HelpCircle size={16} className="text-gray-600" style={{ display: 'none' }} />
                      </>
                    );
                  }
                  return <HelpCircle size={16} className="text-gray-600" />;
                })()}
              </div>
              <input 
                type="text" 
                value={task.background || ''} 
                onChange={(e) => update('background', e.target.value)} 
                placeholder="sprite_id or assets/..." 
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 h-10" 
              />
              <button 
                type="button" 
                onClick={() => setIsPickerOpen(true)}
                className="btn-ghost px-3 h-10 border border-white/10 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
              >
                <Image size={14} /> Choose Sprite
              </button>
            </div>
          </Field>
        </div>
      </Section>

      {/* Diagnostics */}
      <Section title="Live Diagnostics">
        <div className="grid grid-cols-4 gap-3">
          <Diag label="Current EV" value={task.calculatedEV} color="var(--color-success)" />
          <Diag label="GP/min" value={task.goldPerMinute} color="var(--color-item)" />
          <Diag label="XP/min" value={task.xpPerMinute} color="var(--color-quest)" />
          <Diag label="XP Given" value={taskUpdates[activeId]?.xpAwarded ?? task.xpAwarded} color="var(--color-quest)" />
        </div>
      </Section>






      {isPickerOpen && (
        <SpritePickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(spriteKey) => update('background', spriteKey)}
        />
      )}
    </div>
  );
}

function Diag({ label, value, color }) {
  return (
    <div>
      {label && <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-gray-500">{label}</label>}
      <div className="px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-sm font-mono text-center" style={{ color: value != null ? color : 'var(--color-text-muted)' }}>
        {value != null ? (typeof value === 'number' ? value.toFixed(2) : value) : '—'}
      </div>
    </div>
  );
}
