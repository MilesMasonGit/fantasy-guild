import { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import {
  settingsOf, minutesToReach, formatMinutes, DEFAULT_LEDGER_SETTINGS, RULES_VERSIONS,
} from '../../../../src/systems/progression/ledger/settings.js';

/**
 * The Ledger settings (`ledger/settings.js`): stage budgets, the tolerance, the target player, the
 * pace curve and the rules the pretend player follows. Kept in the workspace and written with the
 * plan into `cms/plan/plan.json` by Sync; Restore from Game reads them back.
 */
export default function LedgerSettings() {
  const stored = useEntityStore((s) => s.planSettings);
  const setPlanSettings = useEntityStore((s) => s.setPlanSettings);
  const settings = settingsOf(stored);
  const save = (patch) => setPlanSettings(settingsOf({ ...settings, ...patch }));

  const setStage = (i, budgetMinutes) => save({ stages: settings.stages.map((s, j) => (j === i ? { ...s, budgetMinutes } : s)) });
  const addStage = () => {
    const last = settings.stages[settings.stages.length - 1];
    save({ stages: [...settings.stages, { tier: last ? last.tier + 1 : 0, budgetMinutes: last ? last.budgetMinutes * 2 : 30 }] });
  };
  const removeStage = () => save({ stages: settings.stages.slice(0, -1) });

  const setPoint = (i, patch) => save({ paceCurve: settings.paceCurve.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addPoint = () => {
    const last = settings.paceCurve[settings.paceCurve.length - 1];
    const level = last ? Math.min(last.level + 10, 120) : 1;
    if (settings.paceCurve.some((p) => p.level === level)) return;
    save({ paceCurve: [...settings.paceCurve, { level, minutesPerLevel: last ? last.minutesPerLevel * 2 : 1 }] });
  };
  const removePoint = (i) => save({ paceCurve: settings.paceCurve.filter((_, j) => j !== i) });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px]" style={{ color: stored ? 'var(--color-text-muted)' : 'var(--color-warning)' }}>
          {stored
            ? 'Saved in this workspace; Sync to Game writes them into the plan file.'
            : 'Showing the starting values: nothing is saved until you change one.'}
        </p>
        <button
          onClick={() => setPlanSettings(settingsOf(JSON.parse(JSON.stringify(DEFAULT_LEDGER_SETTINGS))))}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
        >
          <RotateCcw size={12} /> Starting values
        </button>
      </div>

      <Card title="Stages" help="How long, from a new game, the target player should take to finish each stage.">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>Stage</th>
              <th style={{ ...head, textAlign: 'right', width: 160 }}>Done by (minutes)</th>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>From start</th>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>This stage</th>
              <th style={{ ...head, width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {settings.stages.map((stage, i) => (
              <tr key={stage.tier}>
                <td style={cell}>{tierLabel(stage.tier)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  <NumberInput value={stage.budgetMinutes} min={1} onCommit={(v) => setStage(i, v)} label={`Budget for ${tierLabel(stage.tier)}`} />
                </td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{formatMinutes(stage.budgetMinutes)}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>
                  {formatMinutes(stage.budgetMinutes - (i > 0 ? settings.stages[i - 1].budgetMinutes : 0))}
                </td>
                <td style={cell}>
                  {i === settings.stages.length - 1 && (
                    <IconButton onClick={removeStage} label={`Remove ${tierLabel(stage.tier)}`}><Trash2 size={12} /></IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddButton onClick={addStage}>Add a stage</AddButton>
        <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          A stage is off its budget beyond ±
          <NumberInput value={settings.tolerancePct} min={0} onCommit={(v) => save({ tolerancePct: v })} label="Tolerance in percent" width={60} />
          %.
        </div>
      </Card>

      <Card title="Target player" help="The player the budgets assume: the game runs in the background and they check in now and then.">
        <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          Checks in every
          <NumberInput value={settings.player.checkInMinMinutes} min={1} onCommit={(v) => save({ player: { ...settings.player, checkInMinMinutes: v } })} label="Check-in from, minutes" width={60} />
          to
          <NumberInput value={settings.player.checkInMaxMinutes} min={1} onCommit={(v) => save({ player: { ...settings.player, checkInMaxMinutes: v } })} label="Check-in to, minutes" width={60} />
          minutes, and is away
          <NumberInput value={settings.player.overnightHours} min={0} onCommit={(v) => save({ player: { ...settings.player, overnightHours: v } })} label="Overnight, hours" width={60} />
          hours overnight.
        </div>
      </Card>

      <Card title="Pace curve" help="The target time one level should take, at a few levels; between two points it grows steadily. A wait longer than the wall factor times the curve is a wall.">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'right', width: 90 }}>Level</th>
              <th style={{ ...head, textAlign: 'right', width: 160 }}>Minutes per level</th>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>Per level</th>
              <th style={{ ...head, textAlign: 'left' }}>Reached after</th>
              <th style={{ ...head, width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {settings.paceCurve.map((point, i) => (
              <tr key={point.level}>
                <td style={{ ...cell, textAlign: 'right' }}>
                  <NumberInput value={point.level} min={1} whole onCommit={(v) => setPoint(i, { level: v })} label={`Level of point ${i + 1}`} width={60} />
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  <NumberInput value={point.minutesPerLevel} min={0.1} onCommit={(v) => setPoint(i, { minutesPerLevel: v })} label={`Minutes per level at ${point.level}`} />
                </td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{formatMinutes(point.minutesPerLevel)}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{formatMinutes(minutesToReach(settings, point.level))}</td>
                <td style={cell}>
                  <IconButton onClick={() => removePoint(i)} label={`Remove the point at level ${point.level}`}><Trash2 size={12} /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddButton onClick={addPoint}>Add a point</AddButton>
        <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          A wall is a wait over
          <NumberInput value={settings.wallFactor} min={1} onCommit={(v) => save({ wallFactor: v })} label="Wall factor" width={60} />
          times the curve.
        </div>
      </Card>

      <Card title="Rules" help="The roster rules the pretend player follows when it plays the game.">
        <select
          value={settings.rulesVersion}
          onChange={(e) => save({ rulesVersion: e.target.value })}
          aria-label="Rules version"
          style={{ width: 420 }}
        >
          {RULES_VERSIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Card>
    </div>
  );
}

const cell = { padding: '5px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

function Card({ title, help, children }) {
  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>
      <p className="text-[11px] mt-1 mb-3" style={{ color: 'var(--color-text-secondary)' }}>{help}</p>
      {children}
    </section>
  );
}

/** A number box that keeps what is typed and saves on Enter or leaving it; an unreadable entry snaps back. */
function NumberInput({ value, onCommit, label, min = 0, whole = false, width = 110 }) {
  const [text, setText] = useState(String(value));
  const [shownFor, setShownFor] = useState(value);
  if (value !== shownFor) {
    setShownFor(value);
    setText(String(value));
  }
  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n) || n < min || (whole && !Number.isInteger(n))) {
      setText(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };
  return (
    <input
      type="number"
      value={text}
      min={min}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      aria-label={label}
      className="text-right no-spinner"
      style={{ width, fontFamily: 'monospace', padding: '2px 6px', fontSize: 11 }}
    />
  );
}

function IconButton({ onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md text-[11px]"
      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
    >
      <Plus size={12} /> {children}
    </button>
  );
}
