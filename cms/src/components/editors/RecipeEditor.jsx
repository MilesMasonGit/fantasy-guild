import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import EntitySelect from '../shared/EntitySelect';
import { ITEM_TYPES, EQUIP_SLOTS, RESTORE_TYPES, PERSONALITY_TAGS } from '../../utils/constants';
import { 
  Trash2, Plus, Star, Lock, Unlock, Settings2, ArrowRight, Search, X, Swords,
  AlertTriangle, CheckCircle2, TrendingDown, Info, ShieldAlert, Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { calculateTaskEV } from '../../engine/evCalculator';
import { calculateTargetEV, calculateEVVariance, getVelocityTargets } from '../../engine/taskSolver';
import { slugify } from '../../utils/idGenerator';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';

export default function RecipeEditor({ openGenerate }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const recipe = useEntityStore((s) => s.recipes[activeId]);
  const updateRecipe = useEntityStore((s) => s.updateRecipe);
  const deleteRecipe = useEntityStore((s) => s.deleteRecipe);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const subskills = useEntityStore((s) => s.subskills);
  const items = useEntityStore((s) => s.items);
  const lootTables = useEntityStore((s) => s.lootTables);
  const [tagSearch, setTagSearch] = useState('');
  const globals = useGlobalStore();

  if (!recipe) return <Empty text="Select a recipe from the sidebar to edit" />;

  const update = (key, value) => updateRecipe(activeId, { [key]: value });

  const addInput = () => update('inputs', [...recipe.inputs, { id: '', quantity: 1 }]);
  const removeInput = (i) => update('inputs', recipe.inputs.filter((_, idx) => idx !== i));
  const updateInput = (i, patch) => update('inputs', recipe.inputs.map((inp, idx) => idx === i ? { ...inp, ...patch } : inp));

  const addOutput = () => update('outputs', [...recipe.outputs, { id: '', quantity: 1, chance: 1, isPrimarySource: false }]);
  const removeOutput = (i) => update('outputs', recipe.outputs.filter((_, idx) => idx !== i));
  const updateOutput = (i, patch) => update('outputs', recipe.outputs.map((out, idx) => idx === i ? { ...out, ...patch } : out));

  const toggleFieldLock = (field) => {
    const fieldLocks = recipe.fieldLocks || { quantity: false, xpAwarded: false };
    update('fieldLocks', { ...fieldLocks, [field]: !fieldLocks[field] });
  };



  // --- Real-time client-side EV and diagnostics computations ---
  const combinedGlobals = {
    ...globals,
    lootTables,
    enemyUpdates: useSimulationStore.getState().enemyUpdates || {},
  };

  const liveDiag = calculateTaskEV(recipe, items, combinedGlobals);

  const level = recipe.skillRequirement || 1;
  const targetEV = recipe.targetEV || calculateTargetEV(level);
  const variance = calculateEVVariance(level);
  
  const velocityTargets = getVelocityTargets(level, globals);
  const targetGPH = velocityTargets.gph;
  const targetXPH = velocityTargets.xph;
  const targetGPM = velocityTargets.gpm;
  const targetXPM = velocityTargets.xpm;
  
  const liveGPM = liveDiag.goldPerMinute;
  const liveGPH = liveGPM * 60;
  const liveXPM = liveDiag.xpPerMinute;
  const liveXPH = liveXPM * 60;
  const netGoldReward = liveDiag.reward.outputReward - liveDiag.cost.materialCost - liveDiag.cost.energyCost - liveDiag.cost.toolDepreciation - (liveDiag.cost.encounterCost || 0);

  const isEVWithinVariance = Math.abs(liveDiag.calculatedEV - targetEV) <= variance;
  
  let isNetGPMBalanced = true;
  if (recipe.isGoldSink) {
    isNetGPMBalanced = liveGPM <= 0;
  } else {
    isNetGPMBalanced = liveGPM >= 0 && liveGPM <= targetGPM * 1.15;
  }

  const isBalanced = isEVWithinVariance && isNetGPMBalanced;

  // Build flags & warnings
  const warnings = [];
  
  if (liveXPM > targetXPM * 1.15) {
    warnings.push({
      type: 'danger',
      message: `XP Generation is too fast (${liveXPH.toFixed(0)} XPH). Exceeds Level ${level} target (${velocityTargets.xph} XPH) by > 15%.`
    });
  }

  if (recipe.isGoldSink) {
    if (liveGPM > 0) {
      warnings.push({
        type: 'danger',
        message: `Recipe is a designated Gold Sink, but it generates net positive gold (${liveGPH.toFixed(0)} GPH). Must be negative/zero.`
      });
    }
  } else {
    if (liveGPM > targetGPM * 1.15) {
      warnings.push({
        type: 'danger',
        message: `Gold Generation is too fast (${liveGPH.toFixed(0)} GPH). Exceeds Level ${level} target (${velocityTargets.gph} GPH) by > 15%.`
      });
    } else if (liveGPM < 0) {
      warnings.push({
        type: 'warning',
        message: `Net Gold is negative (${liveGPH.toFixed(0)} GPH). Mark as 'Is Gold Sink' if this is an intentional resource sink.`
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        icon="📜"
        name={recipe.name}
        id={recipe.id}
        onDelete={() => { deleteRecipe(activeId); clearActive(); }}
        onSuggest={() => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'recipe',
          name: recipe.name,
          skill: recipe.skill || 'industry',
          levelRequirement: recipe.levelRequirement || 1,
          areaId: '',
        })}
      />

      {/* Core Configuration & Effort Requirements */}
      <Section title="Configuration & Requirements" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display Name">
            <input type="text" value={recipe.name} onChange={(e) => update('name', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50" />
          </Field>
          
          <IdSyncField entity={recipe} entityType="recipe" onUpdate={update} />
          
          <Field label="Skill">
            <select value={recipe.skill || 'industry'} onChange={(e) => update('skill', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50">
              <option value="nature">Nature</option>
              <option value="industry">Industry</option>
              <option value="culinary">Culinary</option>
              <option value="occult">Occult</option>
              <option value="crime">Crime</option>
              <option value="combat">Combat</option>
            </select>
          </Field>
          
          <Field label="Subskill">
            <select value={recipe.subskillId || ''} onChange={(e) => update('subskillId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50">
              <option value="">None / Base</option>
              {Object.values(subskills)
                .filter(s => s.parentSkill === (recipe.skill || 'industry'))
                .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label="Skill Level Requirement">
            <input 
              type="number" 
              min={1} 
              max={99} 
              value={recipe.skillRequirement || 1} 
              onChange={(e) => update('skillRequirement', Number(e.target.value))} 
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" 
            />
          </Field>

          <Field label="Energy Cost" className="col-span-2">
            <input type="number" value={recipe.energyCost || 0} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" />
          </Field>
        </div>
      </Section>

      {/* Diagnostics */}
      <Section title="Live Diagnostics" icon={<Star size={14} className="text-amber-400" />}>
        <div className="space-y-5">
          {/* Glassmorphic Balance Banner based on GPH/XPH Pacing Targets */}
          {(() => {
            const isGPHBalanced = netGoldReward <= 0 ? true : Math.abs(liveGPH - targetGPH) / targetGPH <= 0.10;
            const isXPHBalanced = Math.abs(liveXPH - targetXPH) / targetXPH <= 0.10;
            const isPacingBalanced = isGPHBalanced && isXPHBalanced;
            
            return (
              <div className={`p-4 rounded-xl border backdrop-blur-md transition-all flex items-center justify-between ${
                isPacingBalanced 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                    isPacingBalanced ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                  }`} />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider">
                      {isPacingBalanced ? 'Pacing On Target' : 'Pacing Imbalanced'}
                    </span>
                    <p className="text-[10px] opacity-75">
                      {isPacingBalanced 
                        ? `XP and GP rates align perfectly with Level ${level} targets.` 
                        : `GPH or XPH rates deviate by >10% from the pacing targets.`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black font-mono">
                    {Math.round((liveGPM / (targetGPM || 1)) * 100)}%
                  </span>
                  <p className="text-[9px] font-mono opacity-65">GP Pacing</p>
                </div>
              </div>
            );
          })()}
 
          {/* Prominent Hourly Velocities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Gold Generation Rate</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black font-mono text-white">{(liveGPM * 60).toFixed(0)}</span>
                <span className="text-xs text-gray-400 font-bold uppercase">GP/hr</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{liveGPM.toFixed(2)} GP/min</span>
                <span className={netGoldReward <= 0 ? 'text-indigo-400' : (Math.abs(liveGPH - targetGPH) / targetGPH <= 0.10 ? 'text-emerald-400' : 'text-red-400')}>
                  {netGoldReward <= 0 ? 'Cost Sink' : `${Math.round((liveGPM / (targetGPM || 1)) * 100)}% of Target`}
                </span>
              </div>
            </div>
 
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">XP Progression Rate</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black font-mono text-white">{(liveXPM * 60).toFixed(0)}</span>
                <span className="text-xs text-gray-400 font-bold uppercase">XP/hr</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{liveXPM.toFixed(2)} XP/min</span>
                <span className={Math.abs(liveXPH - targetXPH) / targetXPH <= 0.10 ? 'text-emerald-400' : 'text-red-400'}>
                  {Math.round((liveXPM / (targetXPM || 1)) * 100)}% of Target
                </span>
              </div>
            </div>
          </div>

          {/* Calculator Controlled Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-[#201d12]/40 border border-amber-500/20 space-y-1">
              <div className="flex items-center gap-1.5">
                <Settings2 size={12} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Calculated Tick Time</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black font-mono text-white">{(recipe.baseTickTime / 1000).toFixed(1)}</span>
                <span className="text-xs text-gray-400 font-bold uppercase">seconds</span>
              </div>
              <p className="text-[9px] text-gray-500 leading-tight">Dynamically paced by the engine to align with hourly GP targets.</p>
            </div>

            <div className="p-3 rounded-xl bg-[#201d12]/40 border border-amber-500/20 space-y-1">
              <div className="flex items-center gap-1.5">
                <Settings2 size={12} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Calculated XP Award</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black font-mono text-white">{recipe.xpAwarded}</span>
                <span className="text-xs text-gray-400 font-bold uppercase">XP</span>
              </div>
              <p className="text-[9px] text-gray-500 leading-tight">Dynamically computed to maintain stable hourly XP progression.</p>
            </div>
          </div>
          {/* Cost/Value Breakdown - Full Width */}
          {(() => {
            const uniqueInputsCount = Array.isArray(recipe.inputs) ? new Set(recipe.inputs.map(inp => inp.id || inp.itemId).filter(Boolean)).size : 0;
            const profitMarkupPerUniqueInput = globals.profitMarkupPerUniqueInput !== undefined ? globals.profitMarkupPerUniqueInput : 0.02;
            const markupRate = uniqueInputsCount * profitMarkupPerUniqueInput;
            const markupPercent = markupRate * 100;
            const markupValue = liveDiag.cost.materialCost * markupRate;

            const laborRatePerLevel = globals.laborRatePerLevel !== undefined ? globals.laborRatePerLevel : 0.002;
            const laborPercent = liveDiag.cost.materialCost > 0 ? (laborRatePerLevel * (recipe.skillRequirement || 1) * 100) : 0;

            const totalCycleValue = liveDiag.cost.materialCost + markupValue + liveDiag.cost.laborCost + liveDiag.cost.energyCost + liveDiag.cost.toolDepreciation;

            return (
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2.5">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider pb-1 border-b border-white/5">Cycle Value Breakdown</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">Materials:</span>
                    <span className="text-white">{liveDiag.cost.materialCost.toFixed(2)} GP</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">
                      Labor {laborPercent > 0 ? `(${laborPercent.toFixed(1)}% of Mat)` : '(Base Time)'}:
                    </span>
                    <span className="text-white">{liveDiag.cost.laborCost.toFixed(2)} GP</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">Energy:</span>
                    <span className="text-white">{liveDiag.cost.energyCost.toFixed(2)} GP</span>
                  </div>
                  {liveDiag.cost.toolDepreciation > 0 && (
                    <div className="flex justify-between font-mono">
                      <span className="text-gray-500">Tool Depreciation:</span>
                      <span className="text-white">{liveDiag.cost.toolDepreciation.toFixed(2)} GP</span>
                    </div>
                  )}
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">Profit Markup ({markupPercent.toFixed(0)}%):</span>
                    <span className="text-emerald-400">+{markupValue.toFixed(2)} GP</span>
                  </div>
                  <div className="col-span-2 h-px bg-white/5 my-1" />
                  <div className="col-span-2 flex justify-between font-black font-mono">
                    <span className="text-white">Total cycle value:</span>
                    <span className="text-emerald-400">{totalCycleValue.toFixed(2)} GP</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Flags & Warnings List */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-red-400/80 tracking-widest">Warning Flags</h4>
              <div className="space-y-1.5">
                {warnings.map((w, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                    w.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                  }`}>
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
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
