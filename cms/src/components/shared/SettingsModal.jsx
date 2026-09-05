import { X, RefreshCcw } from 'lucide-react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { ITEM_TYPES } from '../../utils/constants';
import { Section, Field } from './EditorLayout';
import PaceDials from './PaceDials';

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
          <PaceDials />
          <MapDials />
          <DialInteractions />

          {/* Section 1: Global Dials */}
          <Section title="Economy Dials & Macro Pacing">
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

              <Field label="Passive Generator Ratio">
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
                    Assumed runtime, used to value a Token that never runs out.
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
          <Section title="Wealth & XP Velocity Curves">
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

/**
 * **Interactions worth knowing** (plan §14, phase P9) — printed on the
 * Dashboard, exactly as the plan asks.
 *
 * A dial's own caption says what that dial does. These three say what happens
 * when two of them are turned together, which is where a dial set stops being
 * predictable and where a designer who is not holding the whole model in their
 * head gets surprised. §3.2 makes that predictability an acceptance test, so
 * this block is part of the deliverable rather than help text.
 */
function DialInteractions() {
  const note = 'text-[11px] leading-relaxed';
  return (
    <Section title="Interactions worth knowing (§14)">
      <ul className="space-y-2" style={{ color: 'var(--color-text-secondary)' }}>
        <li className={note}>
          <strong className="text-amber-400">Earn curve × mastery time.</strong> Together these
          set gold <em>per level of effort</em>. Raising the gold pins while slowing the XP pins
          makes levels rich and long; doing the opposite makes them cheap and quick. Neither dial
          says anything about pacing on its own.
        </li>
        <li className={note}>
          <strong className="text-amber-400">Purpose factors × craft margin.</strong> A high
          margin floor overrides a low Purpose target: an XPH recipe aiming at a tenth of the
          gold curve will still be priced at its inputs plus the margin, because the floor is the
          higher of the two. The panel files an Info row on every item where that happened, so
          this shows up as an observation rather than a mystery.
        </li>
        <li className={note}>
          <strong className="text-amber-400">Band widths × everything.</strong> The bands are the
          "how much do I trust the sim" dial. Wider means fewer corrections and fewer refusals and
          a swingier economy; narrower means the lever policy moves more of your content, more
          often. Widen them far enough and the progression guard refuses the dial set outright —
          ten levels of progress has to be worth more than one level's spread.
        </li>
      </ul>
    </Section>
  );
}

/**
 * The Map check's dials (plan §13.6 / §14, phase P7).
 *
 * These edit `simDials`, the simulator's own dial set — **not** the legacy
 * `mapTargetROI` / `mapBurstSellRatio` globals below, which belonged to the
 * retired balance engine and no pass reads. The two are deliberately in
 * separate sections rather than merged: merging them would imply the old ones
 * still do something.
 *
 * ⚠️ Turning any of these changes what the Map check *says*, never what it
 * writes to a Map. A Map's price, materials, pool and rarity tags are authored;
 * these move the bounds those authored numbers are judged against.
 */
function MapDials() {
  const globals = useGlobalStore();
  const dials = globals.simDials || {};

  const setDial = (key, value) => globals.setGlobal('simDials', { ...dials, [key]: value });
  const setPin = (key, pin, value) => {
    const current = dials[key];
    const pair = (current && typeof current === 'object')
      ? current
      : { early: current ?? 0, late: current ?? 0 };
    setDial(key, { ...pair, [pin]: value });
  };
  const setRarity = (tier, value) =>
    setDial('rarityWeights', { ...(dials.rarityWeights || {}), [tier]: value });

  const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
  const inputClass = 'w-full text-emerald-400 font-bold font-mono';
  const note = 'text-[10px] text-gray-500 italic';

  const ret = (dials.mapProductiveReturn && typeof dials.mapProductiveReturn === 'object')
    ? dials.mapProductiveReturn
    : { early: 10, late: 1.5 };
  const scrap = dials.mapScrapRatio;
  const scrapPair = (scrap && typeof scrap === 'object') ? scrap : null;
  const weights = dials.rarityWeights || {};

  return (
    <Section title="Map Check Dials (economic simulator §13.6)">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Scrap Ratio (early)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="0.05" min="0" max="1"
              value={scrapPair ? num(scrapPair.early, 0.4) : num(scrap, 0.4)}
              onChange={(e) => (scrapPair
                ? setPin('mapScrapRatio', 'early', Number(e.target.value))
                : setDial('mapScrapRatio', Number(e.target.value)))}
              className={inputClass}
            />
            <span className={note}>
              What a whole burst scraps for, as a fraction of what the Map cost. No per-copy
              cap — a Mythic windfall approaching the Map's price is a wanted story.
            </span>
          </div>
        </Field>

        <Field label="Scrap Ratio (late)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="0.05" min="0" max="1"
              value={scrapPair ? num(scrapPair.late, 0.4) : num(scrap, 0.4)}
              onChange={(e) => setPin('mapScrapRatio', 'late', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              Set this away from the early pin to make the ratio slide with the Map's derived
              level; matching pins keep it flat, which is the shipped default.
            </span>
          </div>
        </Field>

        <Field label="Productive Return — early Maps (×cost)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="0.5" min="0"
              value={num(ret.early, 10)}
              onChange={(e) => setPin('mapProductiveReturn', 'early', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>An early Map should plainly fund several more.</span>
          </div>
        </Field>

        <Field label="Productive Return — late Maps (×cost)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="0.1" min="0"
              value={num(ret.late, 1.5)}
              onChange={(e) => setPin('mapProductiveReturn', 'late', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              A late Map barely clears its cost. The pins are read at level 1 and level 99 and
              interpolated in a straight line over the Map's derived level.
            </span>
          </div>
        </Field>

        <Field label="Rarity Premium (0–1)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="0.1" min="0" max="1"
              value={num(dials.rarityPremium, 0.8)}
              onChange={(e) => setDial('rarityPremium', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              How steeply scrap value tracks scarcity. 0 splits the budget evenly; 1 makes a
              rare entry worth exactly as much per draw as a common one.
            </span>
          </div>
        </Field>

        <Field label="Unlimited Token Lifetime (hours)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="1" min="0"
              value={num(dials.unlimitedLifetimeHours, 16)}
              onChange={(e) => setDial('unlimitedLifetimeHours', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              What the check assumes a Token that never runs out is worth working for. Feeds
              the Map check only.
            </span>
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase text-amber-400 mb-2">Rarity Draw Weights (§13.4)</h4>
        <div className="grid grid-cols-5 gap-3">
          {['common', 'uncommon', 'rare', 'epic', 'mythic'].map((tier) => (
            <Field key={tier} label={tier}>
              <input
                type="number" step="1" min="0"
                value={num(weights[tier], { common: 100, uncommon: 40, rare: 12, epic: 4, mythic: 1 }[tier])}
                onChange={(e) => setRarity(tier, Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
        <p className={note + ' block mt-2'}>
          One global table. A pool entry's weight is derived from its rarity tag, and shares
          renormalise inside each pool — so pool composition, not tier, sets what a burst
          actually feels like.
        </p>
      </div>
    </Section>
  );
}
