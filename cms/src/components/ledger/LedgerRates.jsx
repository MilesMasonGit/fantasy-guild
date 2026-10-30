import { useMemo, useState } from 'react';

import {
  PROFILES, PROFILE_TEXT, BOOST_KIND_TEXT, FACTOR_KIND_TEXT, worksOf, rateRow, itemsText, rateText, hoursText,
  switchedSetup, switchableFactors, choiceText, pathRows, keyName, formatMinutes, itemKey,
} from '../../engine/ledgerPace';
import { parseKey } from '../../../../src/systems/progression/ledger/engine.js';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const cell = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

/**
 * An entry's path time at each profile (Bare, Typical, Maxed), against what the pace curve gives
 * the levels its path asks, with the chain of steps that sets the Typical time.
 */
export function LedgerPathTime({ pace, ledger, entryKey, onOpen }) {
  const rows = useMemo(() => pathRows(pace, ledger, entryKey), [pace, ledger, entryKey]);
  const [profile, setProfile] = useState('typical');
  if (!rows.length) return null;
  const shown = rows.find((r) => r.profile === profile) || rows[1];
  const wall = pace.settings.wallFactor;
  return (
    <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Path time">
      <h4 className={sectionHead}>Path time</h4>
      <p className="text-[10px] text-gray-500">
        Hours of work from a new game until it is first had, along the path above: each step starts once what it needs is had and its levels are reached (skills levelled side by side), then takes its own time. Average luck.
      </p>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left', width: 90 }}>Profile</th>
            <th style={{ ...head, textAlign: 'left', width: 120 }}>First had after</th>
            <th style={{ ...head, textAlign: 'left' }}>Against the curve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profile} data-path-profile={r.profile}>
              <td style={cell}>
                <button
                  onClick={() => setProfile(r.profile)}
                  className={profile === r.profile ? 'font-bold' : 'underline'}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}
                >
                  {PROFILE_TEXT[r.profile]}
                </button>
              </td>
              <td style={{ ...cell, color: 'var(--color-text-secondary)' }} data-path-hours>
                {hoursText(r.hours)}{!r.complete && Number.isFinite(r.hours) && <span className="text-gray-500"> at least</span>}
              </td>
              <td style={{ ...cell, color: r.ratio !== null && r.ratio > wall ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                {r.curveMinutes === null ? 'its path asks no level'
                  : `the curve gives ${formatMinutes(r.curveMinutes)} to its levels (${Number.isFinite(r.ratio) ? `${r.ratio >= 10 ? Math.round(r.ratio) : r.ratio.toFixed(1)}×` : '—'})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10px] text-gray-500 pt-1">What sets the {PROFILE_TEXT[shown.profile]} time, latest step first:</div>
      <ol className="space-y-1" aria-label="Path steps">
        {shown.steps.map((s) => (
          <li key={s.key} className="text-[11px] flex flex-wrap gap-x-2" data-path-step={s.key} style={{ color: 'var(--color-text-secondary)' }}>
            <span style={{ minWidth: 70, color: 'var(--color-text-muted)' }}>{hoursText(s.ready)}</span>
            {/^(item|token|recipe):/.test(s.key)
              ? <button onClick={() => onOpen(s.key)} className="underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}>{s.name}</button>
              : <span style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>}
            <span className="text-gray-500">{s.how}{s.via ? ` ${s.via}` : ''}</span>
            {s.gates.length > 0 && <span className="text-gray-500">· {s.gates.map((g) => `${g.text} at ${hoursText(g.hours)}`).join(', ')}</span>}
            <span>· waits {s.waits ? `for ${s.waits}` : 'for nothing'} until {hoursText(s.start)}, then {hoursText(s.own)} of its own</span>
            {s.why && <span style={{ color: 'var(--color-warning)' }}>· {s.why}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The rates of the work that belongs to an entry (a Token's own work, a recipe at each station),
 * at a profile, with every factor listed and switchable: unticking one re-rates the work without it.
 * For an item, how fast the guild gets it at each profile and from where.
 */
export default function LedgerRates({ pace, ledger, entryKey, onOpen }) {
  const { kind, id } = parseKey(entryKey);
  const works = useMemo(() => worksOf(pace, entryKey), [pace, entryKey]);
  if (kind === 'item') return <LedgerSupply pace={pace} ledger={ledger} itemId={id} onOpen={onOpen} />;
  if (!works.length) return null;
  return (
    <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-3" aria-label="Rates">
      <h4 className={sectionHead}>Rates</h4>
      <p className="text-[10px] text-gray-500">
        One hero at the content's own numbers, through the game's formulas, at the stage it is first reached. Bare: only what the work needs; Typical: the boosts that pay for themselves; Maxed: every boost. Untick a factor to see the rate without it.
      </p>
      {works.map((w) => <WorkRates key={w.key} pace={pace} ledger={ledger} work={w} />)}
    </div>
  );
}

function WorkRates({ pace, ledger, work }) {
  const [profile, setProfile] = useState('typical');
  const [off, setOff] = useState([]);
  const choice = useMemo(() => pace.rateAt(work.target, profile), [pace, work, profile]);
  const switched = useMemo(() => (off.length ? pace.book.rateOf(work.target, switchedSetup(choice, off)) : null), [pace, work, choice, off]);
  if (!choice) return null;
  const shown = switched || choice.rate;
  const row = rateRow(shown, switched ? 1 : choice.scale);
  const toggle = (factor) => setOff((list) => (list.includes(factor) ? list.filter((f) => f !== factor) : [...list, factor]));
  const chosen = choiceText(pace, ledger, choice.chosen);
  return (
    <div className="rounded-lg border border-white/5 p-3 space-y-2" data-work={work.key}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-white">{pace.workName(work)}</span>
        <span className="text-[10px] text-gray-500">{work.tier === null ? 'never reached' : `rated at stage ${work.tier}`}</span>
        <span className="flex gap-1 ml-auto" role="tablist">
          {PROFILES.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={profile === p}
              onClick={() => { setProfile(p); setOff([]); }}
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                background: profile === p ? 'var(--color-accent-muted)' : 'transparent',
                color: profile === p ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border-subtle)', cursor: 'pointer',
              }}
            >
              {PROFILE_TEXT[p]}
            </button>
          ))}
        </span>
      </div>
      {!row.ok ? (
        <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>Not rated: {row.reason}.</p>
      ) : (
        <dl className="grid gap-x-4 gap-y-1 text-[11px]" style={{ gridTemplateColumns: 'max-content 1fr' }} data-rate={work.key}>
          <dt className="text-gray-500">Cycle</dt>
          <dd style={{ color: 'var(--color-text-secondary)' }}>{(row.cycleMs / 1000).toFixed(row.cycleMs < 10000 ? 1 : 0)} s · {rateText(row.cyclesPerHour)} cycles an hour (held back by {LIMIT_TEXT[row.limitedBy] || row.limitedBy})</dd>
          <dt className="text-gray-500">Makes an hour</dt>
          <dd style={{ color: 'var(--color-text-secondary)' }} data-rate-items>{itemsText(pace, ledger, row.items)}</dd>
          <dt className="text-gray-500">XP an hour</dt>
          <dd style={{ color: 'var(--color-text-secondary)' }} data-rate-xp>{Object.entries(row.xp).map(([s, n]) => `${rateText(n)} ${s}`).join(', ') || '—'}</dd>
          <dt className="text-gray-500">Spends an hour</dt>
          <dd style={{ color: 'var(--color-text-secondary)' }}>{itemsText(pace, ledger, row.inputs)}</dd>
          {!switched && choice.scale < 1 && (
            <>
              <dt className="text-gray-500">Fed</dt>
              <dd style={{ color: 'var(--color-warning)' }}>{Math.round(choice.scale * 100)} % of the time: one hero cannot make enough {keyName(pace, ledger, itemKey(choice.short))}</dd>
            </>
          )}
          <dt className="text-gray-500">{PROFILE_TEXT[profile]} chose</dt>
          <dd style={{ color: 'var(--color-text-secondary)' }}>
            {chosen.length ? chosen.map((c) => `${c.name}${c.why}`).join(', ') : 'no boosts'}
          </dd>
        </dl>
      )}
      <div className="space-y-0.5" aria-label="Factors">
        {switchableFactors(choice.rate).map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-[11px]" data-rate-factor={f.id} style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={!off.includes(f.id)} onChange={() => toggle(f.id)} aria-label={`Switch ${f.name}`} />
            <span style={{ minWidth: 80, color: 'var(--color-text-muted)' }}>{FACTOR_KIND_TEXT[f.kind] || f.kind}</span>
            <span>{f.name}</span>
            <span className="text-gray-500">{f.axes.length ? `moves ${f.axes.join(', ').toLowerCase().replace(/_/g, ' ')}` : 'moves nothing here'}</span>
          </label>
        ))}
        {(shown.unmodelled || []).length > 0 && (
          <p className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
            Cannot read: {shown.unmodelled.map((u) => `${u.what} (${u.why})`).join('; ')}
          </p>
        )}
        {(shown.assumptions || []).length > 0 && (
          <p className="text-[10px] text-gray-500">Taken as: {shown.assumptions.map((u) => u.why).join('; ')}</p>
        )}
      </div>
    </div>
  );
}

const LIMIT_TEXT = { hero: 'the hero', supply: 'what the Token offers', clock: 'its clock', inputs: 'its inputs' };

function LedgerSupply({ pace, ledger, itemId, onOpen }) {
  const rows = useMemo(() => PROFILES.map((p) => ({ profile: p, ...pace.supplyOf(itemId, p) })), [pace, itemId]);
  if (!rows.some((r) => r.work)) return null;
  return (
    <div className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Supply">
      <h4 className={sectionHead}>How fast the guild gets it</h4>
      <p className="text-[10px] text-gray-500">Its best source once everything is reachable, fed by one hero on each of its inputs. Open the source for its factors.</p>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profile} data-supply-profile={r.profile}>
              <td style={{ ...cell, width: 90 }}>{PROFILE_TEXT[r.profile]}</td>
              <td style={{ ...cell, width: 110, color: 'var(--color-text-secondary)' }}>{rateText(r.perHour)} an hour</td>
              <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                {r.work ? (
                  <button onClick={() => onOpen(r.work.entry)} className="underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}>
                    {pace.workName(r.work)}
                  </button>
                ) : 'nothing makes it'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { BOOST_KIND_TEXT };
