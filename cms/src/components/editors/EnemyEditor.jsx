import { useState, useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { COMBAT_TYPES, ENEMY_TIERS } from '../../utils/constants';
import EntitySelect from '../shared/EntitySelect';
import { simulateCombat } from '../../engine/mockBattle';
import { Trash2, Plus, Swords, Heart, Shield, Zap, Clock, TrendingUp } from 'lucide-react';

export default function EnemyEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const enemy = useEntityStore((s) => s.enemies[activeId]);
  const updateEnemy = useEntityStore((s) => s.updateEnemy);
  const deleteEnemy = useEntityStore((s) => s.deleteEnemy);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
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

  if (!enemy) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}><p className="text-sm">Select an enemy to edit</p></div>;

  const update = (key, value) => {
    if (key === 'combatStat') {
      const derivedXp = Math.round(Number(value) * (globals.combatXpMultiplier || 1.0));
      updateEnemy(activeId, { combatStat: Number(value), xpAwarded: derivedXp });
    } else {
      updateEnemy(activeId, { [key]: value });
    }
  };
  const addDrop = () => update('drops', [...enemy.drops, { itemId: '', minQty: 1, maxQty: 1, chance: 1 }]);
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

  const hasSimData = enemy.timeToKill != null;
  const targetEV = 1.05;

  const liveSim = tierSimulations[enemy.tier || 1];

  // EV health color
  const evColor = (() => {
    if (enemy.calculatedEV == null) return 'var(--color-text-muted)';
    const deviation = Math.abs(enemy.calculatedEV - targetEV) / targetEV;
    if (deviation <= 0.1) return 'var(--color-success)';
    if (deviation <= 0.25) return 'var(--color-warning)';
    return 'var(--color-error)';
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💀</span>
          <div><h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{enemy.name}</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{enemy.id}</span></div>
        </div>
        <button onClick={() => { deleteEnemy(activeId); clearActive(); }} className="btn-ghost flex items-center gap-1" style={{ color: 'var(--color-error)' }}><Trash2 size={14} /> Delete</button>
      </div>

      {/* Mock Battle Readout */}
      <S title="Mock Battle Readout">
        {!hasSimData ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Run the simulation to see combat diagnostics</p>
        ) : (
          <div className="space-y-3">
            {/* Style Toggle Segmented Row */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-secondary)' }}>Simulated Hero Combat Style</span>
              <div className="flex bg-surface-2 p-0.5 rounded-md border gap-1" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
                {['melee', 'ranged', 'magic'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setSimStyle(style)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition-all"
                    style={{
                      background: simStyle === style ? 'var(--color-quest)' : 'transparent',
                      color: simStyle === style ? '#fff' : 'var(--color-text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {style === 'melee' ? '⚔️ Melee' : style === 'ranged' ? '🏹 Ranged' : '✨ Magic'}
                  </button>
                ))}
              </div>
            </div>

            {/* Hero vs Enemy stats */}
            <div className="grid grid-cols-2 gap-3">
              {/* Hero Column */}
              <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield size={12} style={{ color: '#60a5fa' }} />
                  <span className="text-xs font-semibold uppercase" style={{ color: '#60a5fa' }}>Hero (Tier {enemy.tier})</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="DPS" value={liveSim.heroDps} color="#60a5fa" />
                  <Stat label="Hit %" value={`${liveSim.heroHitChance}%`} color="#60a5fa" />
                  <Stat label="Atk Speed" value={`${liveSim.heroAttackSpeed}ms`} color="var(--color-text-muted)" />
                  <Stat label="HP Pool" value={liveSim.heroHp} color="var(--color-text-muted)" />
                </div>
              </div>

              {/* Enemy Column */}
              <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Swords size={12} style={{ color: '#f87171' }} />
                  <span className="text-xs font-semibold uppercase" style={{ color: '#f87171' }}>Enemy</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="DPS" value={liveSim.enemyDps} color="#f87171" />
                  <Stat label="Hit %" value={`${liveSim.enemyHitChance}%`} color="#f87171" />
                  <Stat label="Atk Speed" value={`${liveSim.enemyAttackSpeed}ms`} color="var(--color-text-muted)" />
                  <Stat label="HP Pool" value={liveSim.enemyHp} color="var(--color-text-muted)" />
                </div>
              </div>
            </div>

            {/* Outcome Row */}
            <div className="grid grid-cols-5 gap-2">
              <D label="TPK" value={liveSim.timeToKill === Infinity ? '∞' : `${Math.round((liveSim.timeToKill + 2) * 100) / 100}s`} icon={<Clock size={12} />} color="var(--color-quest)" />
              <D label="Dmg Taken" value={liveSim.expectedDamageTaken === Infinity ? '—' : `${liveSim.expectedDamageTaken} HP`} icon={<Heart size={12} />} color="var(--color-error)" />
              <D label="Health Cost" value={`${liveSim.healthCostGp} GP`} icon={<Zap size={12} />} color="var(--color-warning)" />
              <D label="Food Threat" value={liveSim.isFoodKillThreat ? '💀 Threat' : '✅ Safe'} icon={<Zap size={12} />} color={liveSim.isFoodKillThreat ? 'var(--color-error)' : 'var(--color-success)'} />
              <D label="Survives?" value={liveSim.canHeroSurvive ? '✅ Yes' : '❌ No'} icon={<Shield size={12} />} color={liveSim.canHeroSurvive ? 'var(--color-success)' : 'var(--color-error)'} />
            </div>

            {/* Economics Row */}
            <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} style={{ color: evColor }} />
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Economics</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                <Stat label="Loot Value" value={`${enemy.combatReward?.lootReward || 0} GP`} color="var(--color-success)" />
                <Stat label="XP Value" value={`${enemy.combatReward?.xpReward || 0} GP`} color="var(--color-success)" />
                <Stat label="Total Cost" value={`${enemy.combatCost?.total || 0} GP`} color="var(--color-error)" />
              </div>

              {/* EV Bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>EV</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, (enemy.calculatedEV || 0) / 2 * 100)}%`,
                    background: evColor,
                  }} />
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: evColor, minWidth: 40, textAlign: 'right' }}>
                  {enemy.calculatedEV?.toFixed(2) || '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                <span>{enemy.goldPerMinute || 0} GP/min</span>
                <span>{enemy.xpPerMinute || 0} XP/min</span>
                <span>Target: {targetEV}</span>
              </div>
            </div>
          </div>
        )}
      </S>

      {/* 6-Tier Hero Progression Diagnostics */}
      {hasSimData && (
        <S title="6-Tier Hero Progression Diagnostics">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-subtle)' }}>
                  <th className="py-2 px-1">Tier</th>
                  <th className="py-2 px-1">Skill / HP</th>
                  <th className="py-2 px-1 text-right">TPK</th>
                  <th className="py-2 px-1 text-right">Avg Dmg Taken</th>
                  <th className="py-2 px-1 text-center">Food Threat</th>
                  <th className="py-2 px-1 text-center">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6].map((t) => {
                  const sim = tierSimulations[t];
                  const isCurrentTier = t === enemy.tier;
                  return (
                    <tr 
                      key={t} 
                      className="border-b last:border-b-0 hover:bg-opacity-10 transition-colors"
                      style={{ 
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: isCurrentTier ? 'rgba(96, 165, 250, 0.08)' : 'transparent',
                        fontWeight: isCurrentTier ? 'bold' : 'normal'
                      }}
                    >
                      <td className="py-2 px-1 flex items-center gap-1">
                        <span>Tier {t}</span>
                        {isCurrentTier && (
                          <span className="text-[9px] px-1 rounded font-bold uppercase" style={{ backgroundColor: 'var(--color-quest)', color: '#fff' }}>
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-1 font-mono">{sim.heroHp} HP</td>
                      <td className="py-2 px-1 text-right font-mono" style={{ color: sim.timeToKill === Infinity ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
                        {sim.timeToKill === Infinity ? '∞' : `${Math.round((sim.timeToKill + 2) * 100) / 100}s`}
                      </td>
                      <td className="py-2 px-1 text-right font-mono" style={{ color: sim.canHeroSurvive ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {sim.expectedDamageTaken === Infinity ? '—' : `${sim.expectedDamageTaken} HP`}
                      </td>
                      <td className="py-2 px-1 text-center">
                        {sim.isFoodKillThreat ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold inline-block" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}>
                            💀 20%+ Threat
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold inline-block" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: 'var(--color-success)' }}>
                            ✅ Safe ({"<"}20%)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-1 text-center">
                        {sim.canHeroSurvive ? (
                          <span className="text-xs font-semibold animate-pulse" style={{ color: 'var(--color-success)' }}>
                            ✅ Survives
                          </span>
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
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
        </S>
      )}

      <S title="Configuration">
        <div className="grid grid-cols-2 gap-3">
          <F label="Name"><input type="text" value={enemy.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></F>
          <F label="Area"><select value={enemy.biomeId} onChange={(e) => update('biomeId', e.target.value)} className="w-full"><option value="">None</option>{Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></F>
          <F label="Tier"><select value={enemy.tier} onChange={(e) => update('tier', Number(e.target.value))} className="w-full">{ENEMY_TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}</select></F>
          <F label="Combat Type"><select value={enemy.combatType} onChange={(e) => update('combatType', e.target.value)} className="w-full">{COMBAT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></F>
        </div>
      </S>

      <S title="Combat Stats">
        <div className="grid grid-cols-3 gap-3">
          <F label="Combat Stat"><input type="number" value={enemy.combatStat} onChange={(e) => update('combatStat', Number(e.target.value))} className="w-full" /></F>
          <F label="HP"><input type="number" value={enemy.hp} onChange={(e) => update('hp', Number(e.target.value))} className="w-full" /></F>
          <F label="Attack Speed (s)">
            <input 
              type="number" 
              step="0.1" 
              value={(enemy.attackSpeed || 3000) / 1000} 
              onChange={(e) => update('attackSpeed', Math.round(Number(e.target.value) * 1000))} 
              className="w-full" 
            />
          </F>
          <F label="Skill Requirement"><input type="number" value={enemy.skillRequirement || 1} onChange={(e) => update('skillRequirement', Number(e.target.value))} className="w-full" /></F>
          <F label="XP Awarded (Derived)">
            <input 
              type="number" 
              value={Math.round((enemy.combatStat || 1) * (globals.combatXpMultiplier || 1.0))} 
              disabled 
              title="Calculated off Combat Stat and the Global Combat XP Multiplier setting"
              className="w-full opacity-75 cursor-not-allowed font-mono font-bold" 
              style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-quest)' }}
            />
          </F>
          <F label="Energy Cost"><input type="number" value={enemy.energyCost} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full" /></F>
        </div>
        {/* Derived stats hint */}
        <div className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
          Derived: Damage {Math.max(1, Math.floor((enemy.combatStat || 1) * 0.8))}–{Math.max(2, Math.ceil((enemy.combatStat || 1) * 1.2))} • Attack Skill {enemy.combatStat || 1} • Defence Skill {Math.floor((enemy.combatStat || 1) * 0.8)}
        </div>
      </S>

      <S title="Innate Effects">
        {(enemy.assignedEffects || []).map((eff, i) => {
          const effId = typeof eff === 'string' ? eff : eff.effectId;
          const scale = eff.scale || 1;
          return (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <select 
                  value={effId} 
                  onChange={(e) => updateEffectItem(i, e.target.value)} 
                  className="w-full input-primary"
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
                  className="w-14 text-right"
                />
              </div>
              <button onClick={() => removeEffect(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={14} /></button>
            </div>
          );
        })}
        <button onClick={addEffect} className="btn-ghost flex items-center gap-1 text-xs"><Plus size={12} /> Add Effect</button>
      </S>


    </div>
  );
}

function S({ title, children }) { return <section className="rounded-lg p-4 border space-y-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}><h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>{children}</section>; }
function F({ label, children }) { return <div><label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>{children}</div>; }
function D({ label, value, icon, color }) { return <div><label className="text-xs flex items-center gap-1 mb-1" style={{ color: 'var(--color-text-secondary)' }}>{icon}{label}</label><div className="px-3 py-1.5 rounded text-sm font-mono" style={{ background: 'var(--color-bg-base)', color: value != null ? color : 'var(--color-text-muted)' }}>{value ?? '—'}</div></div>; }
function Stat({ label, value, color }) { return <div><span style={{ color: 'var(--color-text-muted)' }}>{label}</span><div className="font-mono font-semibold" style={{ color }}>{value}</div></div>; }
