import { Plus, Trash2 } from 'lucide-react';
import { Field } from '../shared/EditorLayout';
import {
  rulesLinesOf, scaleStatement, MAX_SCALE, NEW_TRACK_RANKS, laboratoryOf, masteryTrackOf, masteryFindings,
} from '../../utils/constants';

/**
 * Science's two blocks (brief 810 K6). The game's readers are `src/config/registries/mastery.js`; the audit's words are
 * `src/systems/core/masteryRule.js`.
 *
 * - `MasteryTrack`: a node kind's mastery track (`mastery: { ranks: [{ points, effectId, scale }] }`), on a node's Token
 *   type (a vein, a tree, a bush, a Fishing Spot) or on a crop's recipe. Each rank is reached at its points (one study
 *   cycle gives one) and gives its effect to every Token of the kind, guild-wide; a reached rank keeps its effect.
 * - `LaboratoryBlock`: a Laboratory's reach in node levels (`laboratory: { maxLevel }`).
 */

const blankRow = (ranks) => {
  const last = ranks[ranks.length - 1];
  const points = Math.floor(Number(last?.points)) || 0;
  return { points: points > 0 ? points * 2 : 10, effectId: '', scale: 1 };
};

/** The track's rows as authored, and its editor. `holder`: the Token or recipe it is on, for the audit's lines. */
export function MasteryTrack({ block, holder, effects, tokens = {}, onChange, kind = 'Token' }) {
  const ranks = Array.isArray(block?.ranks) ? block.ranks : [];
  const library = Object.values(effects || {}).filter(Boolean).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  const setRow = (i, patch) => onChange({ ...(block || {}), ranks: ranks.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const removeRow = (i) => onChange({ ...(block || {}), ranks: ranks.filter((_, j) => j !== i) });
  const addRow = () => onChange({ ...(block || {}), ranks: [...ranks, blankRow(ranks)] });
  const track = masteryTrackOf({ mastery: block });
  // The game's own lines for this holder alone, read beside every Token so a Stump can name its tree.
  const holderId = holder?.id || 'holder';
  const findings = holder
    ? masteryFindings(kind === 'Recipe'
      ? { recipes: [{ ...holder, id: holderId, mastery: block }], effects }
      : { tokens: { ...tokens, [holderId]: { ...holder, id: holderId, mastery: block } }, effects })
      .filter((f) => f.entityId === holderId && f.field === 'mastery')
    : [];
  return (
    <div data-field="mastery" className="space-y-2">
      <p className="text-[10px] text-gray-600 leading-relaxed">
        Science studies this kind at a Laboratory: each study cycle gives one point, guild-wide, and each rank, reached at
        its points, gives its effect to every {kind === 'Recipe' ? 'Field growing this crop' : 'Token of this kind (a Stump counts as its tree)'},
        now and later. Ranks count in points order. Only Provides rules reach the Tokens; leave the effect&apos;s aim and
        reach as they are, mastery ignores them. A track has {NEW_TRACK_RANKS} ranks.
      </p>
      {ranks.map((row, i) => {
        const effect = row.effectId ? effects?.[row.effectId] : null;
        const lines = effect ? rulesLinesOf({ statements: (effect.statements || []).map((st) => scaleStatement(st, row.scale)) }, {}) : [];
        const rank = track?.ranks.find((r) => r.effectId === row.effectId && r.points === Math.floor(Number(row.points)))?.rank;
        return (
          <div key={i} data-mastery-row={i} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] w-12 text-gray-400">{rank ? `Rank ${rank}` : 'Blank'}</span>
              <label className="flex items-center gap-1 text-[11px] text-gray-400">
                Points
                <input
                  type="number" min={1} step={1} value={row.points ?? ''} data-mastery-points
                  onChange={(e) => setRow(i, { points: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className="w-16" style={{ fontSize: 11, padding: '1px 4px' }}
                />
              </label>
              <select value={row.effectId || ''} data-mastery-effect onChange={(e) => setRow(i, { effectId: e.target.value })} className="text-xs flex-1 min-w-40">
                <option value="">No effect picked</option>
                {row.effectId && !effect && <option value={row.effectId}>{row.effectId} (missing)</option>}
                {library.map((e) => <option key={e.id} value={e.id}>{e.name || e.id}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[10px] text-gray-500" title="How strong this rank's version is, 1-5; the effect itself is unchanged.">
                x
                <input
                  type="number" min={1} max={MAX_SCALE} step={1} value={row.scale ?? 1}
                  onChange={(e) => setRow(i, { scale: Math.min(MAX_SCALE, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                  className="w-11" style={{ fontSize: 10, padding: '1px 4px' }}
                />
              </label>
              <button type="button" onClick={() => removeRow(i)} className="btn-ghost" style={{ padding: '2px 6px' }} title="Remove this rank (the effect itself is kept)">
                <Trash2 size={12} />
              </button>
            </div>
            {lines.map((line, j) => <p key={j} className="text-[11px] leading-relaxed text-gray-400">{line}</p>)}
          </div>
        );
      })}
      <button type="button" data-mastery-add onClick={addRow} className="btn-ghost flex items-center gap-1 text-xs">
        <Plus size={11} /> Add a rank
      </button>
      {findings.length > 0 && (
        <ul data-mastery-findings className="text-[11px] list-disc pl-4 space-y-0.5" style={{ color: 'var(--color-warning)' }}>
          {findings.map((f, i) => <li key={i}>{f.message}</li>)}
        </ul>
      )}
    </div>
  );
}

/** A Laboratory: the highest node level it studies. */
export function LaboratoryBlock({ block, onChange }) {
  const { maxLevel } = laboratoryOf({ laboratory: block });
  return (
    <div data-field="laboratory" className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Studies nodes up to level">
          <input
            type="number" aria-label="Studies nodes up to level" min={1} max={99} step={1}
            value={maxLevel ?? ''} placeholder="any"
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value));
              onChange({ ...(block || {}), maxLevel: n >= 1 ? n : undefined });
            }}
            className="w-full"
          />
        </Field>
      </div>
      <p className="text-[10px] text-gray-600 leading-relaxed" data-field="laboratory-note">
        A Laboratory runs no recipe. It works as a Science station (Works as Science, kind Laboratory); the player picks,
        on its card, one node in its reach to study. Each cycle its Science hero wears the node as gathering does and gives
        a mastery point to the node&apos;s kind; the hero needs the node&apos;s gathering level in Science. A variant with a
        higher level here studies higher nodes; Speed and XP effects on it work as on any building, and a University
        (a support with Speed for Science) speeds it.
      </p>
    </div>
  );
}
