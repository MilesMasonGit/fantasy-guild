import { X, RefreshCcw } from 'lucide-react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { ITEM_TYPES, ENEMY_TIERS } from '../../utils/constants';

export default function SettingsModal({ isOpen, onClose }) {
  const globals = useGlobalStore();

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl border overflow-hidden"
        style={{
          background: 'var(--color-bg-base)',
          borderColor: 'var(--color-border-subtle)',
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{
            background: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Global Simulation Constants
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <Section title="Economy & Value">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Gold Per Tick (GPT)">
                <input
                  type="number"
                  step="0.1"
                  value={globals.gpt}
                  onChange={(e) => globals.setGlobal('gpt', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Target EV Default">
                <input
                  type="number"
                  step="0.01"
                  value={globals.defaultTargetEV}
                  onChange={(e) => globals.setGlobal('defaultTargetEV', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Energy Per Swing (Combat)">
                <input
                  type="number"
                  step="0.1"
                  value={globals.energyPerSwing || 1}
                  onChange={(e) => globals.setGlobal('energyPerSwing', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Energy GP Value">
                <input
                  type="number"
                  step="0.01"
                  value={globals.energyGpValue}
                  onChange={(e) => globals.setGlobal('energyGpValue', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Health GP Value">
                <input
                  type="number"
                  step="0.01"
                  value={globals.healthGpValue}
                  onChange={(e) => globals.setGlobal('healthGpValue', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="XP to Gold Ratio">
                <input
                  type="number"
                  step="0.01"
                  value={globals.xpToGoldRatio}
                  onChange={(e) => globals.setGlobal('xpToGoldRatio', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Combat XP Multiplier">
                <input
                  type="number"
                  step="0.1"
                  value={globals.combatXpMultiplier != null ? globals.combatXpMultiplier : 1.0}
                  onChange={(e) => globals.setGlobal('combatXpMultiplier', Number(e.target.value))}
                  className="w-full text-emerald-400 font-bold"
                />
              </Field>
              <Field label="Skill Multiplier Rate (e.g., 0.002 = +0.2% per level)">
                <input
                  type="number"
                  step="0.001"
                  value={globals.skillMultiplierRate}
                  onChange={(e) => globals.setGlobal('skillMultiplierRate', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label="Restoration Markup (e.g., 0.2 = 20%)">
                <input
                  type="number"
                  step="0.01"
                  value={globals.restorationMarkup || 0.2}
                  onChange={(e) => globals.setGlobal('restorationMarkup', Number(e.target.value))}
                  className="w-full text-emerald-400 font-bold"
                />
              </Field>
            </div>
          </Section>

          <Section title="Hero Progression (Time-to-Level)">
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              <div className="space-y-4">
                <Field label="XP Threshold Base (Level 1)">
                  <input
                    type="number"
                    value={globals.xpThresholdBase}
                    onChange={(e) => globals.setGlobal('xpThresholdBase', Number(e.target.value))}
                    className="w-full"
                  />
                </Field>
                <Field label="XP Threshold Multiplier (Exponential Growth)">
                  <input
                    type="number"
                    step="0.01"
                    value={globals.xpThresholdMultiplier}
                    onChange={(e) => globals.setGlobal('xpThresholdMultiplier', Number(e.target.value))}
                    className="w-full"
                  />
                </Field>
                <div className="p-3 rounded-lg text-xs italic" style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}>
                  Level 1 needs {globals.xpThresholdBase} XP. <br/>
                  Level 99 needs {Math.floor(globals.xpThresholdBase * Math.pow(globals.xpThresholdMultiplier || 1.15, 98)).toLocaleString()} XP.
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase mb-2 block" style={{ color: 'var(--color-text-muted)' }}>Target Minutes Per Level</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {Object.keys(globals.ttlTargets || {}).sort((a,b) => Number(a)-Number(b)).map(lvl => (
                     <div key={lvl} className="flex items-center justify-between py-1 border-b border-white/5">
                       <span className="text-sm">Levels {lvl}+</span>
                       <div className="flex items-center gap-2">
                         <input 
                           type="number"
                           value={globals.ttlTargets[lvl]}
                           onChange={(e) => {
                             const newTargets = {...globals.ttlTargets, [lvl]: Number(e.target.value)};
                             globals.setGlobal('ttlTargets', newTargets);
                           }}
                           className="w-20 text-right py-1 px-2"
                         />
                         <span className="text-xs text-gray-500">min</span>
                       </div>
                     </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-8">
            <Section title="Sell Price Modifiers">
              <div className="space-y-3">
                {ITEM_TYPES.map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{type}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={globals.sellModifiers[type] || 0}
                      onChange={(e) => globals.setSellModifier(type, Number(e.target.value))}
                      className="w-24 text-right"
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Standard Hero Profiles">
              <div className="space-y-4">
                {ENEMY_TIERS.map((tier) => {
                  const profile = globals.heroProfiles[tier] || { combatStat: 1, derivedHp: 10 };
                  return (
                    <div key={tier} className="flex items-center justify-between bg-black/20 p-2 rounded-md border border-white/5">
                      <span className="text-sm font-semibold text-gray-300 w-12">Tier {tier}</span>
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-gray-400">Stat</label>
                        <input
                          type="number"
                          value={profile.combatStat}
                          onChange={(e) => globals.setHeroProfile(tier, { combatStat: Number(e.target.value) })}
                          className="w-16 text-right"
                        />
                        <label className="text-xs text-gray-400 ml-2">HP</label>
                        <input
                          type="number"
                          value={profile.derivedHp}
                          onChange={(e) => globals.setHeroProfile(tier, { derivedHp: Number(e.target.value) })}
                          className="w-20 text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <footer
          className="flex items-center justify-between px-6 py-4 border-t shrink-0"
          style={{
            background: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          <button
            onClick={() => {
              if (window.confirm('Reset all globals to their default values?')) {
                globals.resetGlobals();
              }
            }}
            className="btn-ghost flex items-center gap-2"
            style={{ color: 'var(--color-error)' }}
          >
            <RefreshCcw size={14} />
            <span>Reset to Defaults</span>
          </button>
          
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-accent)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs block mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
