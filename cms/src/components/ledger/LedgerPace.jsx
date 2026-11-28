import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  PROFILES, PROFILE_TEXT, PACE_TEXT, BOOST_KIND_TEXT, breakdownRows, hoursText, rateText, gainText, formatMinutes, hallRows,
} from '../../engine/ledgerPace';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { calibrationStatus } from '../../engine/calibrationStatus';
import { useEntityStore } from '../../stores/useEntityStore';
import { workspaceContent } from '../../stores/useLedgerWatchStore';
import { runLedgerJob } from '../../engine/ledgerJobsClient';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const cell = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

/**
 * The Ledger's Pace page: each stage's time at Maxed (the curve's player) against its budget, the per-skill breakdown
 * of where XP comes from (the best source at each stage, Bare against Typical and Maxed, and what
 * each kind of boost adds), the hours each stage's top level takes at each profile against the pace
 * curve, the Guild Hall's paybacks, and whether the calculator's calibration stands.
 */
export default function LedgerPace({ report, onRefresh, onOpen, focusSkill }) {
  const { pace, ledger } = report;
  const stages = useMemo(() => (pace ? pace.settings.stages.map((s) => ({ ...s, ...pace.stageOf(s.tier) })) : []), [pace]);
  const rows = useMemo(() => (pace ? breakdownRows(pace) : []), [pace]);
  const hall = useMemo(() => (pace ? hallRows(pace).filter((r) => r.rate) : []), [pace]);
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
        <h3 className={sectionHead}>Stages at Maxed</h3>
        <p className="text-[10px] text-gray-500">
          Leaving a stage means settling the next place: one hero reaches the level it asks in its one or two skills and pays its price. The way out is the soonest of the next stage's places at the Maxed player's rates (the curve's player), timed with the stage's heroes (about one a tier), against the budget: the pace curve's time to the level the next tier opens at (red beyond ±{tol} %). A place's goods are the world seed's, so its price here is its coins and every way out is a floor until they are counted. The full content is everything planned for the stage, information only: it is done over the following hours, alongside the new place.
        </p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 100 }}>Stage</th>
              <th style={{ ...head, textAlign: 'left', width: 90 }}>Budget</th>
              <th style={{ ...head, textAlign: 'left', width: 250 }}>Way out at Maxed</th>
              <th style={{ ...head, textAlign: 'left', width: 70 }}>Heroes</th>
              <th style={{ ...head, textAlign: 'left' }}>Full content (information)</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const g = s.gate;
              const off = g.place && s.budgetMinutes ? (g.hours * 60) / s.budgetMinutes - 1 : 0;
              const red = !Number.isFinite(off) || Math.abs(off) * 100 > tol;
              const later = g.place ? g.needs.filter((n) => n.hours > g.hours) : [];
              return (
                <tr key={s.tier} data-stage={s.tier}>
                  <td style={cell}>{tierLabel(s.tier)}</td>
                  <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{formatMinutes(s.budgetMinutes)}</td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }} data-stage-gate>
                    {g.place ? (
                      <>
                        <div style={{ color: red ? 'var(--color-error)' : 'var(--color-success)' }} data-stage-hours>
                          {hoursText(g.hours)}{Number.isFinite(off) ? ` (${off >= 0 ? '+' : ''}${Math.round(off * 100)} %)` : ''}{g.floor.length ? '*' : ''}
                        </div>
                        <div>{g.name}: {wayOutAsks(g)}</div>
                        {g.floor.length > 0 && (
                          <div className="text-gray-500" data-stage-floor>* a floor: {g.floor.map((f) => PACE_TEXT.wayOutFloor[f]).join('; ')}</div>
                        )}
                        <div className="text-gray-500" style={{ fontWeight: g.byWork ? 700 : 400 }}>
                          their work {hoursText(g.workHours)}{g.byWork ? ' (sets it)' : ''}; side by side {hoursText(g.pathHours)}
                        </div>
                        {later.length > 0 && (
                          <div className="text-gray-500" data-stage-gate-needs>also waits for {later.map((n) => `${n.name} (${hoursText(n.hours)})`).join(', ')}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500" data-stage-gate-none>{g.why === 'last' ? 'the last stage' : `no place of ${tierLabel(g.next)} to settle`}</span>
                    )}
                  </td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }} data-stage-heroes>{PACE_TEXT.heroes(s.heroes)}</td>
                  <td style={{ ...cell, color: 'var(--color-text-muted)' }} data-stage-content>
                    {s.entries > 0 ? (
                      <>
                        <div>
                          {hoursText(s.hours)}{!s.complete || s.untimed.length ? '*' : ''}, {s.entries} {s.entries === 1 ? 'entry' : 'entries'}; their work {hoursText(s.workHours)}{s.byWork ? ' (sets it)' : ''}, side by side {hoursText(s.pathHours)}
                        </div>
                        <div>
                          {s.slowest.slice(0, 3).map((x, i) => (
                            <span key={x.key}>{i > 0 && ', '}<Link k={x.key} name={name(x.key)} onOpen={onOpen} /> {hoursText(x.hours)}</span>
                          ))}
                          {s.untimed.length > 0 && <span> · {s.untimed.length} not timed</span>}
                        </div>
                      </>
                    ) : 'nothing planned'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-500">* a floor, the real time later: a way out whose place's goods price (the world seed's) is not counted, or whose level asked is a fighting style's; full content with some entries or steps not timed (never reached, or a step the calculator cannot time).</p>
      </section>

      <Layouts pace={pace} onOpen={onOpen} />


      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Rate sources by skill">
        <h3 className={sectionHead}>Where each skill's rate comes from</h3>
        <p className="text-[10px] text-gray-500">
          For each skill and each stage that asks for its levels: the hours from a new game to the top level the stage asks at each profile, against the pace curve; the best XP source at Typical and at Maxed; its XP an hour against the same work at Bare; the Guild Hall's share (what the stars the profile holds add to it, on its own line); and what each other kind of boost adds.
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
          Each rank that adds a rate, at the tier it belongs to and at Typical: the hours its price takes to gather (at Typical's rates before the Hall), and for a star still closed there the stars lit to open it, against the hours it saves an hour on the work it pays back soonest on (information: Typical buys a rank on a work that pays for itself there within the payback curve at its tier's opening level). Over all its work is the payback check: the rank's payback counting every piece of work it boosts that the guild's heroes can work at once, against the payback curve (1 hour × 24^(L / 80), BALANCE_RULES section 5): red when slower past the tolerance, amber when far quicker. The proposed price is the most of its tier's material it can cost and still pay back on the curve over all its work, never below the rank before (raised ones are marked, and red when the raise makes them pay back too slowly): a preview, never applied. A rank priced in what its stage cannot gather, and ranks that add no rate (Bank tabs, a wound's length, a loadout slot, a camp's reach) are listed under Problems.
        </p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 170 }}>Rank</th>
              <th style={{ ...head, textAlign: 'left', width: 100 }}>Tier</th>
              <th style={{ ...head, textAlign: 'left' }}>Price (to gather)</th>
              <th style={{ ...head, textAlign: 'left' }}>Saves</th>
              <th style={{ ...head, textAlign: 'left', width: 110 }}>Pays back in</th>
              <th style={{ ...head, textAlign: 'left', width: 150 }}>Over all its work</th>
              <th style={{ ...head, textAlign: 'left' }}>Proposed (preview)</th>
            </tr>
          </thead>
          <tbody>
            {hall.map((h) => (
              <tr key={`${h.id}|${h.rank}`} data-hall={`${h.id}|${h.rank}`} data-hall-pays={h.pays ? 'yes' : 'no'}>
                <td style={cell}>{h.name} {h.rank}</td>
                <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{h.tier === null ? <span style={{ color: 'var(--color-warning)' }}>no tier set</span> : tierLabel(h.tier)}</td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                  {h.priceText} ({h.priceTimeText}){h.openingText ? <span className="text-gray-500" data-hall-opening> + {h.openingText}</span> : null}
                </td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                  {h.savesText}{h.workText && !h.enabler ? <span className="text-gray-500"> on {h.workText}</span> : null}
                </td>
                <td style={{ ...cell, color: h.enabler ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }} data-hall-payback>
                  {h.paybackText}
                </td>
                <td style={{ ...cell, fontWeight: h.guild?.off ? 700 : 400, color: !h.guild ? 'var(--color-text-muted)' : h.guild.off ? (h.guild.slow ? 'var(--color-error)' : 'var(--color-warning)') : 'var(--color-success)' }} data-hall-guild>
                  {h.guild ? <>{h.guild.text} <span className="text-gray-500">({h.guild.curveText})</span></> : '—'}
                </td>
                <td style={{ ...cell, color: h.proposed && !h.proposed.why && !h.proposed.pays ? 'var(--color-error)' : 'var(--color-text-muted)' }} data-hall-proposed>
                  {h.proposed ? (h.proposed.why ? h.proposed.why : `${h.proposed.priceText} (pays back in ${hoursText(h.proposed.payback)} over all its work${h.proposed.raised ? ', raised to the rank before' : ''})`) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/**
 * The two layouts a work site is timed at: the nodes the dense one makes past the tolerance more of
 * (cheap, always shown), and on a click each skill's days to 99 in both (a second pace, worked out in
 * the ledger's Worker and set beside this pace's own).
 */
function Layouts({ pace, onOpen }) {
  const [spread, setSpread] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const nodes = useMemo(() => pace.layoutRows(), [pace]);
  const timeOther = async () => {
    setRunning(true);
    setError(null);
    try {
      const other = await runLedgerJob('layouts', { workspace: workspaceContent(useEntityStore.getState()) });
      if (alive.current) setSpread(pace.layoutSpread(other));
    } catch (err) {
      if (alive.current) setError(err.message);
    } finally {
      if (alive.current) setRunning(false);
    }
  };
  const n = pace.settings.layouts;
  const tol = pace.settings.tolerancePct;
  const days = (d) => (Number.isFinite(d) ? `${Math.round(d * 10) / 10} d` : 'never');
  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Layouts">
      <h3 className={sectionHead}>Layouts</h3>
      <p className="text-[10px] text-gray-500">
        A camp works {n.sparse} nodes in the sparse layout and {n.dense} in the dense one; at a Forest, an Orchard or a Quarry, the whole allowance of {pace.settings.layoutSpawners.sparse} and of {pace.settings.layoutSpawners.dense} of them (Ledger settings); the pace above is timed {pace.settings.layout}. By the rest rule a node gives about 15 s of work and is back in about a minute, so a hero alone at one is busy about a fifth of the time and a camp of 4 or 5 keeps one busy: the more of a node stands in reach, up to that, the more it makes (red beyond ±{tol} %). A node that rests no longer than it works keeps one hero busy on two, and the layout then moves nothing.
      </p>
      {nodes.length === 0 ? (
        <p className="text-[11px] text-gray-500" data-layout-nodes="0">No node makes past the tolerance more in the dense layout.</p>
      ) : (
        <ul className="text-[11px] space-y-0.5" data-layout-nodes={nodes.length}>
          {nodes.map((r) => (
            <li key={r.work.key} style={{ color: 'var(--color-warning)' }}>
              <Link k={r.work.entry} name={pace.workName(r.work)} onOpen={onOpen} />: {rateText(r.sparse)} an hour with {r.nodes.sparse}, {rateText(r.dense)} with {r.nodes.dense} (+{Math.round(r.off * 100)} %)
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {!spread ? (
        <button
          onClick={timeOther}
          disabled={running}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: running ? 'wait' : 'pointer' }}
          data-layout-spread-button
        >
          {running ? 'Timing the other layout…' : `Time the ${pace.settings.layout === 'sparse' ? 'dense' : 'sparse'} layout too`}
        </button>
      ) : (
        <table className="w-full" style={{ borderCollapse: 'collapse' }} data-layout-spread>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 110 }}>Skill</th>
              <th style={{ ...head, textAlign: 'left' }}>Days to 99, sparse ({n.sparse})</th>
              <th style={{ ...head, textAlign: 'left' }}>Dense ({n.dense})</th>
              <th style={{ ...head, textAlign: 'left', width: 110 }}>Apart</th>
            </tr>
          </thead>
          <tbody>
            {spread.skills.map((s) => (
              <tr key={s.skill} data-layout-skill={s.skill}>
                <td style={cell}>{PACE_TEXT.skill(s.skill)}</td>
                {['sparse', 'dense'].map((l) => (
                  <td key={l} style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                    {PROFILES.map((p) => `${PROFILE_TEXT[p]} ${days(s.days[l][p])}`).join(' · ')}
                  </td>
                ))}
                <td style={{ ...cell, color: s.warn ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{Math.round(s.off * 100)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** What a way out asks, in words: "Mining 10 + 420 coins", a further place of its ring with its order: "+ 656 coins (its ring's 3rd place)". */
function wayOutAsks(g) {
  const further = g.order > 1 ? ` (its ring's ${PACE_TEXT.ordinal(g.order)} place)` : '';
  const parts = [...g.asks.map((a) => `${PACE_TEXT.skill(a.skill)} ${a.level}`), ...(g.coins > 0 ? [`${PACE_TEXT.coins(g.coins)}${further}`] : [])];
  return parts.join(' + ') || 'nothing';
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
  const bounds = settings.profileBounds;
  if (!Number.isFinite(r) || r > bounds.bare) return 'var(--color-error)';
  if (r > settings.wallFactor || r < 1 / bounds.maxed) return 'var(--color-warning)';
  return 'var(--color-text-secondary)';
}

function SourceCell({ source, onOpen, skill }) {
  if (!source) return <td style={{ ...cell, color: 'var(--color-text-muted)' }}>no work gives {skill} XP</td>;
  const kinds = Object.entries(source.kinds).filter(([kind]) => kind !== 'hall');
  const hall = source.kinds.hall;
  return (
    <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
      <div>
        <Link k={source.work.entry} name={source.name} onOpen={onOpen} />{' '}
        <span data-source-xp>{rateText(source.xp)} XP/h</span>
        <span className="text-gray-500"> (Bare {rateText(source.bareXp)})</span>
      </div>
      {source.fed < 1 && <div style={{ color: 'var(--color-warning)' }}>fed {Math.round(source.fed * 100)} %: short of {source.short}</div>}
      {source.gatherers > 0.005 && <div className="text-gray-500" data-gatherers>fed by {rateText(source.gatherers)} gatherers down its chain</div>}
      <div data-hall-share style={{ color: hall ? 'var(--color-accent-hover)' : 'var(--color-text-muted)' }}>
        {hall ? `Guild Hall ${gainText(hall.gain)} (${hall.names.join(', ')})` : 'Guild Hall: none at this stage'}
      </div>
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
