import { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import {
  settingsOf, minutesToReach, minutesPerLevelAt, formatMinutes, DEFAULT_LEDGER_SETTINGS, RULES_VERSIONS, BOOST_TARGET_KINDS, BOOST_BUDGET_KINDS, LAYOUTS,
} from '../../engine/ledger/settings.js';

/** The levels the pace curve card shows its rule at. */
const CURVE_LEVELS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

/**
 * The Ledger settings (`ledger/settings.js`): the stages the pace rule sets, the tolerance, the
 * tiers' opening levels, the target player, the pace rule, the profiles (their bounds, the payback a
 * sensible investor asks), the reference guild (its heroes by stage, a chain's size, the layouts'
 * nodes a camp works and the spawners a site stands, a site's places), the boost targets and budget, and the roster rules. Kept
 * in the workspace and written with the plan into `cms/plan/plan.json` by Sync; Restore from Game
 * reads them back.
 */
/** The two coin curves the Coin costs card edits, each under its own setting. */
const COIN_CURVES = [
  { field: 'coinCurve', kind: 'everyday', label: 'Everyday', article: 'an' },
  { field: 'bigCoinCurve', kind: 'big', label: 'Big', article: 'a' },
];

export default function LedgerSettings() {
  const stored = useEntityStore((s) => s.planSettings);
  const setPlanSettings = useEntityStore((s) => s.setPlanSettings);
  const settings = settingsOf(stored);
  const save = (patch) => setPlanSettings(settingsOf({ ...settings, ...patch }));

  const setRule = (patch) => save({ paceRule: { ...settings.paceRule, ...patch } });
  const setBounds = (patch) => save({ profileBounds: { ...settings.profileBounds, ...patch } });
  const setBudget = (i, kind, who, v) => save({
    boostBudget: settings.boostBudget.map((row, j) => (j === i ? { ...row, [kind]: { ...row[kind], [who]: v } } : row)),
  });

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

      <Card title="Stages" help="When a new game should have left each stage at the curve's player (Maxed): settled the next place, its level in the skills it asks and its price; the rest of the stage is done over the following hours. Not set by hand: each stage ends when the pace curve reaches the level the next tier opens at (Tiers, below), the last at 99.">
        <table className="w-full" style={{ borderCollapse: 'collapse' }} data-stages>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>Stage</th>
              <th style={{ ...head, textAlign: 'right', width: 110 }}>Ends at level</th>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>From start</th>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>This stage</th>
            </tr>
          </thead>
          <tbody>
            {settings.stages.map((stage, i) => (
              <tr key={stage.tier} data-stage-budget={stage.tier}>
                <td style={cell}>{tierLabel(stage.tier)}</td>
                <td style={{ ...cell, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{stage.endsAt}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{formatMinutes(stage.budgetMinutes)}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>
                  {formatMinutes(stage.budgetMinutes - (i > 0 ? settings.stages[i - 1].budgetMinutes : 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          A stage is off its budget beyond ±
          <NumberInput value={settings.tolerancePct} min={0} onCommit={(v) => save({ tolerancePct: v })} label="Tolerance in percent" width={60} />
          %.
        </div>
      </Card>

      <Card title="Tiers" help="The level each tier opens at: the ladder (iron 20, silver 30, mythril 40, gold 50, adamantine 60, darkmetal 80), copper in two stages. A world place whose main material is planned for a later tier than its ring asks this level in its line's skill to settle, where the ring's price asks less.">
        <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }} data-tier-levels>
          {settings.tierLevels.map((p, i) => (
            <span key={p.tier} className="flex items-center gap-1">
              {tierLabel(p.tier)}:
              <NumberInput
                value={p.level} min={1} whole width={56} label={`Opening level of ${tierLabel(p.tier)}`}
                onCommit={(v) => save({ tierLevels: settings.tierLevels.map((q, j) => (j === i ? { ...q, level: v } : q)) })}
              />
            </span>
          ))}
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

      <Card title="Pace curve" help="One rule for the whole game (BALANCE_RULES section 1): level 1 takes the first minutes, each level after a steady step longer, the step kept within the owner's range. It describes the curve's player, Maxed. A wait longer than the wall factor times the curve is a wall.">
        <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }} data-pace-rule>
          Level 1 takes
          <NumberInput value={settings.paceRule.startMinutes} min={0.1} onCommit={(v) => setRule({ startMinutes: v })} label="Minutes at level 1" width={60} />
          minutes; each level after takes
          <NumberInput value={settings.paceRule.stepPct} min={0} onCommit={(v) => setRule({ stepPct: v })} label="Step in percent" width={60} />
          % longer, within the range
          <NumberInput value={settings.paceRule.minPct} min={0.1} onCommit={(v) => setRule({ minPct: v })} label="Step from, percent" width={60} />
          to
          <NumberInput value={settings.paceRule.maxPct} min={0.1} onCommit={(v) => setRule({ maxPct: v })} label="Step to, percent" width={60} />
          %.
        </div>
        <table className="w-full mt-3" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'right', width: 90 }}>Level</th>
              <th style={{ ...head, textAlign: 'left', width: 140 }}>A level takes</th>
              <th style={{ ...head, textAlign: 'left' }}>Reached after</th>
            </tr>
          </thead>
          <tbody>
            {CURVE_LEVELS.map((level) => (
              <tr key={level} data-curve-level={level}>
                <td style={{ ...cell, textAlign: 'right' }}>{level}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{formatMinutes(minutesPerLevelAt(settings, level))}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{formatMinutes(minutesToReach(settings, level))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          A wall is a wait over
          <NumberInput value={settings.wallFactor} min={1} onCommit={(v) => save({ wallFactor: v })} label="Wall factor" width={60} />
          times the curve.
        </div>
      </Card>

      <Card title="Profiles" help="The three players the pace is read for. Maxed (every boost, the well-optimized player) is what the curve aims at; Typical (a sensible investor) and Bare (no boosts) must stay within their bounds of it.">
        <div className="space-y-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="flex flex-wrap items-center gap-2">
            Typical takes at most
            <NumberInput value={settings.profileBounds.typical} min={1} onCommit={(v) => setBounds({ typical: v })} label="Typical bound" width={60} />
            times the curve, Bare at most
            <NumberInput value={settings.profileBounds.bare} min={1} onCommit={(v) => setBounds({ bare: v })} label="Bare bound" width={60} />
            times, and Maxed is never more than
            <NumberInput value={settings.profileBounds.maxed} min={1} onCommit={(v) => setBounds({ maxed: v })} label="Maxed bound" width={60} />
            times faster.
          </div>
          <div className="flex items-center gap-2">
            Typical takes a building, a camp, a tool or gear that pays for itself within
            <NumberInput value={settings.paybackHours} min={0.1} onCommit={(v) => save({ paybackHours: v })} label="Payback hours" width={60} />
            hours of work,
          </div>
          <div className="flex items-center gap-2">
            and a Guild Hall rank that pays for itself within
            <NumberInput value={settings.hallPaybackHours} min={0.1} onCommit={(v) => save({ hallPaybackHours: v })} label="Guild Hall payback hours" width={60} />
            hours (a rank slower than that is red, and the proposed prices are sized to it).
          </div>
          <div className="flex items-center gap-2">
            A chain is one maker and about
            <NumberInput value={settings.gatherersPerMaker} min={0.1} onCommit={(v) => save({ gatherersPerMaker: v })} label="Gatherers per maker" width={60} />
            gatherers (the reference guild): a chain has no more heroes than that, and a maker needing more down its chain runs at their share, and is a problem.
          </div>
          <div className="flex flex-wrap items-center gap-2" data-heroes-by-tier>
            The guild's heroes from each stage on (one chain has them all until it is full):
            {settings.heroesByTier.map((p, i) => (
              <span key={p.tier} className="flex items-center gap-1">
                {tierLabel(p.tier)}
                <NumberInput
                  value={p.heroes} min={1} whole width={44} label={`Heroes from ${tierLabel(p.tier)}`}
                  onCommit={(v) => save({ heroesByTier: settings.heroesByTier.map((q, j) => (j === i ? { ...q, heroes: v } : q)) })}
                />
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            A camp hands one hero
            <NumberInput value={settings.layouts.sparse} min={1} whole onCommit={(v) => save({ layouts: { ...settings.layouts, sparse: v } })} label="Sparse layout nodes" width={50} />
            nodes in turn in the sparse layout and
            <NumberInput value={settings.layouts.dense} min={1} whole onCommit={(v) => save({ layouts: { ...settings.layouts, dense: v } })} label="Dense layout nodes" width={50} />
            in the dense one (veins, Fields); a site worked from a spawner stands
            <NumberInput value={settings.layoutSpawners.sparse} min={1} whole onCommit={(v) => save({ layoutSpawners: { ...settings.layoutSpawners, sparse: v } })} label="Sparse layout spawners" width={50} />
            and
            <NumberInput value={settings.layoutSpawners.dense} min={1} whole onCommit={(v) => save({ layoutSpawners: { ...settings.layoutSpawners, dense: v } })} label="Dense layout spawners" width={50} />
            of them (Forests, Orchards, Quarries), its camp working each one's whole allowance; the pace is timed
            <select
              value={settings.layout}
              onChange={(e) => save({ layout: e.target.value })}
              aria-label="Layout the pace times"
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            and the other reported beside it.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            A work site has
            <NumberInput value={settings.sitePlaces.places} min={1} whole onCommit={(v) => save({ sitePlaces: { ...settings.sitePlaces, places: v } })} label="Places round a node" width={50} />
            places round the node it works; its camp, its other nodes and its spawners stand in some, and what they leave holds buildings, at most
            <NumberInput value={settings.sitePlaces.buildings} min={1} whole onCommit={(v) => save({ sitePlaces: { ...settings.sitePlaces, buildings: v } })} label="Building places" width={50} />
            of them, at most
            <NumberInput value={settings.sitePlaces.perKind} min={1} whole onCommit={(v) => save({ sitePlaces: { ...settings.sitePlaces, perKind: v } })} label="Places a kind" width={50} />
            boosting one kind (speed, XP, yield or rare finds); the same building may stand in several.
          </div>
          <div className="flex items-center gap-2">
            A rare find on repeatable work is a steady source at
            <NumberInput value={settings.steadyFindsPerDay} min={0.01} onCommit={(v) => save({ steadyFindsPerDay: v })} label="Steady finds a day" width={60} />
            finds a day or more for one hero working all day; below that it is rare but steady. Only a source that wears out is luck.
          </div>
        </div>
      </Card>

      <Card title="Boost targets" help="How much each kind of boost should add to a piece of work at most, from a stage on (Maxed, against Bare). A boost beyond its target by more than the tolerance is a problem. Camps have none (they change how many Tokens one hero works); the Guild Hall's applies to the stars Maxed holds that move a work's rate.">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 180 }}>Kind</th>
              <th style={{ ...head, textAlign: 'left' }}>From stage: up to</th>
            </tr>
          </thead>
          <tbody>
            {BOOST_TARGET_KINDS.map(({ id, label }) => {
              const points = settings.boostTargets[id] || [];
              const setPoints = (next) => save({ boostTargets: { ...settings.boostTargets, [id]: next } });
              return (
                <tr key={id} data-boost-target={id}>
                  <td style={cell}>{label}</td>
                  <td style={cell}>
                    <div className="flex flex-wrap items-center gap-3">
                      {points.length === 0 && <span className="text-gray-500">no target</span>}
                      {points.map((p, i) => (
                        <span key={p.tier} className="flex items-center gap-1">
                          {tierLabel(p.tier)}:
                          <NumberInput value={p.pct} min={0} onCommit={(v) => setPoints(points.map((q, j) => (j === i ? { ...q, pct: v } : q)))} label={`${label} target from ${tierLabel(p.tier)}`} width={56} />
                          %
                          <IconButton onClick={() => setPoints(points.filter((_, j) => j !== i))} label={`Remove the ${label} target from ${tierLabel(p.tier)}`}><Trash2 size={11} /></IconButton>
                        </span>
                      ))}
                      <IconButton
                        onClick={() => {
                          const last = points[points.length - 1];
                          setPoints([...points, { tier: last ? last.tier + 1 : 0, pct: last ? last.pct : 20 }]);
                        }}
                        label={`Add a ${label} target`}
                      >
                        <Plus size={12} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Boost budget" help="What Typical and Maxed hold at the opening of each tier (BALANCE_RULES section 5), in percent: speed (the cut in work or growth time), XP, yield (more of a work's main output a cycle) and rare finds. Every boost a profile holds on a piece of work is added up by kind and set against its tier's cell; speed and XP climb level by level to the next tier's. A total over its cell is a problem.">
        <table className="w-full" style={{ borderCollapse: 'collapse' }} data-boost-budget>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>From</th>
              {BOOST_BUDGET_KINDS.map(({ id, label }) => <th key={id} style={{ ...head, textAlign: 'left' }}>{label}: Typical / Maxed</th>)}
            </tr>
          </thead>
          <tbody>
            {settings.boostBudget.map((row, i) => (
              <tr key={row.tier}>
                <td style={cell}>{tierLabel(row.tier)}</td>
                {BOOST_BUDGET_KINDS.map(({ id, label }) => (
                  <td key={id} style={cell}>
                    <span className="flex items-center gap-1">
                      <NumberInput value={row[id].typical} min={0} onCommit={(v) => setBudget(i, id, 'typical', v)} label={`${label} at Typical from ${tierLabel(row.tier)}`} width={48} />
                      /
                      <NumberInput value={row[id].maxed} min={0} onCommit={(v) => setBudget(i, id, 'maxed', v)} label={`${label} at Maxed from ${tierLabel(row.tier)}`} width={48} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          Maxed never cuts work time by more than
          <NumberInput value={settings.speedCapPct} min={1} onCommit={(v) => save({ speedCapPct: v })} label="Speed cap in percent" width={60} />
          % (the game caps it at 80 %, so one more Faster Work building always still helps).
        </div>
      </Card>

      <Card title="Coin costs" help="The two coin curves (BALANCE_RULES section 7): from a stage on, a coin cost asks the coins one hero earns by selling in this many minutes there. Everyday (a Shop Token, a Foundation): one level's time on the pace curve, so these move with the pace step. Big (settling a place, a Guild Hall star): half the payback curve; a star's rank adds no multiplier, each rank is priced at its own stage. A later stage earns more an hour, so the same minutes already cost more further out. The balancing preview sets the prices that ask coins to these numbers; which prices ask coins is the content's.">
        {COIN_CURVES.map(({ field, kind, label, article }) => {
          const points = settings[field];
          return (
            <div key={field} className="flex flex-wrap items-center gap-3 text-[11px] mb-2" style={{ color: 'var(--color-text-secondary)' }} data-coin-curve={kind}>
              <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
              {points.length === 0 && <span className="text-gray-500">no curve: no {kind} coin cost is proposed</span>}
              {points.map((p, i) => (
                <span key={p.tier} className="flex items-center gap-1">
                  {tierLabel(p.tier)}:
                  <NumberInput value={p.minutes} min={0.1} onCommit={(v) => save({ [field]: points.map((q, j) => (j === i ? { ...q, minutes: v } : q)) })} label={`${label} coin cost minutes from ${tierLabel(p.tier)}`} width={56} />
                  min
                  <IconButton onClick={() => save({ [field]: points.filter((_, j) => j !== i) })} label={`Remove the ${kind} coin cost point at ${tierLabel(p.tier)}`}><Trash2 size={11} /></IconButton>
                </span>
              ))}
              <IconButton
                onClick={() => {
                  const last = points[points.length - 1];
                  save({ [field]: [...points, { tier: last ? last.tier + 1 : 0, minutes: last ? last.minutes : DEFAULT_LEDGER_SETTINGS[field][0].minutes }] });
                }}
                label={`Add ${article} ${kind} coin cost point`}
              >
                <Plus size={12} />
              </IconButton>
            </div>
          );
        })}
      </Card>

      <Card title="Rules" help="The roster rules the pace follows.">
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
