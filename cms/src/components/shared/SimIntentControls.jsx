import { Gauge } from 'lucide-react';
import { TEMPO_NAMES, bandFor } from '../../utils/constants';
import { SIM_PURPOSES } from '../../utils/simVocabulary';

/**
 * The **"you set" half** of the Simulator panel (economic simulator rework,
 * plan §15.1) — the two choices an author makes about a producer, shared by the
 * Token editor and the Recipe editor so there is one control, not two that
 * drift.
 *
 * ⚠️ **These are read now.** The TIME pass takes its cycle time from `tempo`,
 * the PRICE pass takes its earnings target from `purpose`, and the TUNE pass
 * judges the result against both. The band note below is still advice rather
 * than a rule — an authored cycle time outside its band is left exactly as
 * typed until a Recalculate derives a new one — but the tags themselves now
 * decide what this producer is worth. What the simulator decided is in the
 * panel's other half (`SimAnswer`).
 *
 * ## Where the two vocabularies come from
 *
 * Tempo is the game's word, imported across the boundary through
 * `constants.js` under CMS-5's game→CMS rule. Purpose is not — the game
 * declares no such list, because nothing in the game will ever read a purpose —
 * so it lives in `utils/simVocabulary.js` alongside the panel's title. That
 * split is deliberate; the reasoning is written down there.
 *
 * @param sim        the record's `sim` object, or undefined if it has none yet
 * @param onChange   called with a patch to merge into `sim`
 * @param cycleMs    this record's authored cycle time, for the band note
 * @param level      the level this record requires, for the band note
 * @param children   extra controls to render inside the same panel (the Recipe
 *                   editor's downcycle flag)
 */
export default function SimIntentControls({ sim, onChange, cycleMs, level = 1, children }) {
  const tempo = sim?.tempo;
  const purpose = sim?.purpose;
  const band = tempo ? bandFor(tempo, level) : null;
  const outsideBand =
    band != null
    && Number.isFinite(cycleMs)
    && (cycleMs < band.minMs || (!band.topIsSoft && cycleMs > band.maxMs));

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-500 leading-relaxed">
        What this is <em>for</em>. The balancer reads both: Tempo sets the cycle
        time, Purpose sets what an hour of this should earn.
      </p>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
          Tempo
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TEMPO_NAMES.map((t) => (
            <Choice
              key={t}
              label={t}
              selected={tempo === t}
              onClick={() => onChange({ tempo: tempo === t ? undefined : t })}
              title={describeBand(t, level)}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          {tempo
            ? <>At level {level}, {tempo} means {describeBand(tempo, level)}.</>
            : <>How long one cycle should take. Untagged is fine — it just means
              the balancer leaves this one alone entirely.</>}
        </p>
        {outsideBand && (
          <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-warning)' }}>
            ⚠️ The cycle time below is outside that band. Nothing will change it
            for you — either the time or the tempo is wrong.
          </p>
        )}
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
          Purpose
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SIM_PURPOSES.map((p) => (
            <Choice
              key={p.id}
              label={p.label}
              selected={purpose === p.id}
              onClick={() => onChange({ purpose: purpose === p.id ? undefined : p.id })}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          {SIM_PURPOSES.find((p) => p.id === purpose)?.caption
            || 'What this producer is paying the player in.'}
        </p>
      </div>

      {children}
    </div>
  );
}

/** The Simulator panel's icon. The title itself is in `simVocabulary.js`. */
export const SimSectionIcon = () => <Gauge size={14} />;

/** "8.1–12.2s" — the band in the units a person reads. */
function describeBand(tempo, level) {
  const b = bandFor(tempo, level);
  if (!b) return '';
  const s = (ms) => (ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1);
  return b.topIsSoft ? `${s(b.minMs)}s and up` : `${s(b.minMs)}–${s(b.maxMs)}s`;
}

/** A single-select pill. Clicking the selected one clears it. */
function Choice({ label, selected, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize"
      style={{
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? 'var(--color-accent)' : 'rgba(255,255,255,0.10)',
        background: selected ? 'var(--color-accent-muted)' : 'rgba(255,255,255,0.03)',
        color: selected ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
    </button>
  );
}
