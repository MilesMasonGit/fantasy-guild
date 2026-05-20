import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import EntitySelect from '../shared/EntitySelect';
import { ITEM_TYPES, EQUIP_SLOTS, RESTORE_TYPES, PERSONALITY_TAGS } from '../../utils/constants';
import { Trash2, Plus, Star, Lock, Unlock, Settings2, Ghost, ArrowRight, Search, X, Swords } from 'lucide-react';
import { useState } from 'react';

export default function RecipeEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const recipe = useEntityStore((s) => s.recipes[activeId]);
  const updateRecipe = useEntityStore((s) => s.updateRecipe);
  const deleteRecipe = useEntityStore((s) => s.deleteRecipe);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const subskills = useEntityStore((s) => s.subskills);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const proposals = useSimulationStore((s) => s.proposals);
  const recipeUpdates = useSimulationStore((s) => s.recipeUpdates) || {};
  const recipeProposals = proposals?.recipes || {};
  const [tagSearch, setTagSearch] = useState('');

  if (!recipe) return <Empty text="Select a recipe from the sidebar to edit" />;

  const update = (key, value) => updateRecipe(activeId, { [key]: value });

  const addInput = () => update('inputs', [...recipe.inputs, { id: '', quantity: 1 }]);
  const removeInput = (i) => update('inputs', recipe.inputs.filter((_, idx) => idx !== i));
  const updateInput = (i, patch) => update('inputs', recipe.inputs.map((inp, idx) => idx === i ? { ...inp, ...patch } : inp));

  const addOutput = () => update('outputs', [...recipe.outputs, { id: '', quantity: 1, chance: 1, isPrimaryOutput: false }]);
  const removeOutput = (i) => update('outputs', recipe.outputs.filter((_, idx) => idx !== i));
  const updateOutput = (i, patch) => update('outputs', recipe.outputs.map((out, idx) => idx === i ? { ...out, ...patch } : out));

  const toggleFieldLock = (field) => {
    const fieldLocks = recipe.fieldLocks || { quantity: false, xpAwarded: false };
    update('fieldLocks', { ...fieldLocks, [field]: !fieldLocks[field] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header icon="📜" name={recipe.name} id={recipe.id} onDelete={() => { deleteRecipe(activeId); clearActive(); }} />

      {/* Core Fields */}
      <Section title="Configuration" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input type="text" value={recipe.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></Field>
          <Field label="Subskill">
            <select value={recipe.subskillId} onChange={(e) => update('subskillId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(subskills).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Entity Tags" className="col-span-2">
            <div className="space-y-3">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors">
                  <Search size={14} />
                </div>
                <input 
                  type="text"
                  placeholder="Search or Create Tags..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagSearch.trim()) {
                      const newTag = tagSearch.trim();
                      if (!(recipe.tags || []).includes(newTag)) {
                        update('tags', [...(recipe.tags || []), newTag]);
                      }
                      setTagSearch('');
                    }
                  }}
                  className="w-full pl-10 pr-4 h-9 bg-black/40 border-white/5 rounded-xl focus:border-emerald-500/50 outline-none font-medium placeholder:text-gray-600 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(recipe.tags || []).map(t => (
                  <button
                    key={t}
                    onClick={() => update('tags', (recipe.tags || []).filter(x => x !== t))}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                  >
                    {t} <X size={10} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                {PERSONALITY_TAGS
                  .filter(t => !(recipe.tags || []).includes(t))
                  .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                  .slice(0, 8)
                  .map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        update('tags', [...(recipe.tags || []), t]);
                        setTagSearch('');
                      }}
                      className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-gray-500 hover:text-gray-300 transition-all"
                    >
                      + {t}
                    </button>
                  ))}
              </div>
            </div>
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
              onClick={() => update('autoBalance', !recipe.autoBalance)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${recipe.autoBalance ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-400'}`}
            >
              {recipe.autoBalance ? 'ENABLED' : 'DISABLED'}
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
                  value={recipe.profitSplit?.item ?? 0.8} 
                  onChange={(e) => update('profitSplit', { item: Number(e.target.value), xp: 1 - Number(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <span>Item: {Math.round((recipe.profitSplit?.item ?? 0.8) * 100)}%</span>
                  <span>XP: {Math.round((recipe.profitSplit?.xp ?? 0.2) * 100)}%</span>
                </div>
              </div>
            </Field>
            <Field label="Target EV (Manual Override)">
              <input type="number" step="0.01" value={recipe.targetEV} onChange={(e) => update('targetEV', Number(e.target.value))} className="w-full" />
            </Field>
          </div>
        </div>
      </Section>

      {/* Diagnostics */}
      <Section title="Live Diagnostics">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
             <Diag label="Current EV" value={recipe.calculatedEV} color="var(--color-success)" />
             {(recipeProposals[activeId] || recipeUpdates[activeId]) && (
               <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold px-1">
                  <Ghost size={10} /> Proposed: {recipeProposals[activeId]?.targetEV || recipeUpdates[activeId]?.calculatedEV || recipe.targetEV}
               </div>
             )}
          </div>
          <Diag label="GP/min" value={recipe.goldPerMinute} color="var(--color-item)" />
          <Diag label="XP/min" value={recipe.xpPerMinute} color="var(--color-quest)" />
          <div className="space-y-1">
            <Diag label="XP Given" value={recipeUpdates[activeId]?.xpAwarded ?? recipe.xpAwarded} color="var(--color-quest)" />
            {recipeProposals[activeId]?.xpAwarded && (
               <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold px-1">
                  <Ghost size={10} /> Proposed: {recipeProposals[activeId].xpAwarded}
               </div>
            )}
          </div>
        </div>
      </Section>



      {/* Effort */}
      <Section title="Effort Requirements">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Level Requirement"><input type="number" min={1} max={99} value={recipe.levelRequirement} onChange={(e) => update('levelRequirement', Number(e.target.value))} className="w-full" /></Field>
          <Field label="Tick Time (s)">
            <input 
              type="number" 
              step="0.1" 
              value={recipe.baseTickTime / 1000} 
              onChange={(e) => update('baseTickTime', Math.round(Number(e.target.value) * 1000))} 
              className="w-full" 
            />
          </Field>
          <Field label="Energy Cost"><input type="number" value={recipe.energyCost} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full" /></Field>
          <div className="flex items-end gap-2">
            <Field label="XP Awarded" className="flex-1">
              <input 
                type="number" 
                value={recipe.xpAwarded} 
                onChange={(e) => update('xpAwarded', Number(e.target.value))} 
                className={`w-full ${recipe.fieldLocks?.xpAwarded ? 'opacity-50 pointer-events-none' : ''}`} 
              />
            </Field>
            <button 
              onClick={() => toggleFieldLock('xpAwarded')}
              className={`mb-1 p-2 rounded ${recipe.fieldLocks?.xpAwarded ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500'}`}
            >
              {recipe.fieldLocks?.xpAwarded ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        </div>
      </Section>


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
function Field({ label, children }) { return <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">{label}</label>{children}</div>; }
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
        <Trash2 size={14} /> DELETE RECIPE
      </button>
    </div>
  );
}
function Empty({ text }) { return <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4"><div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-2xl opacity-50">📜</div><p className="text-sm">{text}</p></div>; }
