import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { SKILLS, PERSONALITY_TAGS } from '../../utils/constants';
import EntitySelect from '../shared/EntitySelect';
import { Trash2, Plus, Star, Lock, Unlock, Settings2, Ghost, ArrowRight, Search, X, Swords } from 'lucide-react';
import { useState } from 'react';

export default function TaskEditor() {
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
      <Header icon="⚔️" name={task.name} id={task.id} onDelete={() => { deleteTask(activeId); clearActive(); }} />

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

        </div>
      </Section>

      {/* Balancing Controls */}
      <Section title="Economic Balancing" icon={<Settings2 size={14} />}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
            <div>
              <h4 className="text-sm font-bold text-white">Auto-Balance Engine</h4>
              <p className="text-xs text-gray-400">Allow the solver to suggest value tweaks to hit Target EV.</p>
            </div>
            <button 
              onClick={() => update('autoBalance', !task.autoBalance)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${task.autoBalance ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-400'}`}
            >
              {task.autoBalance ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Profit Split (Item vs XP)">
              <div className="flex flex-col gap-2">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={task.profitSplit?.item ?? 0.8} 
                  onChange={(e) => update('profitSplit', { item: Number(e.target.value), xp: 1 - Number(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <span>Item: {Math.round((task.profitSplit?.item ?? 0.8) * 100)}%</span>
                  <span>XP: {Math.round((task.profitSplit?.xp ?? 0.2) * 100)}%</span>
                </div>
              </div>
            </Field>
            <Field label="Target EV (Manual Override)">
              <input type="number" step="0.01" value={task.targetEV} onChange={(e) => update('targetEV', Number(e.target.value))} className="w-full" />
            </Field>
          </div>
        </div>
      </Section>

      {/* Diagnostics */}
      <Section title="Live Diagnostics">
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
             <Diag label="Current EV" value={task.calculatedEV} color="var(--color-success)" />
             {taskProposals[activeId] && (
               <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold px-1">
                  <Ghost size={10} /> Proposed: {taskProposals[activeId].targetEV || task.targetEV}
               </div>
             )}
          </div>
          <Diag label="GP/min" value={task.goldPerMinute} color="var(--color-item)" />
          <Diag label="XP/min" value={task.xpPerMinute} color="var(--color-quest)" />
          <Diag label="XP Given" value={taskUpdates[activeId]?.xpAwarded ?? task.xpAwarded} color="var(--color-quest)" />
        </div>
      </Section>

      {/* Effort */}
      {!isEncounterOnly && (
        <Section title="Effort & Requirements">
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Energy Cost"><input type="number" value={task.energyCost} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full" /></Field>
          </div>
        </Section>
      )}




    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="rounded-xl p-5 border bg-[#1a1a1e] border-white/10 space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-gray-500">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, className = "", children }) { 
  return (
    <div className={className}>
      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">{label}</label>
      {children}
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

function Header({ icon, name, id, onDelete }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-3xl border border-white/10">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-white">{name}</h2>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">{id}</span>
        </div>
      </div>
      <button onClick={onDelete} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-xs font-bold">
        <Trash2 size={14} /> DELETE TASK
      </button>
    </div>
  );
}

function Empty({ text }) { 
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-2xl opacity-50">⚔️</div>
      <p className="text-sm">{text}</p>
    </div>
  ); 
}
