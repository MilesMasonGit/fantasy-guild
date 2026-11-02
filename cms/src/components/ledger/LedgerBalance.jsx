import { useMemo, useRef, useState, useEffect } from 'react';
import { Scale, Play, Lock } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { workspaceContent } from '../../stores/useLedgerWatchStore';
import { runLedgerJob } from '../../engine/ledgerJobsClient';
import { sortedProposals, changeText, cantFixGroups, BALANCE_TEXT, LEVER } from '../../engine/ledgerBalance';
import { PACE_TEXT, formatMinutes } from '../../engine/ledgerPace';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const cell = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };
const LEVER_ORDER = [LEVER.XP, LEVER.GATE, LEVER.COST, LEVER.TIME, LEVER.BOOST];

/**
 * The Ledger's Balancing page (brief 290 L9): on request, the numbers the content would need for the
 * Typical player to follow the pace curve, each stage to meet its budget and boosts their targets
 * (XP a cycle, level gates, costs and times, boost strengths), the stages and walls before and
 * after them, and what numbers alone cannot fix. A preview: nothing is applied, and Apply stays
 * locked until the owner has seen the calculator agree with real play.
 */
export default function LedgerBalance({ onOpen }) {
  const [state, setState] = useState({ running: false, result: null, error: null, at: null });
  const alive = useRef(true);
  // ⚠️ Set on every mount: StrictMode mounts twice in development, and a flag only cleared would stay false.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const run = async () => {
    setState({ running: true, result: null, error: null, at: null });
    try {
      const result = await runLedgerJob('balance', { workspace: workspaceContent(useEntityStore.getState()) });
      if (alive.current) setState({ running: false, result, error: null, at: new Date() });
    } catch (err) {
      if (alive.current) setState({ running: false, result: null, error: err.message, at: null });
    }
  };

  const { running, result, error, at } = state;
  return (
    <div className="space-y-5" data-testid="ledger-balance">
      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Scale size={14} style={{ color: 'var(--color-accent)' }} /> Balancing preview</h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-3xl">
              The numbers the content would need for the Typical player to follow the pace curve, each stage to meet its budget
              and each boost its target: XP a cycle, level gates, costs and times, and boost strengths, worked out with the
              Ledger&apos;s own rate calculator. A preview only: nothing in the workspace changes. Guild Hall prices and strengths
              wait for their own pass, and gates the world tables set are left alone.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={run}
              disabled={running}
              data-testid="balance-run"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
              style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: '1px solid var(--color-border-subtle)', cursor: running ? 'wait' : 'pointer' }}
            >
              <Play size={12} /> {running ? 'Working it out…' : result ? 'Work it out again' : 'Work out the preview'}
            </button>
            <button
              disabled
              data-testid="balance-apply"
              title="Not built yet: the numbers are applied only once you have seen the calculator agree with real play on a few milestones."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'not-allowed', opacity: 0.6 }}
            >
              <Lock size={12} /> Apply
            </button>
          </div>
        </div>
        {running && <p className="text-[11px] text-gray-400">Working the pace out again after each pass; on today&apos;s content this takes about ten seconds.</p>}
        {error && <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>The preview could not be worked out: {error}</p>}
        {result && at && (
          <p className="text-[10px] text-gray-500" data-testid="balance-summary">
            Worked out at {at.toLocaleTimeString()} in {Math.round(result.ms / 100) / 10} s ({result.rounds} round{result.rounds === 1 ? '' : 's'}):
            {' '}{result.proposals.length} number{result.proposals.length === 1 ? '' : 's'} to change, {result.cantFix.length} thing{result.cantFix.length === 1 ? '' : 's'} numbers alone cannot fix.
          </p>
        )}
      </section>

      {result && (
        <>
          <Stages result={result} />
          <Walls result={result} />
          <Proposals result={result} onOpen={onOpen} />
          <CantFix result={result} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}

const stageColor = (s) => (s.hours === null ? 'var(--color-text-muted)' : s.within ? 'var(--color-success)' : 'var(--color-error)');
const stageText = (s) => (s.hours === null ? 'nothing planned' : `${PACE_TEXT.hours(s.hours)} (${s.offPct >= 0 ? '+' : ''}${Math.round(s.offPct)} %)`);

function Stages({ result }) {
  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Stages before and after">
      <h3 className={sectionHead}>Stages at Typical, before and after</h3>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left', width: 120 }}>Stage</th>
            <th style={{ ...head, textAlign: 'left', width: 90 }}>Budget</th>
            <th style={{ ...head, textAlign: 'left', width: 150 }}>Before</th>
            <th style={{ ...head, textAlign: 'left', width: 150 }}>After</th>
            <th style={{ ...head, textAlign: 'left' }}>Slowest after</th>
          </tr>
        </thead>
        <tbody>
          {result.after.stages.map((a) => {
            const b = result.before.stages.find((s) => s.tier === a.tier) || a;
            return (
              <tr key={a.tier} data-balance-stage={a.tier} data-within={a.within ? 'yes' : 'no'}>
                <td style={cell}>{a.label}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{formatMinutes(a.budgetMinutes)}</td>
                <td style={{ ...cell, color: stageColor(b) }}>{stageText(b)}</td>
                <td style={{ ...cell, color: stageColor(a), fontWeight: 700 }}>{stageText(a)}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{a.slowest.map((x) => `${x.name} ${PACE_TEXT.hours(x.hours)}`).join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Walls({ result }) {
  const { before, after } = result;
  const wallText = (w) => `${PACE_TEXT.skill(w.skill)} ${w.from} → ${w.to}: ${PACE_TEXT.hours(w.hours)} against the curve's ${PACE_TEXT.hours(w.curveHours)} (a level at worst ${PACE_TEXT.times(w.worst)})`;
  const boostsLeft = after.boosts.filter((b) => b.kind !== 'hall').length;
  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Walls before and after">
      <h3 className={sectionHead}>Walls, waits and boosts, before and after</h3>
      <p className="text-[11px] text-gray-400" data-testid="balance-counts">
        Walls (a run of levels over twice the curve): {before.walls.length} → {after.walls.length}.
        {' '}Long waits for one unlock: {before.unlockWalls.length} → {after.unlockWalls.length}.
        {' '}Boosts over their target (not the Guild Hall): {before.boosts.filter((b) => b.kind !== 'hall').length} → {boostsLeft}.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-bold text-gray-500 mb-1">Before</div>
          {before.walls.map((w) => <div key={`${w.skill}${w.from}`} className="text-[11px]" style={{ color: 'var(--color-error)' }}>{wallText(w)}</div>)}
          {!before.walls.length && <div className="text-[11px] text-gray-500">No walls.</div>}
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-500 mb-1">After</div>
          {after.walls.map((w) => <div key={`${w.skill}${w.from}`} className="text-[11px]" style={{ color: 'var(--color-error)' }} data-wall-after>{wallText(w)}</div>)}
          {!after.walls.length && <div className="text-[11px]" style={{ color: 'var(--color-success)' }}>No walls.</div>}
        </div>
      </div>
    </section>
  );
}

function Proposals({ result, onOpen }) {
  const [lever, setLever] = useState('');
  const rows = useMemo(() => sortedProposals(result.proposals).filter((p) => !lever || p.lever === lever), [result, lever]);
  const count = (l) => result.proposals.filter((p) => p.lever === l).length;
  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Proposed numbers">
      <div className="flex items-center justify-between gap-3">
        <h3 className={sectionHead}>Proposed numbers ({result.proposals.length}), largest move first</h3>
        <select value={lever} onChange={(e) => setLever(e.target.value)} style={{ width: 170 }} aria-label="Filter by lever">
          <option value="">Every lever</option>
          {LEVER_ORDER.filter((l) => count(l)).map((l) => <option key={l} value={l}>{BALANCE_TEXT.lever[l]} ({count(l)})</option>)}
        </select>
      </div>
      {!result.proposals.length && <p className="text-[11px] text-gray-500">Nothing to change: every stage, level and boost is within its tolerance, or out for a reason listed below.</p>}
      {rows.length > 0 && (
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 170 }}>Entry</th>
              <th style={{ ...head, textAlign: 'left', width: 110 }}>Lever</th>
              <th style={{ ...head, textAlign: 'left', width: 140 }}>Number</th>
              <th style={{ ...head, textAlign: 'left' }}>Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={`${p.key}|${p.field}`} data-proposal={p.lever}>
                <td style={cell}><Link k={p.key} name={p.name} onOpen={onOpen} /><div className="text-[9px] text-gray-600">{p.label}</div></td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{BALANCE_TEXT.lever[p.lever]}</td>
                <td style={{ ...cell, fontWeight: 700, color: 'var(--color-accent-hover)' }}>{changeText(p)}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{p.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CantFix({ result, onOpen }) {
  const groups = cantFixGroups(result.cantFix);
  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-3" aria-label="What numbers cannot fix">
      <h3 className={sectionHead}>What numbers alone cannot fix ({result.cantFix.length})</h3>
      {!groups.length && <p className="text-[11px]" style={{ color: 'var(--color-success)' }}>Nothing: the numbers above bring every stage, level and boost on.</p>}
      {groups.map((g) => (
        <details key={g.cause} open={g.cause !== 'hall' && g.cause !== 'luck'} data-cant-fix={g.cause}>
          <summary className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>{g.label} ({g.rows.length})</summary>
          <ul className="mt-1 space-y-1">
            {g.rows.map((c, i) => (
              <li key={`${c.key}${i}`} className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {/^(item|token|recipe):/.test(c.key) && c.message.startsWith(`${c.name}:`)
                  ? <><Link k={c.key} name={c.name} onOpen={onOpen} />{c.message.slice(c.name.length)}</>
                  : c.message}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}

function Link({ k, name, onOpen }) {
  if (!/^(item|token|recipe):/.test(k || '') || !onOpen) return <span>{name}</span>;
  return (
    <button onClick={() => onOpen(k)} className="underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}>
      {name}
    </button>
  );
}
