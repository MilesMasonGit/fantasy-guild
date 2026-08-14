import { X, RefreshCcw } from 'lucide-react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { ITEM_TYPES } from '../../utils/constants';
import { Section, Field } from './EditorLayout';

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
              Global Simulation Constants (CMS Dials)
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
          {/* Section 1: Global Dials */}
          <Section title="Economy Dials & Macro Pacing (CMS-116)">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Map Target ROI Multiplier">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={globals.mapTargetROI ?? 20}
                    onChange={(e) => globals.setGlobal('mapTargetROI', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Lifetime value multiplier relative to token Map burst slice. Scales token charges.
                  </span>
                </div>
              </Field>

              <Field label="Passive Generator Ratio (D-116)">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="0.95"
                    value={globals.passiveVelocityRatio ?? 0.25}
                    onChange={(e) => globals.setGlobal('passiveVelocityRatio', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Unstaffed generator velocity as a fraction of staffed velocity (default 25%).
                  </span>
                </div>
              </Field>

              <Field label="Crafting Markup Base (+%)">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={globals.craftMarkupBase ?? 0.05}
                    onChange={(e) => globals.setGlobal('craftMarkupBase', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Base profit margin added per refining / crafting station step.
                  </span>
                </div>
              </Field>

              <Field label="Crafting Tier Scaling Rate">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="0.005"
                    value={globals.craftMarkupTierRate ?? 0.01}
                    onChange={(e) => globals.setGlobal('craftMarkupTierRate', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Additional markup scaling added per skill tier requirement.
                  </span>
                </div>
              </Field>

              <Field label="Velocity Tolerance Band (±%)">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={globals.velocityTolerance ?? 0.05}
                    onChange={(e) => globals.setGlobal('velocityTolerance', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Deadband around target GPH within which authored numbers are left untouched.
                  </span>
                </div>
              </Field>

              <Field label="Map Burst Raw Sell Ratio">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="0.05"
                    value={globals.mapBurstSellRatio ?? 0.5}
                    onChange={(e) => globals.setGlobal('mapBurstSellRatio', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Target total sell value if all Map burst items are dumped directly to merchant.
                  </span>
                </div>
              </Field>

              <Field label="Unlimited Token Assumed Lifetime (Hours)">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="1"
                    value={globals.unlimitedLifetimeHours ?? 16}
                    onChange={(e) => globals.setGlobal('unlimitedLifetimeHours', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Imputed runtime used to assign relative value to unlimited-charge Tokens (CMS-104).
                  </span>
                </div>
              </Field>

              <Field label="Raw Commodity Base Value (Gold)">
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    step="0.5"
                    value={globals.rawCommodityBaseValue ?? 2.0}
                    onChange={(e) => globals.setGlobal('rawCommodityBaseValue', Number(e.target.value))}
                    className="w-full text-emerald-400 font-bold font-mono"
                  />
                  <span className="text-[10px] text-gray-500 italic">
                    Fallback unit gold value for unrooted commodity drops (bones, beef, etc.).
                  </span>
                </div>
              </Field>
            </div>
          </Section>

          {/* Section 2: Wealth & XP Velocity Curves */}
          <Section title="Wealth & XP Velocity Curves (CMS-10)">
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Defines target Gold Per Hour (GPH) and XP Per Hour (XPH) generated by a single hero staffing a token at that skill tier.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold uppercase text-amber-400 mb-2">Gold Per Hour (GPH)</h4>
                  <div className="space-y-2">
                    {Object.entries(globals.gphTargets || {}).map(([level, gph]) => (
                      <div key={level} className="flex items-center justify-between gap-2 p-2 rounded bg-black/20 border border-white/5">
                        <span className="text-xs font-mono text-gray-300">Level {level}</span>
                        <input
                          type="number"
                          step="100"
                          value={gph}
                          onChange={(e) => {
                            const next = { ...globals.gphTargets, [level]: Number(e.target.value) };
                            globals.setGlobal('gphTargets', next);
                          }}
                          className="w-32 text-right font-mono text-xs text-amber-300 font-bold bg-black/40 px-2 py-1 rounded border border-white/10"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-purple-400 mb-2">XP Per Hour (XPH)</h4>
                  <div className="space-y-2">
                    {Object.entries(globals.xphTargets || {}).map(([level, xph]) => (
                      <div key={level} className="flex items-center justify-between gap-2 p-2 rounded bg-black/20 border border-white/5">
                        <span className="text-xs font-mono text-gray-300">Level {level}</span>
                        <input
                          type="number"
                          step="500"
                          value={xph}
                          onChange={(e) => {
                            const next = { ...globals.xphTargets, [level]: Number(e.target.value) };
                            globals.setGlobal('xphTargets', next);
                          }}
                          className="w-32 text-right font-mono text-xs text-purple-300 font-bold bg-black/40 px-2 py-1 rounded border border-white/10"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 3: Item Type Sell Modifiers */}
          <Section title="Item Category Sell Modifiers">
            <div className="grid grid-cols-2 gap-3">
              {ITEM_TYPES.map((type) => (
                <div key={type} className="flex items-center justify-between gap-2 p-2 rounded bg-black/20 border border-white/5">
                  <span className="text-xs text-gray-300 font-medium">{type}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      value={globals.sellModifiers?.[type] ?? 0}
                      onChange={(e) => globals.setSellModifier(type, Number(e.target.value))}
                      className="w-20 text-right font-mono text-xs bg-black/40 px-2 py-1 rounded border border-white/10 text-emerald-400 font-bold"
                    />
                    <span className="text-[10px] text-gray-500 font-mono">%</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
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
            onClick={globals.resetGlobals}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-red-400 hover:bg-red-500/10"
          >
            <RefreshCcw size={14} />
            <span>Reset All to Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="btn-accent px-4 py-1.5 text-xs font-semibold"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
