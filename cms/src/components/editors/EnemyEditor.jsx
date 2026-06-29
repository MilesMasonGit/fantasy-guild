import { useState, useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { COMBAT_TYPES, ENEMY_TIERS } from '../../utils/constants';
import EntitySelect from '../shared/EntitySelect';
import { simulateCombat, calculateCombatEV } from '../../engine/mockBattle';
import { 
  Trash2, Plus, Swords, Heart, Shield, Zap, Clock, TrendingUp,
  AlertTriangle, CheckCircle2, Star, Settings2, Search, X, Sparkles,
  Image, HelpCircle
} from 'lucide-react';
import { slugify } from '../../utils/idGenerator';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export default function EnemyEditor({ openGenerate }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const enemy = useEntityStore((s) => s.enemies[activeId]);
  const updateEnemy = useEntityStore((s) => s.updateEnemy);
  const deleteEnemy = useEntityStore((s) => s.deleteEnemy);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
  const items = useEntityStore((s) => s.items);
  const effectsObj = useEntityStore((s) => s.effects);
  const effectsList = Object.values(effectsObj || {});
  const filteredEffects = effectsList.filter(eff => {
    const types = eff.targetEntityTypes || (eff.targetEntityType ? [eff.targetEntityType] : []);
    return types.length === 0 || types.includes('All') || types.includes('Enemy');
  });

  const [simStyle, setSimStyle] = useState('melee');
  const globals = useGlobalStore();

  const tierSimulations = useMemo(() => {
    if (!enemy) return {};
    const sims = {};
    [1, 2, 3, 4, 5, 6].forEach(t => {
      sims[t] = simulateCombat(enemy, globals, t, simStyle);
    });
    return sims;
  }, [enemy, globals, simStyle]);

  if (!enemy) return <Empty text="Select an enemy from the sidebar to edit" />;

  const update = (key, value) => {
    if (key === 'combatStat') {
      const derivedXp = Math.round(Number(value) * (globals.combatXpMultiplier || 1.0));
      updateEnemy(activeId, { combatStat: Number(value), xpAwarded: derivedXp });
    } else {
      updateEnemy(activeId, { [key]: value });
    }
  };

  const addDrop = () => update('drops', [...(enemy.drops || []), { itemId: '', minQty: 1, maxQty: 1, chance: 1 }]);
  const removeDrop = (i) => update('drops', enemy.drops.filter((_, idx) => idx !== i));
  const updateDrop = (i, patch) => update('drops', enemy.drops.map((d, idx) => idx === i ? { ...d, ...patch } : d));

  const addEffect = () => update('assignedEffects', [...(enemy.assignedEffects || []), { effectId: '', scale: 1 }]);
  const removeEffect = (i) => update('assignedEffects', (enemy.assignedEffects || []).filter((_, idx) => idx !== i));
  const updateEffectItem = (i, effId) => update('assignedEffects', (enemy.assignedEffects || []).map((e, idx) => {
    if (idx !== i) return e;
    const current = typeof e === 'string' ? { effectId: e, scale: 1 } : e;
    return { ...current, effectId: effId };
  }));
  const updateEffectScale = (i, scale) => update('assignedEffects', (enemy.assignedEffects || []).map((e, idx) => {
    if (idx !== i) return e;
    const current = typeof e === 'string' ? { effectId: e, scale: 1 } : e;
    return { ...current, scale: Math.max(1, Math.min(5, Number(scale))) };
  }));

  // --- Real-time client-side EV and combat computations ---
  const combinedGlobals = {
    ...globals,
    lootTables: useEntityStore.getState().lootTables || {},
    enemyUpdates: useSimulationStore.getState().enemyUpdates || {},
  };
  const liveDiag = calculateCombatEV(enemy, items, combinedGlobals);
  const liveSim = liveDiag.combat;

  const targetEV = 1.05;
  const variance = 0.05; // combat EV variance
  const isEVWithinVariance = Math.abs(liveDiag.calculatedEV - targetEV) <= variance;

  const liveGPM = liveDiag.goldPerMinute;
  const liveGPH = liveGPM * 60;
  const liveXPM = liveDiag.xpPerMinute;
  const liveXPH = liveXPM * 60;

  // Progressive Scaling Check: if tier > 1, check T-1 hero combat
  let isTooEasy = false;
  let tooEasyWarning = null;
  if (enemy.tier > 1) {
    const tMinus1 = enemy.tier - 1;
    const lowerTierSim = simulateCombat(enemy, globals, tMinus1, simStyle);
    if (lowerTierSim.canHeroSurvive && !lowerTierSim.isFoodKillThreat) {
      isTooEasy = true;
      tooEasyWarning = `Progression Check: Too Easy! A Tier ${tMinus1} hero can survive this enemy with less than 20% food threat. Consider increasing combatStat or HP.`;
    }
  }

  // Build flags & warnings
  const warnings = [];

  if (liveSim.timeToKill === Infinity || !liveSim.canHeroSurvive) {
    warnings.push({
      type: 'danger',
      message: `Hero cannot survive battle! TTK is infinite or expected damage taken exceeds Hero Max HP (${liveSim.heroHp} HP).`
    });
  }

  if (liveSim.isFoodKillThreat) {
    warnings.push({
      type: 'warning',
      message: `High Food Threat: Enemy single hit damage (${liveSim.enemySingleHitDamage} HP) exceeds 20% of hero max HP (${liveSim.heroHp} HP). Hero will eat heavily.`
    });
  }

  if (tooEasyWarning) {
    warnings.push({
      type: 'warning',
      message: tooEasyWarning
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        name={enemy.name}
        id={enemy.id}
        sprite={enemy.sprite}
        isEnemy={true}
        onDelete={() => { deleteEnemy(activeId); clearActive(); }}
        onSuggest={() => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'enemy',
          name: enemy.name,
          tier: enemy.tier || 1,
          areaId: '',
        })}
      />

      {/* Core Configuration */}
      <Section title="Configuration" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name">
            <input type="text" value={enemy.name} onChange={(e) => update('name', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50" />
          </Field>
          
          <Field label="Combat Tier">
            <select value={enemy.tier || 1} onChange={(e) => update('tier', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono">
              {ENEMY_TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
            </select>
          </Field>
          <Field label="Combat Type">
            <select value={enemy.combatType || 'melee'} onChange={(e) => update('combatType', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 uppercase font-black text-xs tracking-wider">
              {COMBAT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <IdSyncField entity={enemy} entityType="enemy" onUpdate={update} />

          <Field label="Combat Stat">
            <input type="number" value={enemy.combatStat || 0} onChange={(e) => update('combatStat', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" />
          </Field>
          <Field label="HP">
            <input type="number" value={enemy.hp || 0} onChange={(e) => update('hp', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" />
          </Field>

          <Field label="Attack Speed (s)">
            <input 
              type="number" 
              step="0.1" 
              value={(enemy.attackSpeed || 3000) / 1000} 
              onChange={(e) => update('attackSpeed', Math.round(Number(e.target.value) * 1000))} 
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" 
            />
          </Field>
          <Field label="Energy Cost">
            <input type="number" value={enemy.energyCost || 0} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" />
          </Field>

          {/* Derived stats hint */}
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider col-span-2 px-1">
            Derived: Damage {Math.max(1, Math.floor((enemy.combatStat || 1) * 0.4))}–{Math.max(2, Math.floor((enemy.combatStat || 1) * 0.6))} • Attack Skill {enemy.combatStat || 1} • Defence Skill {enemy.combatStat || 1} • XP Awarded {Math.round((enemy.combatStat || 1) * (globals.combatXpMultiplier || 1.0))}
          </div>

          <Field label="Sprite Reference" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-16 h-16 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(() => {
                  const resolvedPath = enemy.sprite ? resolveSpritePath(enemy.sprite) : null;
                  if (resolvedPath) {
                    const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
                    return (
                      <>
                        <img 
                          src={imgSrc} 
                          className="max-w-[64px] max-h-[64px] object-contain pixel-art animate-fade-in" 
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
                value={enemy.sprite || ''} 
                onChange={(e) => update('sprite', e.target.value)} 
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

      {/* Live Diagnostics */}
      <Section title="Live Diagnostics" icon={<Star size={14} className="text-amber-400" />}>
        <div className="space-y-5">
          {/* Glassmorphic Balance Banner */}
          <div className={`p-4 rounded-xl border backdrop-blur-md transition-all flex items-center justify-between ${
            isEVWithinVariance 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                isEVWithinVariance ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
              }`} />
              <div>
                <span className="text-xs font-black uppercase tracking-wider">
                  {isEVWithinVariance ? 'Balanced Combat' : 'Imbalanced Combat'}
                </span>
                <p className="text-[10px] opacity-75">
                  {isEVWithinVariance 
                    ? `Combat EV is inside target safe zones.` 
                    : `Requires tuning of drop rewards, combat stats, or HP.`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black font-mono">
                {liveDiag.calculatedEV.toFixed(2)}
              </span>
              <p className="text-[9px] font-mono opacity-65">Live EV</p>
            </div>
          </div>

          {/* Prominent Hourly Velocities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Gold Generation Rate</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black font-mono text-white">{liveGPH.toFixed(0)}</span>
                <span className="text-xs text-gray-400 font-bold uppercase">GP/hr</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{liveGPM.toFixed(2)} GP/min</span>
              </div>
            </div>
 
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">XP Progression Rate</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black font-mono text-white">{liveXPH.toFixed(0)}</span>
                <span className="text-xs text-gray-400 font-bold uppercase">XP/hr</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{liveXPM.toFixed(2)} XP/min</span>
              </div>
            </div>
          </div>
 
          {/* Cost Breakdown - Full Width */}
          <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2.5">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider pb-1 border-b border-white/5">Cycle Cost Breakdown</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-gray-500">Health drain GP:</span>
                <span className="text-white">{liveDiag.cost.healthCost.toFixed(2)} GP</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-500">Energy cost GP:</span>
                <span className="text-white">{liveDiag.cost.energyCost.toFixed(2)} GP</span>
              </div>
              <div className="col-span-2 h-px bg-white/5 my-1" />
              <div className="col-span-2 flex justify-between font-black font-mono">
                <span className="text-white">Total Cost:</span>
                <span className="text-emerald-400">{liveDiag.cost.total.toFixed(2)} GP</span>
              </div>
            </div>
          </div>

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

      {/* Mock Battle Readout */}
      <Section title="Mock Battle Readout" icon={<Swords size={14} />}>
        <div className="space-y-3">
          {/* Style Toggle Segmented Row */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Simulated Hero Combat Style</span>
            <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/10 gap-1">
              {['melee', 'ranged', 'magic'].map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setSimStyle(style)}
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                    simStyle === style ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {style === 'melee' ? '⚔️ Melee' : style === 'ranged' ? '🏹 Ranged' : '✨ Magic'}
                </button>
              ))}
            </div>
          </div>

          {/* Hero vs Enemy stats */}
          <div className="grid grid-cols-2 gap-4">
            {/* Hero Column */}
            <div className="rounded-xl p-3 bg-black/20 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={12} className="text-blue-400" />
                <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Hero (Tier {enemy.tier || 1})</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="DPS" value={liveSim.heroDps} color="text-blue-400 font-bold" />
                <Stat label="Hit %" value={`${liveSim.heroHitChance}%`} color="text-blue-400 font-bold" />
                <Stat label="Atk Speed" value={`${liveSim.heroAttackSpeed}ms`} color="text-gray-400" />
                <Stat label="HP Pool" value={liveSim.heroHp} color="text-gray-400" />
              </div>
            </div>

            {/* Enemy Column */}
            <div className="rounded-xl p-3 bg-black/20 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <Swords size={12} className="text-red-400" />
                <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">Enemy</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="DPS" value={liveSim.enemyDps} color="text-red-400 font-bold" />
                <Stat label="Hit %" value={`${liveSim.enemyHitChance}%`} color="text-red-400 font-bold" />
                <Stat label="Atk Speed" value={`${liveSim.enemyAttackSpeed}ms`} color="text-gray-400" />
                <Stat label="HP Pool" value={liveSim.enemyHp} color="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Outcome Row */}
          <div className="grid grid-cols-5 gap-2">
            <DiagCompact label="TPK" value={liveSim.timeToKill === Infinity ? '∞' : `${Math.round((liveSim.timeToKill + 2) * 100) / 100}s`} icon={<Clock size={12} />} color="text-indigo-400" />
            <DiagCompact label="Dmg Taken" value={liveSim.expectedDamageTaken === Infinity ? '—' : `${liveSim.expectedDamageTaken} HP`} icon={<Heart size={12} />} color="text-red-400" />
            <DiagCompact label="Health Cost" value={`${liveSim.healthCostGp} GP`} icon={<Zap size={12} />} color="text-amber-400" />
            <DiagCompact label="Food Threat" value={liveSim.isFoodKillThreat ? '💀 Threat' : '✅ Safe'} icon={<Zap size={12} />} color={liveSim.isFoodKillThreat ? 'text-red-400' : 'text-emerald-400'} />
            <DiagCompact label="Survives?" value={liveSim.canHeroSurvive ? '✅ Yes' : '❌ No'} icon={<Shield size={12} />} color={liveSim.canHeroSurvive ? 'text-emerald-400' : 'text-red-400'} />
          </div>
        </div>
      </Section>

      {/* 6-Tier Hero Progression Diagnostics */}
      <Section title="Progression Scaling Matrix" icon={<TrendingUp size={14} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-gray-500 border-white/5">
                <th className="py-2 px-1">Tier</th>
                <th className="py-2 px-1">Hero HP</th>
                <th className="py-2 px-1 text-right">TPK</th>
                <th className="py-2 px-1 text-right">Avg Damage</th>
                <th className="py-2 px-1 text-center">Food Threat</th>
                <th className="py-2 px-1 text-center">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map((t) => {
                const sim = tierSimulations[t];
                const isCurrentTier = t === (enemy.tier || 1);
                return (
                  <tr 
                    key={t} 
                    className={`border-b border-white/5 transition-colors ${
                      isCurrentTier ? 'bg-blue-500/10 font-bold text-blue-300' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <td className="py-2.5 px-1 flex items-center gap-1.5">
                      <span>Tier {t}</span>
                      {isCurrentTier && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-500/30 font-black uppercase">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-1 font-mono text-gray-400">{sim.heroHp} HP</td>
                    <td className="py-2 px-1 text-right font-mono" style={{ color: sim.timeToKill === Infinity ? 'var(--color-error)' : '' }}>
                      {sim.timeToKill === Infinity ? '∞' : `${Math.round((sim.timeToKill + 2) * 100) / 100}s`}
                    </td>
                    <td className="py-2 px-1 text-right font-mono" style={{ color: sim.canHeroSurvive ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {sim.expectedDamageTaken === Infinity ? '—' : `${sim.expectedDamageTaken} HP`}
                    </td>
                    <td className="py-2 px-1 text-center">
                      {sim.isFoodKillThreat ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block bg-red-500/20 border border-red-500/30 text-red-300">
                          💀 20%+ Threat
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                          ✅ Safe ({"<"}20%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-1 text-center">
                      {sim.canHeroSurvive ? (
                        <span className="text-xs font-bold text-emerald-400">
                          ✅ Survives
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-400">
                          ❌ Defeated
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>



      {/* Drops configuration */}
      <Section title="Drops (Loot)" icon={<Swords size={14} />}>
        <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-center">
          <p className="text-xs text-gray-400">
            Enemy drops and loot chances are configured using the <strong className="text-white">Drops (Loot)</strong> column on the right side of the screen.
          </p>
        </div>
      </Section>

      {/* Innate Effects */}
      <Section title="Innate Effects" icon={<Plus size={14} />}>
        {(enemy.assignedEffects || []).map((eff, i) => {
          const effId = typeof eff === 'string' ? eff : eff.effectId;
          const scale = eff.scale || 1;
          return (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <select 
                  value={effId} 
                  onChange={(e) => updateEffectItem(i, e.target.value)} 
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50"
                >
                  <option value="">Select Effect</option>
                  {filteredEffects.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold opacity-50 uppercase">Scale</span>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  value={scale} 
                  onChange={(e) => updateEffectScale(i, e.target.value)}
                  className="w-14 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 text-right font-mono"
                />
              </div>
              <button 
                type="button"
                onClick={() => removeEffect(i)} 
                className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        <button 
          type="button"
          onClick={addEffect} 
          className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
        >
          <Plus size={12} /> Add Effect
        </button>
      </Section>

      {isPickerOpen && (
        <SpritePickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(spriteKey) => update('sprite', spriteKey)}
        />
      )}
    </div>
  );
}

function DiagCompact({ label, value, icon, color }) { 
  return (
    <div>
      <label className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 text-gray-500">
        {icon} {label}
      </label>
      <div className={`px-2 py-1.5 rounded text-xs font-mono text-center bg-black/40 border border-white/5 ${color || 'text-white'}`}>
        {value ?? '—'}
      </div>
    </div>
  ); 
}

function Stat({ label, value, color }) { 
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-gray-500">{label}</span>
      <div className={`font-mono ${color}`}>{value}</div>
    </div>
  ); 
}
