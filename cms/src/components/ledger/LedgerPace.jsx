import { useEffect, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  PROFILES, PROFILE_TEXT, PACE_TEXT, BOOST_KIND_TEXT, breakdownRows, hoursText, rateText, gainText, formatMinutes,
} from '../../engine/ledgerPace';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { calibrationStatus } from '../../engine/calibrationStatus';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const cell = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

/**
 * The Ledger's Pace page: each stage's time at Typical against its budget, the per-skill breakdown
 * of where XP comes from (the best source at each stage, Bare against Typical and Maxed, and what
 * each kind of boost adds), the hours each stage's top level takes at each profile against the pace
 * curve, the Guild Hall's paybacks, and whether the calculator's calibration stands.
 */
export default function LedgerPace({ report, onRefresh, onOpen, focusSkill }) {
  const { pace, ledger } = report;
  const stages = useMemo(() => (pace ? pace.settings.stages.map((s) => ({ ...s, ...pace.stageOf(s.tier) })) : []), [pace]);
  const rows = useMemo(() => (pace ? breakdownRows(pace) : []), [pace]);
  const hall = useMemo(() => (pace ? pace.hallPaybacks().filter((r) => r.rate) : []), [pace]);
  const focus = useRef(null);
  useEffect(() => { focus.current?.scrollIntoView?.({ block: 'center' }); }, [focusSkill]);
  if (!pace) return <p className="text-sm text-gray-500">The pace is not worked out.</p>;
  const name = (key) => ledger.world.names.get(key) ?? key;
  const calibration = calibrationStatus();
  const tol = pace.settings.tolerancePct;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px]" style={{ color: calibration.state === 'ok' ? 'var(--color-text-muted)' : 'var(--color-warning)' }} data-calibration={calibration.state}>
          {CALIBRATION_TEXT[calibration.state](calibration)}
        </p>
        <button
          onClick={onRefresh}
          title={`Worked out at ${report.at.toLocaleTimeString()}. Work it out again after edits.`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Stages">
        <h3 className={sectionHead}>Stages at Typical</h3>
        <p className="text-[10px] text-gray-500">When a new game first has everything planned for each stage, at the Typical player's rates, against its budget (red beyond ±{tol} %).</p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 110 }}>Stage</th>
              <th style={{ ...head, textAlign: 'left', width: 100 }}>Budget</th>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>Typical</th>
              <th style={{ ...head, textAlign: 'left' }}>Slowest</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const off = s.budgetMinutes ? (s.hours * 60) / s.budgetMinutes - 1 : 0;
              const red = Math.abs(off) * 100 > tol;
              return (
                <tr key={s.tier} data-stage={s.tier}>
                  <td style={cell}>{tierLabel(s.tier)}</td>
                  <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{formatMinutes(s.budgetMinutes)}</td>
                  <td style={{ ...cell, color: red ? 'var(--color-error)' : 'var(--color-success)' }} data-stage-hours>
                    {hoursText(s.hours)} ({off >= 0 ? '+' : ''}{Math.round(off * 100)} %){!s.complete || s.untimed.length ? '*' : ''}
                  </td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                    {s.slowest.slice(0, 3).map((x, i) => (
                      <span key={x.key}>{i > 0 && ', '}<Link k={x.key} name={name(x.key)} onOpen={onOpen} /> {hoursText(x.hours)}</span>
                    ))}
                    {s.untimed.length > 0 && <span className="text-gray-500"> · {s.untimed.length} not timed</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-500">* a floor: some entries or steps are not timed (never reached, a bounty, trading maps up).</p>
      </section>

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Rate sources by skill">
        <h3 className={sectionHead}>Where each skill's rate comes from</h3>
        <p className="text-[10px] text-gray-500">
          For each skill and each stage that asks for its levels: the hours from a new game to the top level the stage asks at each profile, against the pace curve; the best XP source at Typical and at Maxed; its XP an hour against the same work at Bare; and what each kind of boost adds to it.
        </p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 90 }}>Skill</th>
              <th style={{ ...head, textAlign: 'left', width: 90 }}>Stage</th>
              <th style={{ ...head, textAlign: 'left', width: 200 }}>To the level it asks</th>
              <th style={{ ...head, textAlign: 'left' }}>Typical source</th>
              <th style={{ ...head, textAlign: 'left' }}>Maxed source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.skill}|${r.tier}`}
                data-breakdown={`${r.skill}|${r.tier}`}
                ref={focusSkill === r.skill && !rows.some((x) => x.skill === r.skill && x.tier < r.tier) ? focus : null}
                style={focusSkill === r.skill ? { background: 'rgba(255,255,255,0.04)' } : undefined}
              >
                <td style={{ ...cell, color: 'var(--color-text-primary)' }}>{PACE_TEXT.skill(r.skill)}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{tierLabel(r.tier)}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                  {r.reach > 1 ? (
                    <>
                      <div>Level {r.reach}: curve {formatMinutes(r.curveMinutes)}</div>
                      {PROFILES.map((p) => (
                        <div key={p} style={{ color: ratioColor(r.hours[p] * 60, r.curveMinutes, pace.settings) }}>
                          {PROFILE_TEXT[p]} {hoursText(r.hours[p])}
                        </div>
                      ))}
                    </>
                  ) : <span className="text-gray-500">level 1 only</span>}
                </td>
                {['typical', 'maxed'].map((p) => <SourceCell key={p} source={r.profiles[p]} onOpen={onOpen} skill={r.skill} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Guild Hall paybacks">
        <h3 className={sectionHead}>Guild Hall paybacks</h3>
        <p className="text-[10px] text-gray-500">
          Each rank that adds a rate: its price in hours of work at Bare over the hours it adds an hour. A sensible investor buys what pays for itself within {hoursText(pace.settings.paybackHours)}. Ranks that add room, not a rate (Bank tabs, the Token cap), are listed under Problems.
        </p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 150 }}>Rank</th>
              <th style={{ ...head, textAlign: 'left' }}>Price</th>
              <th style={{ ...head, textAlign: 'left', width: 140 }}>Pays back in</th>
            </tr>
          </thead>
          <tbody>
            {hall.map((h) => (
              <tr key={`${h.id}|${h.rank}`} data-hall={`${h.id}|${h.rank}`}>
                <td style={cell}>{h.name} {h.rank}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{h.priceText} ({hoursText(h.priceHours)})</td>
                <td style={{ ...cell, color: h.enabler ? 'var(--color-text-muted)' : h.payback <= pace.settings.paybackHours ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {h.enabler ? 'the only source: an enabler' : hoursText(h.payback)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const CALIBRATION_TEXT = {
  ok: (c) => `The calculator agrees with the engine (calibrated ${c.stamp.date.slice(0, 10)}, commit ${c.stamp.commit}).`,
  stale: (c) => `Calibration stale: ${c.changed.length} file${c.changed.length === 1 ? '' : 's'} the calculator follows changed since ${c.stamp.date.slice(0, 10)}. Run npm run bench:calibrate.`,
  failed: () => 'The last calibration found the calculator outside its tolerance.',
  none: () => 'Never calibrated: run npm run bench:calibrate.',
};

function ratioColor(minutes, curve, settings) {
  if (!curve) return 'var(--color-text-secondary)';
  const r = minutes / curve;
  if (!Number.isFinite(r) || r > settings.profileBounds) return 'var(--color-error)';
  if (r > settings.wallFactor || r < 1 / settings.profileBounds) return 'var(--color-warning)';
  return 'var(--color-text-secondary)';
}

function SourceCell({ source, onOpen, skill }) {
  if (!source) return <td style={{ ...cell, color: 'var(--color-text-muted)' }}>no work gives {skill} XP</td>;
  const kinds = Object.entries(source.kinds);
  return (
    <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
      <div>
        <Link k={source.work.entry} name={source.name} onOpen={onOpen} />{' '}
        <span data-source-xp>{rateText(source.xp)} XP/h</span>
        <span className="text-gray-500"> (Bare {rateText(source.bareXp)})</span>
      </div>
      {source.fed < 1 && <div style={{ color: 'var(--color-warning)' }}>fed {Math.round(source.fed * 100)} %: short of {source.short}</div>}
      {kinds.length > 0 && (
        <div className="text-gray-500">
          {kinds.map(([kind, g]) => `${BOOST_KIND_TEXT[kind]} ${gainText(g.gain)} (${g.names.join(', ')})`).join(' · ')}
        </div>
      )}
    </td>
  );
}

function Link({ k, name, onOpen }) {
  if (!/^(item|token|recipe):/.test(k || '')) return <span>{name}</span>;
  return (
    <button onClick={() => onOpen(k)} className="underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}>
      {name}
    </button>
  );
}
