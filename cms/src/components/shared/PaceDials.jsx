/**
 * The Pace dials: the two earn curves, the player the projections assume, and the mastery expectation.
 * The curves are the balance rules' (`engine/balanceRules.js`, BALANCE_RULES sections 1 and 7), shown read-only: the workspace's Recalculate runs with the rulebook on (`workspaceDials`), and the ledger reads the same rule, so a pin typed here would only make the two disagree.
 * ⚠️ `skillMasteryHours` is an expectation, not an input: no pass reads it. The read-out beside it is what the XP curve actually integrates to against the game's threshold table (`src/utils/XPCurve.js`).
 */

import { useGlobalStore } from '../../stores/useGlobalStore';
import { Section, Field } from './EditorLayout';
import { gphAt } from '../../engine/sim/dials';
import { hoursToMastery, xphAt } from '../../engine/sim/xpPass';
import { PURPOSE_TILT } from '../../engine/balanceRules';

const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const inputClass = 'w-full text-emerald-400 font-bold font-mono text-xs';
const note = 'text-[10px] text-gray-500 italic';

export default function PaceDials() {
  const globals = useGlobalStore();
  const dials = globals.simDials || {};
  const setDial = (key, value) => globals.setGlobal('simDials', { ...dials, [key]: value });
  return <RulebookDials dials={dials} setDial={setDial} />;
}

const RULEBOOK = Object.freeze({ rulebook: true });
const SAMPLE_LEVELS = Object.freeze([1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99]);
const ruleGold = (level) => gphAt(level, RULEBOOK);
const ruleXp = (level) => xphAt(level, RULEBOOK);

/** The rules' curves, read-only, and the two expectation dials. */
export function RulebookDials({ dials, setDial }) {
  const actualHours = hoursToMastery(RULEBOOK);

  return (
    <Section title="Pace Dials — the earn curves (balance rules, sections 1 and 7)">
      <p className={`${note} block mb-3`}>
        Set by the balance rules, not here: XP an hour and gold an hour both double every 20
        levels (one tier), from 1,660 XP and 1,200 gold at level 1. Recalculate and the ledger read
        the same rule. A work&apos;s Purpose tilts it: training (XPH) {PURPOSE_TILT.xph.xp}x the XP
        and {PURPOSE_TILT.xph.goods}x the goods, balanced (IPH) both in full, earning (GPH){' '}
        {PURPOSE_TILT.gph.xp}x the XP and {PURPOSE_TILT.gph.goods}x the goods.
      </p>

      <RuleCurvePreview read={{ gold: ruleGold, xp: ruleXp }} hoursPerDay={num(dials.hoursPerDay, 8)} />

      <div className="grid grid-cols-2 gap-6 mt-4">
        <CurveColumn title="Gold an hour (section 7)" at={ruleGold} />
        <CurveColumn title="XP an hour (section 1)" at={ruleXp} />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <Field label="Hours Per Day (the assumed player)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="1" min="1" max="24"
              value={num(dials.hoursPerDay, 8)}
              onChange={(e) => setDial('hoursPerDay', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              How long the projected player plays. Not a property of the game — it is what turns
              board-hours into the "day in reach" column on the Map Economics tab.
            </span>
          </div>
        </Field>

        <Field label="Skill Mastery Hours (1→99, expected)">
          <div className="flex flex-col gap-1">
            <input
              type="number" step="1" min="1"
              value={num(dials.skillMasteryHours, 55)}
              onChange={(e) => setDial('skillMasteryHours', Number(e.target.value))}
              className={inputClass}
            />
            <span className={note}>
              An expectation, not an input — no pass reads it. The XP curve above, integrated
              against the game&apos;s own XP thresholds, climbs 1→99 in:
            </span>
            <span className="text-xs font-mono font-bold">
              {Number.isFinite(actualHours)
                ? `${actualHours.toFixed(1)} board-hours of new work`
                : 'no finite climb'}
            </span>
          </div>
        </Field>
      </div>
    </Section>
  );
}

function CurveColumn({ title, at }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-amber-400 mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {SAMPLE_LEVELS.map((level) => (
          <div key={level} className="flex items-center gap-2">
            <span className="text-[10px] font-mono w-10 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              lv {level}
            </span>
            <span className="text-emerald-400 font-bold font-mono text-xs">{Math.round(at(level)).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The rules' two curves on a shared logarithmic axis, where a steady doubling is a straight line. */
function RuleCurvePreview({ read, hoursPerDay }) {
  const W = 640;
  const H = 130;
  const pad = { l: 10, r: 10, t: 8, b: 14 };
  const safe = (v) => (Number.isFinite(v) && v > 0 ? v : 1);

  const samples = [];
  for (let level = 1; level <= 99; level++) samples.push(level);
  const values = samples.flatMap((l) => [safe(read.gold(l)), safe(read.xp(l))]);
  const lo = Math.log10(Math.min(...values));
  const hi = Math.log10(Math.max(...values));
  const span = hi - lo || 1;

  const x = (level) => pad.l + ((level - 1) / 98) * (W - pad.l - pad.r);
  const y = (value) => pad.t + (1 - (Math.log10(safe(value)) - lo) / span) * (H - pad.t - pad.b);
  const line = (at) => samples.map((l) => `${x(l).toFixed(1)},${y(at(l)).toFixed(1)}`).join(' ');
  const ticks = [1, 20, 40, 60, 80, 99];

  return (
    <div className="rounded-lg border p-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: 'block' }}
        role="img"
        aria-label="Gold and experience per hour by level, on a logarithmic axis"
      >
        {ticks.map((l) => (
          <line
            key={l} x1={x(l)} y1={pad.t} x2={x(l)} y2={H - pad.b}
            stroke="var(--color-border-subtle, #333)" strokeWidth="1"
          />
        ))}
        {ticks.map((l) => (
          <text key={`t${l}`} x={x(l)} y={H - 3} fontSize="8" textAnchor="middle" fill="var(--color-text-muted, #888)">
            {l}
          </text>
        ))}
        <polyline points={line(read.gold)} fill="none" stroke="#fbbf24" strokeWidth="1.5" />
        <polyline points={line(read.xp)} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
      </svg>
      <div className="flex flex-wrap gap-x-4 mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        <span><span style={{ color: '#fbbf24' }}>&#9632;</span> gold / hour</span>
        <span><span style={{ color: '#38bdf8' }}>&#9632;</span> experience / hour</span>
        <span className="italic">logarithmic — a straight line is steady doubling</span>
        <span className="ml-auto font-mono">
          {`at lv 50: ${Math.round(read.gold(50)).toLocaleString()}g/h · `}
          {`${Math.round(read.xp(50)).toLocaleString()} xp/h · ${hoursPerDay}h/day`}
        </span>
      </div>
    </div>
  );
}
